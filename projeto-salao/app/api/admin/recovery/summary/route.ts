import { NextResponse } from "next/server";
import type { BackupRunHistory, DeletedRecordSummary, RecoverySummary, RestoreDrillHistory } from "@/types";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { requireAdminRequest } from "@/lib/server/requestGuards";

type BackupRunRow = {
  id: string;
  trigger_source: string;
  destination: string;
  storage_bucket: string | null;
  storage_path: string | null;
  s3_bucket: string | null;
  s3_key: string | null;
  checksum: string | null;
  payload_bytes: number | string | null;
  table_counts: Record<string, number> | null;
  started_at: string;
  completed_at: string | null;
  status: "running" | "succeeded" | "failed";
  error_message: string | null;
  metadata: Record<string, unknown> | null;
};

type RestoreDrillRow = {
  id: string;
  trigger_source: string;
  status: "running" | "succeeded" | "failed";
  started_at: string;
  completed_at: string | null;
  latest_backup_run_id: string | null;
  latest_backup_path: string | null;
  verified_transaction_id: number | string | null;
  verified_record_identity: Record<string, unknown> | null;
  result_summary: Record<string, unknown> | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
};

type DeletedClientRow = {
  id: string;
  nome: string;
  whatsapp: string | null;
  deleted_at: string;
  delete_reason: string | null;
  profile_photo_quarantined_path: string | null;
};

type DeletedPhotoRow = {
  id: string;
  cliente_id: string;
  caption: string | null;
  url: string | null;
  deleted_at: string;
  delete_reason: string | null;
  quarantined_storage_path: string | null;
  clientes: { nome: string } | { nome: string }[] | null;
};

type DeletedDocumentRow = {
  id: string;
  nome: string;
  arquivo_nome: string | null;
  deleted_at: string;
  delete_reason: string | null;
  quarantined_storage_path: string | null;
  company_document_folders: { nome: string } | { nome: string }[] | null;
};

function relationName(value: { nome: string } | { nome: string }[] | null) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0]?.nome : value.nome;
}

function mapBackupRun(row: BackupRunRow): BackupRunHistory {
  return {
    id: row.id,
    triggerSource: row.trigger_source,
    destination: row.destination,
    storageBucket: row.storage_bucket || undefined,
    storagePath: row.storage_path || undefined,
    s3Bucket: row.s3_bucket || undefined,
    s3Key: row.s3_key || undefined,
    checksum: row.checksum || undefined,
    payloadBytes: Number(row.payload_bytes || 0),
    tableCounts: (row.table_counts || {}) as Record<string, number>,
    startedAt: row.started_at,
    completedAt: row.completed_at || undefined,
    status: row.status,
    errorMessage: row.error_message || undefined,
    metadata: (row.metadata || {}) as Record<string, unknown>,
  };
}

function mapRestoreDrill(row: RestoreDrillRow): RestoreDrillHistory {
  return {
    id: row.id,
    triggerSource: row.trigger_source,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at || undefined,
    latestBackupRunId: row.latest_backup_run_id || undefined,
    latestBackupPath: row.latest_backup_path || undefined,
    verifiedTransactionId: row.verified_transaction_id ? Number(row.verified_transaction_id) : undefined,
    verifiedRecordIdentity: (row.verified_record_identity || undefined) as Record<string, unknown> | undefined,
    resultSummary: (row.result_summary || {}) as Record<string, unknown>,
    errorMessage: row.error_message || undefined,
    metadata: (row.metadata || {}) as Record<string, unknown>,
  };
}

export async function GET(request: Request) {
  const authResponse = requireAdminRequest(request);
  if (authResponse) {
    return authResponse;
  }

  const supabase = createSupabaseAdminClient();

  try {
    const [clientsResult, photosResult, documentsResult, backupResult, restoreDrillResult] = await Promise.all([
      supabase
        .from("clientes")
        .select("id, nome, whatsapp, deleted_at, delete_reason, profile_photo_quarantined_path")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(18),
      supabase
        .from("client_photos")
        .select("id, cliente_id, caption, url, deleted_at, delete_reason, quarantined_storage_path, clientes(nome)")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(18),
      supabase
        .from("company_documents")
        .select("id, nome, arquivo_nome, deleted_at, delete_reason, quarantined_storage_path, company_document_folders(nome)")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(18),
      supabase.from("backup_run_history").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("restore_drill_history").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (clientsResult.error) throw clientsResult.error;
    if (photosResult.error) throw photosResult.error;
    if (documentsResult.error) throw documentsResult.error;
    if (backupResult.error) throw backupResult.error;
    if (restoreDrillResult.error) throw restoreDrillResult.error;

    const deletedClients: DeletedRecordSummary[] = ((clientsResult.data as DeletedClientRow[] | null) || []).map((row) => ({
      tableName: "clientes",
      recordId: row.id,
      displayName: row.nome,
      subtitle: row.whatsapp || undefined,
      deletedAt: row.deleted_at,
      deleteReason: row.delete_reason || undefined,
      quarantinedStoragePath: row.profile_photo_quarantined_path || undefined,
    }));

    const deletedPhotos: DeletedRecordSummary[] = ((photosResult.data as DeletedPhotoRow[] | null) || []).map((row) => ({
      tableName: "client_photos",
      recordId: row.id,
      clientId: row.cliente_id,
      displayName: relationName(row.clientes) ? `Foto de ${relationName(row.clientes)}` : row.caption || "Foto arquivada",
      subtitle: row.caption || row.url || undefined,
      deletedAt: row.deleted_at,
      deleteReason: row.delete_reason || undefined,
      quarantinedStoragePath: row.quarantined_storage_path || undefined,
    }));

    const deletedDocuments: DeletedRecordSummary[] = ((documentsResult.data as DeletedDocumentRow[] | null) || []).map((row) => ({
      tableName: "company_documents",
      recordId: row.id,
      displayName: row.nome,
      subtitle: relationName(row.company_document_folders) || row.arquivo_nome || undefined,
      deletedAt: row.deleted_at,
      deleteReason: row.delete_reason || undefined,
      quarantinedStoragePath: row.quarantined_storage_path || undefined,
    }));

    const response: RecoverySummary = {
      deletedClients,
      deletedPhotos,
      deletedDocuments,
      latestBackup: backupResult.data ? mapBackupRun(backupResult.data) : undefined,
      latestRestoreDrill: restoreDrillResult.data ? mapRestoreDrill(restoreDrillResult.data) : undefined,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao montar o resumo de recuperacao." },
      { status: 500 }
    );
  }
}
