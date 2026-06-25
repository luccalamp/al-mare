import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { STORAGE_BUCKETS } from "@/lib/server/storageUpload";

const MANAGED_PHOTO_BUCKETS = new Set<string>([
  STORAGE_BUCKETS.gallery,
  "anamnese-fotos",
]);

function normalizeBucket(bucket?: string | null) {
  return bucket?.trim().toLowerCase() || "";
}

function normalizePath(storagePath?: string | null) {
  return storagePath?.trim() || "";
}

export function isManagedPhotoBucket(bucket?: string | null) {
  return MANAGED_PHOTO_BUCKETS.has(normalizeBucket(bucket));
}

export function resolveManagedPhotoUrl(_bucket?: string | null, _storagePath?: string | null) {
  return null;
}

export async function downloadManagedPhoto(bucket?: string | null, storagePath?: string | null) {
  const normalizedBucket = normalizeBucket(bucket);
  const normalizedPath = normalizePath(storagePath);

  if (!normalizedPath) {
    throw new Error("Caminho da midia ausente.");
  }

  if (!isManagedPhotoBucket(normalizedBucket)) {
    throw new Error(`Storage bucket nao suportado: ${bucket || "desconhecido"}`);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(normalizedBucket).download(normalizedPath);

  if (error || !data) {
    throw error || new Error("Nao foi possivel baixar a imagem.");
  }

  return {
    buffer: Buffer.from(await data.arrayBuffer()),
    contentType: data.type || "image/jpeg",
  };
}

export async function deleteManagedPhoto(bucket?: string | null, storagePath?: string | null) {
  const normalizedBucket = normalizeBucket(bucket);
  const normalizedPath = normalizePath(storagePath);

  if (!normalizedPath) {
    return;
  }

  if (!isManagedPhotoBucket(normalizedBucket)) {
    throw new Error(`Storage bucket nao suportado para remocao: ${bucket || "desconhecido"}`);
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(normalizedBucket).remove([normalizedPath]);
  if (error && !/not found|does not exist/i.test(error.message || "")) {
    throw error;
  }
}
