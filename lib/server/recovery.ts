import type { RecoverableTableName, RestoreOperationResult, RowChangeAuditEntry } from "@/types";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

const QUARANTINE_BUCKET = "recovery-quarantine";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
type StorageMoveResult = {
  restoredStorage: boolean;
  targetBucket?: string;
  targetPath?: string;
};

type AuditRpcRow = {
  audit_id: number | string;
  table_name: string;
  operation: string;
  changed_at: string;
  transaction_id: number | string;
  jwt_subject?: string | null;
  jwt_role?: string | null;
  record_identity?: unknown;
  old_record?: unknown;
  new_record?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function resolveSnapshotId(snapshot: Record<string, unknown>) {
  const id = asString(snapshot.id);
  if (!id) {
    throw new Error("O snapshot auditado nao possui um id valido.");
  }

  return id;
}

function buildQuarantinePath(kind: string, recordId: string, sourcePath?: string | null) {
  const fileName = sourcePath?.split("/").filter(Boolean).pop() || `${recordId}.bin`;
  return `${kind}/${recordId}/${Date.now()}-${fileName}`;
}

async function removeIfExists(supabase: SupabaseAdminClient, bucket: string, path: string) {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error && !/not found|does not exist/i.test(error.message || "")) {
    throw error;
  }
}

async function moveObject(
  supabase: SupabaseAdminClient,
  sourceBucket: string,
  sourcePath: string,
  targetBucket: string,
  targetPath: string
) {
  const { data, error } = await supabase.storage.from(sourceBucket).download(sourcePath);
  if (error) {
    if (/not found|does not exist/i.test(error.message || "")) {
      return { restoredStorage: false, targetBucket, targetPath };
    }
    throw error;
  }

  const fileBuffer = Buffer.from(await data.arrayBuffer());
  const contentType = data.type || undefined;
  const { error: uploadError } = await supabase.storage.from(targetBucket).upload(targetPath, fileBuffer, {
    contentType,
    upsert: true,
  });
  if (uploadError) {
    throw uploadError;
  }

  await removeIfExists(supabase, sourceBucket, sourcePath);

  return {
    restoredStorage: true,
    targetBucket,
    targetPath,
  };
}

function normalizeAuditEntry(row: AuditRpcRow): RowChangeAuditEntry {
  return {
    auditId: Number(row.audit_id),
    tableName: row.table_name,
    operation: row.operation,
    changedAt: row.changed_at,
    transactionId: Number(row.transaction_id),
    jwtSubject: row.jwt_subject || undefined,
    jwtRole: row.jwt_role || undefined,
    recordIdentity: asRecord(row.record_identity) || {},
    oldRecord: asRecord(row.old_record),
    newRecord: asRecord(row.new_record),
  };
}

export async function listAuditEntries(
  tableName?: string,
  recordIdentity?: Record<string, unknown>,
  transactionId?: number,
  limit = 50
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("admin_list_row_change_audit", {
    p_table_name: tableName || null,
    p_record_identity: recordIdentity || null,
    p_transaction_id: transactionId ?? null,
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  return ((data as AuditRpcRow[] | null) || []).map(normalizeAuditEntry);
}

async function fetchAuditSnapshot(tableName: RecoverableTableName, recordId: string) {
  const entries = await listAuditEntries(tableName, { id: recordId }, undefined, 80);

  for (const entry of entries) {
    if (entry.newRecord) {
      return { snapshot: entry.newRecord, entries };
    }

    if (entry.oldRecord) {
      return { snapshot: entry.oldRecord, entries };
    }
  }

  throw new Error("Nao encontrei snapshot suficiente no log de auditoria para restaurar este registro.");
}

async function restoreClientStorage(
  supabase: SupabaseAdminClient,
  row: Record<string, unknown>
): Promise<StorageMoveResult> {
  const storageBucket = asString(row.profile_photo_storage_bucket) || "anamnese-fotos";
  const storagePath = asString(row.profile_photo_storage_path);
  const quarantinedBucket = asString(row.profile_photo_quarantined_bucket) || QUARANTINE_BUCKET;
  const quarantinedPath = asString(row.profile_photo_quarantined_path);

  if (["google-drive", "cloudinary"].includes(storageBucket.toLowerCase())) {
    return { restoredStorage: false, targetBucket: storageBucket, targetPath: storagePath };
  }

  if (!storagePath || !quarantinedPath) {
    return { restoredStorage: false, targetBucket: storageBucket, targetPath: storagePath };
  }

  return moveObject(supabase, quarantinedBucket, quarantinedPath, storageBucket, storagePath);
}

async function restorePhotoStorage(
  supabase: SupabaseAdminClient,
  row: Record<string, unknown>
): Promise<StorageMoveResult> {
  const storageBucket = asString(row.storage_bucket) || "anamnese-fotos";
  const storagePath = asString(row.storage_path);
  const quarantinedBucket = asString(row.quarantined_bucket) || QUARANTINE_BUCKET;
  const quarantinedPath = asString(row.quarantined_storage_path);

  if (["google-drive", "cloudinary"].includes(storageBucket.toLowerCase())) {
    return { restoredStorage: false, targetBucket: storageBucket, targetPath: storagePath };
  }

  if (!storagePath || !quarantinedPath) {
    return { restoredStorage: false, targetBucket: storageBucket, targetPath: storagePath };
  }

  return moveObject(supabase, quarantinedBucket, quarantinedPath, storageBucket, storagePath);
}

async function restoreDocumentStorage(
  supabase: SupabaseAdminClient,
  row: Record<string, unknown>
): Promise<StorageMoveResult> {
  const storageBucket = asString(row.storage_bucket) || "company-documents";
  const storagePath = asString(row.storage_path);
  const quarantinedBucket = asString(row.quarantined_bucket) || QUARANTINE_BUCKET;
  const quarantinedPath = asString(row.quarantined_storage_path);

  if (!storagePath || !quarantinedPath) {
    return { restoredStorage: false, targetBucket: storageBucket, targetPath: storagePath };
  }

  return moveObject(supabase, quarantinedBucket, quarantinedPath, storageBucket, storagePath);
}

function buildClientPayload(snapshot: Record<string, unknown>, actor: string) {
  return {
    id: resolveSnapshotId(snapshot),
    user_id: asNullableString(snapshot.user_id),
    nome: asString(snapshot.nome) || "Paciente restaurado",
    whatsapp: asString(snapshot.whatsapp) || "Nao informado",
    instagram_handle: asNullableString(snapshot.instagram_handle),
    data_aniversario: asNullableString(snapshot.data_aniversario),
    created_at: asString(snapshot.created_at) || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    photo_url: asNullableString(snapshot.photo_url),
    canal_aquisicao: asNullableString(snapshot.canal_aquisicao),
    token_pre_consulta: asNullableString(snapshot.token_pre_consulta),
    link_ativo: typeof snapshot.link_ativo === "boolean" ? snapshot.link_ativo : false,
    pre_consulta_respondida_em: asNullableString(snapshot.pre_consulta_respondida_em),
    perfil_complementar: snapshot.perfil_complementar ?? {},
    deleted_at: null,
    deleted_by: null,
    delete_reason: null,
    restored_at: new Date().toISOString(),
    restored_by: actor,
    profile_photo_storage_bucket: asString(snapshot.profile_photo_storage_bucket) || "anamnese-fotos",
    profile_photo_storage_path:
      asNullableString(snapshot.profile_photo_storage_path) || asNullableString(snapshot.photo_url) || null,
    profile_photo_quarantined_bucket: asNullableString(snapshot.profile_photo_quarantined_bucket),
    profile_photo_quarantined_path: asNullableString(snapshot.profile_photo_quarantined_path),
  };
}

function buildClientPhotoPayload(snapshot: Record<string, unknown>, actor: string) {
  return {
    id: resolveSnapshotId(snapshot),
    organization_id: asNullableString(snapshot.organization_id),
    user_id: asNullableString(snapshot.user_id),
    cliente_id: asString(snapshot.cliente_id),
    url: asString(snapshot.url) || "",
    type: asNullableString(snapshot.type),
    caption: asNullableString(snapshot.caption),
    created_at: asString(snapshot.created_at) || new Date().toISOString(),
    anotacao_tecnica: asNullableString(snapshot.anotacao_tecnica),
    captured_at: asNullableString(snapshot.captured_at),
    updated_at: new Date().toISOString(),
    categoria: asNullableString(snapshot.categoria),
    deleted_at: null,
    deleted_by: null,
    delete_reason: null,
    restored_at: new Date().toISOString(),
    restored_by: actor,
    storage_bucket: asString(snapshot.storage_bucket) || "anamnese-fotos",
    storage_path: asNullableString(snapshot.storage_path),
    quarantined_bucket: asNullableString(snapshot.quarantined_bucket),
    quarantined_storage_path: asNullableString(snapshot.quarantined_storage_path),
  };
}

function buildCompanyDocumentPayload(snapshot: Record<string, unknown>, actor: string) {
  return {
    id: resolveSnapshotId(snapshot),
    organization_id: asNullableString(snapshot.organization_id),
    user_id: asNullableString(snapshot.user_id),
    folder_id: asString(snapshot.folder_id),
    nome: asString(snapshot.nome) || "Documento restaurado",
    arquivo_nome: asString(snapshot.arquivo_nome) || "arquivo-restaurado",
    mime_type: asNullableString(snapshot.mime_type),
    tamanho_bytes: Number(snapshot.tamanho_bytes || 0),
    storage_path: asString(snapshot.storage_path) || "",
    public_url: asString(snapshot.public_url) || "",
    created_at: asString(snapshot.created_at) || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    deleted_by: null,
    delete_reason: null,
    restored_at: new Date().toISOString(),
    restored_by: actor,
    storage_bucket: asString(snapshot.storage_bucket) || "company-documents",
    quarantined_bucket: asNullableString(snapshot.quarantined_bucket),
    quarantined_storage_path: asNullableString(snapshot.quarantined_storage_path),
  };
}

async function ensureClientExistsFromAudit(supabase: SupabaseAdminClient, recordId: string, actor: string) {
  const { snapshot } = await fetchAuditSnapshot("clientes", recordId);
  const payload = buildClientPayload(snapshot, actor);
  const { error } = await supabase.from("clientes").upsert(payload, { onConflict: "id" });
  if (error) {
    throw error;
  }

  return payload;
}

async function ensurePhotoExistsFromAudit(supabase: SupabaseAdminClient, recordId: string, actor: string) {
  const { snapshot } = await fetchAuditSnapshot("client_photos", recordId);
  const payload = buildClientPhotoPayload(snapshot, actor);
  if (!payload.cliente_id) {
    throw new Error("A foto auditada nao possui cliente vinculado para restauracao.");
  }

  await ensureClientExistsFromAudit(supabase, payload.cliente_id, actor);
  const { error } = await supabase.from("client_photos").upsert(payload, { onConflict: "id" });
  if (error) {
    throw error;
  }

  return payload;
}

async function ensureDocumentExistsFromAudit(supabase: SupabaseAdminClient, recordId: string, actor: string) {
  const { snapshot } = await fetchAuditSnapshot("company_documents", recordId);
  const payload = buildCompanyDocumentPayload(snapshot, actor);
  const { error } = await supabase.from("company_documents").upsert(payload, { onConflict: "id" });
  if (error) {
    throw error;
  }

  return payload;
}

async function restoreClientRecord(supabase: SupabaseAdminClient, recordId: string, actor: string): Promise<RestoreOperationResult> {
  const currentResult = await supabase
    .from("clientes")
    .select("*")
    .eq("id", recordId)
    .maybeSingle();

  if (currentResult.error) {
    throw currentResult.error;
  }

  const currentRow = currentResult.data || (await ensureClientExistsFromAudit(supabase, recordId, actor));
  const storageResult = await restoreClientStorage(supabase, currentRow);

  const { error } = await supabase
    .from("clientes")
    .update({
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
      restored_at: new Date().toISOString(),
      restored_by: actor,
      profile_photo_quarantined_bucket: null,
      profile_photo_quarantined_path: null,
    })
    .eq("id", recordId);

  if (error) {
    throw error;
  }

  const { error: photoRestoreError } = await supabase
    .from("client_photos")
    .update({
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
      restored_at: new Date().toISOString(),
      restored_by: actor,
    })
    .eq("cliente_id", recordId);

  if (photoRestoreError) {
    throw photoRestoreError;
  }

  return {
    tableName: "clientes",
    recordId,
    restoredFromAudit: !currentResult.data,
    restoredStorage: storageResult.restoredStorage,
  };
}

async function restorePhotoRecord(supabase: SupabaseAdminClient, recordId: string, actor: string): Promise<RestoreOperationResult> {
  const currentResult = await supabase
    .from("client_photos")
    .select("*")
    .eq("id", recordId)
    .maybeSingle();

  if (currentResult.error) {
    throw currentResult.error;
  }

  const currentRow = currentResult.data || (await ensurePhotoExistsFromAudit(supabase, recordId, actor));
  const clientId = asString(currentRow.cliente_id);
  if (!clientId) {
    throw new Error("A foto nao possui cliente vinculado para restauração.");
  }

  await ensureClientExistsFromAudit(supabase, clientId, actor);
  const storageResult = await restorePhotoStorage(supabase, currentRow);

  const { error } = await supabase
    .from("client_photos")
    .update({
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
      restored_at: new Date().toISOString(),
      restored_by: actor,
      quarantined_bucket: null,
      quarantined_storage_path: null,
    })
    .eq("id", recordId);

  if (error) {
    throw error;
  }

  return {
    tableName: "client_photos",
    recordId,
    restoredFromAudit: !currentResult.data,
    restoredStorage: storageResult.restoredStorage,
  };
}

async function restoreDocumentRecord(supabase: SupabaseAdminClient, recordId: string, actor: string): Promise<RestoreOperationResult> {
  const currentResult = await supabase
    .from("company_documents")
    .select("*")
    .eq("id", recordId)
    .maybeSingle();

  if (currentResult.error) {
    throw currentResult.error;
  }

  const currentRow = currentResult.data || (await ensureDocumentExistsFromAudit(supabase, recordId, actor));
  const storageResult = await restoreDocumentStorage(supabase, currentRow);

  const { error } = await supabase
    .from("company_documents")
    .update({
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
      restored_at: new Date().toISOString(),
      restored_by: actor,
      quarantined_bucket: null,
      quarantined_storage_path: null,
    })
    .eq("id", recordId);

  if (error) {
    throw error;
  }

  return {
    tableName: "company_documents",
    recordId,
    restoredFromAudit: !currentResult.data,
    restoredStorage: storageResult.restoredStorage,
  };
}

export async function restoreRecord(tableName: RecoverableTableName, recordId: string, actor: string) {
  const supabase = createSupabaseAdminClient();

  if (tableName === "clientes") {
    return restoreClientRecord(supabase, recordId, actor);
  }

  if (tableName === "client_photos") {
    return restorePhotoRecord(supabase, recordId, actor);
  }

  return restoreDocumentRecord(supabase, recordId, actor);
}

export async function restoreTransaction(transactionId: number, actor: string) {
  const entries = await listAuditEntries(undefined, undefined, transactionId, 250);
  const recoverableTables: RecoverableTableName[] = ["clientes", "client_photos", "company_documents"];
  const pending = new Map<string, RecoverableTableName>();

  for (const entry of entries) {
    if (!recoverableTables.includes(entry.tableName as RecoverableTableName)) {
      continue;
    }

    const recordId = asString(entry.recordIdentity.id);
    if (!recordId) {
      continue;
    }

    const tableName = entry.tableName as RecoverableTableName;
    pending.set(`${tableName}:${recordId}`, tableName);
  }

  const orderedKeys = Array.from(pending.keys()).sort((left, right) => {
    const [leftTable] = left.split(":") as [RecoverableTableName, string];
    const [rightTable] = right.split(":") as [RecoverableTableName, string];
    return ["clientes", "client_photos", "company_documents"].indexOf(leftTable) - ["clientes", "client_photos", "company_documents"].indexOf(rightTable);
  });

  const results: RestoreOperationResult[] = [];
  for (const key of orderedKeys) {
    const [tableName, recordId] = key.split(":") as [RecoverableTableName, string];
    results.push(await restoreRecord(tableName, recordId, actor));
  }

  return results;
}

async function archiveClientPhotoRow(
  supabase: SupabaseAdminClient,
  photoRow: Record<string, unknown>,
  actor: string,
  reason: string
) {
  const photoId = asString(photoRow.id);
  if (!photoId) {
    throw new Error("A foto selecionada nao possui id valido.");
  }

  console.log("archiveClientPhotoRow: marking photo as deleted", photoId);

  const { error: markDeletedError, count } = await supabase
    .from("client_photos")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: actor,
      delete_reason: reason,
      restored_at: null,
      restored_by: null,
    })
    .eq("id", photoId)
    .select("id")
    .single();

  if (markDeletedError) {
    console.error("archiveClientPhotoRow: mark deleted error", markDeletedError);
    throw markDeletedError;
  }

  if (count === 0) {
    console.error("archiveClientPhotoRow: update affected 0 rows", photoId);
    throw new Error("A foto nao foi encontrada ou nao pode ser arquivada.");
  }

  console.log("archiveClientPhotoRow: photo marked as deleted", photoId);

  const storageBucket = asString(photoRow.storage_bucket) || "anamnese-fotos";
  const storagePath = asString(photoRow.storage_path);
  if (["google-drive", "cloudinary"].includes(storageBucket.toLowerCase())) {
    console.log("archiveClientPhotoRow: external-backed photo, skipping quarantine", photoId);
    return;
  }

  if (!storagePath) {
    console.log("archiveClientPhotoRow: no storage path, skipping quarantine", photoId);
    return;
  }

  console.log("archiveClientPhotoRow: moving photo to quarantine", photoId, storageBucket, storagePath);

  const quarantineResult = await moveObject(
    supabase,
    storageBucket,
    storagePath,
    QUARANTINE_BUCKET,
    buildQuarantinePath("client-photos", photoId, storagePath)
  );

  console.log("archiveClientPhotoRow: quarantine result", quarantineResult);

  const { error: quarantineUpdateError } = await supabase
    .from("client_photos")
    .update({
      quarantined_bucket: quarantineResult.targetBucket || QUARANTINE_BUCKET,
      quarantined_storage_path: quarantineResult.targetPath || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", photoId)
    .select("id")
    .single();

  if (quarantineUpdateError) {
    console.error("archiveClientPhotoRow: quarantine update error", quarantineUpdateError);
    throw quarantineUpdateError;
  }

  console.log("archiveClientPhotoRow: photo quarantine metadata updated", photoId);
}

export async function archivePhoto(recordId: string, actor: string, reason: string) {
  const supabase = createSupabaseAdminClient();
  console.log("archivePhoto: fetching photo", recordId);
  const { data, error } = await supabase.from("client_photos").select("*").eq("id", recordId).maybeSingle();
  if (error) {
    console.error("archivePhoto: select error", error);
    throw error;
  }

  if (!data) {
    console.error("archivePhoto: photo not found", recordId);
    throw new Error("A foto selecionada nao foi encontrada.");
  }

  console.log("archivePhoto: photo found", data.id, "deleted_at:", data.deleted_at);

  if (data.deleted_at) {
    console.log("archivePhoto: photo already archived", recordId);
    return { archived: true, recordId };
  }

  console.log("archivePhoto: archiving photo", recordId);
  await archiveClientPhotoRow(supabase, data, actor, reason);
  console.log("archivePhoto: photo archived successfully", recordId);
  return { archived: true, recordId };
}

export async function archiveDocument(recordId: string, actor: string, reason: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("company_documents").select("*").eq("id", recordId).maybeSingle();
  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("O documento selecionado nao foi encontrado.");
  }

  if (data.deleted_at) {
    return { archived: true, recordId };
  }

  const { error: markDeletedError } = await supabase
    .from("company_documents")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: actor,
      delete_reason: reason,
      restored_at: null,
      restored_by: null,
    })
    .eq("id", recordId);

  if (markDeletedError) {
    throw markDeletedError;
  }

  const storageBucket = asString(data.storage_bucket) || "company-documents";
  const storagePath = asString(data.storage_path);
  if (storagePath) {
    const quarantineResult = await moveObject(
      supabase,
      storageBucket,
      storagePath,
      QUARANTINE_BUCKET,
      buildQuarantinePath("company-documents", recordId, storagePath)
    );

    const { error: quarantineUpdateError } = await supabase
      .from("company_documents")
      .update({
        quarantined_bucket: quarantineResult.targetBucket || QUARANTINE_BUCKET,
        quarantined_storage_path: quarantineResult.targetPath || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordId);

    if (quarantineUpdateError) {
      throw quarantineUpdateError;
    }
  }

  return { archived: true, recordId };
}

export async function archiveClient(recordId: string, actor: string, reason: string) {
  const supabase = createSupabaseAdminClient();
  console.log("archiveClient: fetching client", recordId);
  const clientResult = await supabase.from("clientes").select("*").eq("id", recordId).maybeSingle();
  if (clientResult.error) {
    console.error("archiveClient: select error", clientResult.error);
    throw clientResult.error;
  }

  const clientRow = clientResult.data;
  if (!clientRow) {
    console.error("archiveClient: client not found", recordId);
    throw new Error("A paciente selecionada nao foi encontrada.");
  }

  console.log("archiveClient: client found", clientRow.id, "deleted_at:", clientRow.deleted_at);

  if (!clientRow.deleted_at) {
    console.log("archiveClient: marking client as deleted", recordId);
    const { error: markClientDeletedError, count: clientCount } = await supabase
      .from("clientes")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: actor,
        delete_reason: reason,
        restored_at: null,
        restored_by: null,
        link_ativo: false,
      })
      .eq("id", recordId)
      .select("id")
      .single();

    if (markClientDeletedError) {
      console.error("archiveClient: mark deleted error", markClientDeletedError);
      throw markClientDeletedError;
    }
    if (clientCount === 0) {
      console.error("archiveClient: update affected 0 rows", recordId);
      throw new Error("A paciente nao foi encontrada ou nao pode ser arquivada.");
    }
    console.log("archiveClient: client marked as deleted", recordId);
  }

  const avatarStorageBucket = asString(clientRow.profile_photo_storage_bucket) || "anamnese-fotos";
  const avatarStoragePath = asString(clientRow.profile_photo_storage_path);
  if (avatarStoragePath) {
    console.log("archiveClient: moving avatar to quarantine", recordId);
    const quarantineResult = await moveObject(
      supabase,
      avatarStorageBucket,
      avatarStoragePath,
      QUARANTINE_BUCKET,
      buildQuarantinePath("client-avatar", recordId, avatarStoragePath)
    );

    const { error: avatarUpdateError } = await supabase
      .from("clientes")
      .update({
        profile_photo_quarantined_bucket: quarantineResult.targetBucket || QUARANTINE_BUCKET,
        profile_photo_quarantined_path: quarantineResult.targetPath || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordId)
      .select("id")
      .single();

    if (avatarUpdateError) {
      console.error("archiveClient: avatar update error", avatarUpdateError);
      throw avatarUpdateError;
    }
  }

  console.log("archiveClient: fetching photos for client", recordId);
  const photosResult = await supabase
    .from("client_photos")
    .select("*")
    .eq("cliente_id", recordId)
    .is("deleted_at", null);

  if (photosResult.error) {
    console.error("archiveClient: photos select error", photosResult.error);
    throw photosResult.error;
  }

  console.log("archiveClient: found", (photosResult.data || []).length, "photos to archive");

  for (const photoRow of photosResult.data || []) {
    await archiveClientPhotoRow(supabase, photoRow, actor, reason);
  }

  console.log("archiveClient: client archived successfully", recordId);

  return {
    archived: true,
    recordId,
    archivedPhotos: (photosResult.data || []).length,
  };
}
