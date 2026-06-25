import { createHash } from "crypto";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

const BACKUP_BUCKET = "ops-backups";

const BACKUP_TABLES: Array<{ name: string; orderColumn: string }> = [
  { name: "clientes", orderColumn: "created_at" },
  { name: "client_photos", orderColumn: "created_at" },
  { name: "company_document_folders", orderColumn: "created_at" },
  { name: "company_documents", orderColumn: "created_at" },
  { name: "diagnostico_capilar", orderColumn: "created_at" },
  { name: "historico_procedimentos", orderColumn: "created_at" },
  { name: "manutencao_homecare", orderColumn: "created_at" },
  { name: "ficha_anamnese_capilar", orderColumn: "created_at" },
  { name: "agendamentos", orderColumn: "created_at" },
  { name: "pre_consulta_envios", orderColumn: "created_at" },
  { name: "clinic_preferences", orderColumn: "created_at" },
  { name: "services", orderColumn: "created_at" },
];

async function fetchTableRows(tableName: string, orderColumn: string) {
  const supabase = createSupabaseAdminClient();
  const rows: Record<string, unknown>[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .order(orderColumn, { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw error;
    }

    const currentBatch = (data as Record<string, unknown>[]) || [];
    rows.push(...currentBatch);

    if (currentBatch.length < pageSize) {
      break;
    }
  }

  return rows;
}

async function createBackupRun(triggerSource: string, metadata: Record<string, unknown>) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("backup_run_history")
    .insert({
      trigger_source: triggerSource,
      destination: "supabase-storage",
      status: "running",
      metadata,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error || new Error("Nao foi possivel registrar o inicio do backup.");
  }

  return data.id as string;
}

async function finalizeBackupRun(
  runId: string,
  payload: {
    destination: string;
    storageBucket?: string | null;
    storagePath?: string | null;
    s3Bucket?: string | null;
    s3Key?: string | null;
    checksum?: string | null;
    payloadBytes?: number;
    tableCounts?: Record<string, number>;
    status: "succeeded" | "failed";
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("backup_run_history")
    .update({
      destination: payload.destination,
      storage_bucket: payload.storageBucket || null,
      storage_path: payload.storagePath || null,
      s3_bucket: payload.s3Bucket || null,
      s3_key: payload.s3Key || null,
      checksum: payload.checksum || null,
      payload_bytes: payload.payloadBytes ?? 0,
      table_counts: payload.tableCounts || {},
      status: payload.status,
      error_message: payload.errorMessage || null,
      metadata: payload.metadata || {},
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) {
    throw error;
  }
}

async function createRestoreDrillRun(triggerSource: string, metadata: Record<string, unknown>) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("restore_drill_history")
    .insert({
      trigger_source: triggerSource,
      status: "running",
      metadata,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error || new Error("Nao foi possivel registrar o inicio do drill de restore.");
  }

  return data.id as string;
}

async function finalizeRestoreDrillRun(
  runId: string,
  payload: {
    latestBackupRunId?: string | null;
    latestBackupPath?: string | null;
    verifiedTransactionId?: number | null;
    verifiedRecordIdentity?: Record<string, unknown> | null;
    resultSummary?: Record<string, unknown>;
    status: "succeeded" | "failed";
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("restore_drill_history")
    .update({
      latest_backup_run_id: payload.latestBackupRunId || null,
      latest_backup_path: payload.latestBackupPath || null,
      verified_transaction_id: payload.verifiedTransactionId ?? null,
      verified_record_identity: payload.verifiedRecordIdentity || null,
      result_summary: payload.resultSummary || {},
      status: payload.status,
      error_message: payload.errorMessage || null,
      metadata: payload.metadata || {},
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) {
    throw error;
  }
}

export async function runBackupExport(triggerSource: string, metadata: Record<string, unknown> = {}) {
  const supabase = createSupabaseAdminClient();
  const runId = await createBackupRun(triggerSource, metadata);

  try {
    const tableEntries = await Promise.all(
      BACKUP_TABLES.map(async ({ name, orderColumn }) => {
        const rows = await fetchTableRows(name, orderColumn);
        return [name, rows] as const;
      })
    );

    const tables = Object.fromEntries(tableEntries);
    const tableCounts = Object.fromEntries(tableEntries.map(([name, rows]) => [name, rows.length]));
    const exportedAt = new Date().toISOString();
    const storagePath = `daily/${exportedAt.slice(0, 10)}/backup-${exportedAt.replace(/[:.]/g, "-")}.json`;
    const payload = {
      exported_at: exportedAt,
      source: "production",
      tables,
      table_counts: tableCounts,
      metadata,
    };

    const buffer = Buffer.from(JSON.stringify(payload, null, 2), "utf-8");
    const checksum = createHash("sha256").update(buffer).digest("hex");

    const { error: uploadError } = await supabase.storage.from(BACKUP_BUCKET).upload(storagePath, buffer, {
      contentType: "application/json; charset=utf-8",
      upsert: true,
    });

    if (uploadError) {
      throw uploadError;
    }

    await finalizeBackupRun(runId, {
      destination: "supabase-storage",
      storageBucket: BACKUP_BUCKET,
      storagePath,
      s3Bucket: null,
      s3Key: null,
      checksum,
      payloadBytes: buffer.byteLength,
      tableCounts,
      status: "succeeded",
      metadata,
    });

    return {
      id: runId,
      destination: "supabase-storage",
      storageBucket: BACKUP_BUCKET,
      storagePath,
      s3Bucket: null,
      s3Key: null,
      checksum,
      payloadBytes: buffer.byteLength,
      tableCounts,
    };
  } catch (error) {
    await finalizeBackupRun(runId, {
      destination: "supabase-storage",
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Falha desconhecida ao exportar o backup.",
      metadata,
    });
    throw error;
  }
}

export async function runRestoreDrill(triggerSource: string, metadata: Record<string, unknown> = {}) {
  const supabase = createSupabaseAdminClient();
  const runId = await createRestoreDrillRun(triggerSource, metadata);

  try {
    const latestBackupResult = await supabase
      .from("backup_run_history")
      .select("id, storage_bucket, storage_path, checksum, table_counts")
      .eq("status", "succeeded")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestBackupResult.error) {
      throw latestBackupResult.error;
    }

    if (!latestBackupResult.data?.storage_bucket || !latestBackupResult.data.storage_path) {
      throw new Error("Nenhum backup bem-sucedido foi encontrado para o drill de restauração.");
    }

    const { data: backupBlob, error: downloadError } = await supabase.storage
      .from(latestBackupResult.data.storage_bucket)
      .download(latestBackupResult.data.storage_path);

    if (downloadError) {
      throw downloadError;
    }

    const backupText = await backupBlob.text();
    const parsedBackup = JSON.parse(backupText) as {
      exported_at?: string;
      table_counts?: Record<string, number>;
      tables?: Record<string, unknown[]>;
    };

    const { data: auditRows, error: auditError } = await supabase.rpc("admin_list_row_change_audit", {
      p_limit: 1,
    });

    if (auditError) {
      throw auditError;
    }

    const auditSample = Array.isArray(auditRows) ? auditRows[0] : null;
    const resultSummary = {
      exportedAt: parsedBackup.exported_at || null,
      tableCounts: parsedBackup.table_counts || latestBackupResult.data.table_counts || {},
      tableCountKeys: Object.keys(parsedBackup.tables || {}),
      auditSample,
    };

    await finalizeRestoreDrillRun(runId, {
      latestBackupRunId: latestBackupResult.data.id,
      latestBackupPath: latestBackupResult.data.storage_path,
      verifiedTransactionId: auditSample?.transaction_id ? Number(auditSample.transaction_id) : null,
      verifiedRecordIdentity:
        auditSample?.record_identity && typeof auditSample.record_identity === "object"
          ? auditSample.record_identity
          : null,
      resultSummary,
      status: "succeeded",
      metadata,
    });

    return {
      id: runId,
      latestBackupRunId: latestBackupResult.data.id,
      latestBackupPath: latestBackupResult.data.storage_path,
      resultSummary,
    };
  } catch (error) {
    await finalizeRestoreDrillRun(runId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Falha desconhecida no drill de restauração.",
      metadata,
    });
    throw error;
  }
}
