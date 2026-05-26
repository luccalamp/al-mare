import { buildS3ProxyUrl, deleteFromS3, downloadFromS3, getS3StorageBucketLabel } from "@/lib/server/s3";

function normalizeBucket(bucket?: string | null) {
  return bucket?.trim().toLowerCase() || "";
}

function isS3CompatibleBucket(bucket?: string | null) {
  const normalizedBucket = normalizeBucket(bucket);
  return normalizedBucket === getS3StorageBucketLabel() || normalizedBucket === "r2";
}

export function isManagedPhotoBucket(bucket?: string | null) {
  return isS3CompatibleBucket(bucket);
}

export function resolveManagedPhotoUrl(bucket?: string | null, storagePath?: string | null) {
  const normalizedPath = storagePath?.trim();

  if (!normalizedPath) {
    return null;
  }

  if (isS3CompatibleBucket(bucket)) {
    return buildS3ProxyUrl(normalizedPath);
  }

  return null;
}

export async function downloadManagedPhoto(bucket?: string | null, storagePath?: string | null) {
  const normalizedPath = storagePath?.trim();

  if (!normalizedPath) {
    throw new Error("Caminho da midia ausente.");
  }

  if (isS3CompatibleBucket(bucket)) {
    return downloadFromS3(normalizedPath);
  }

  throw new Error(`Storage bucket nao suportado: ${bucket || "desconhecido"}`);
}

export async function deleteManagedPhoto(bucket?: string | null, storagePath?: string | null) {
  const normalizedPath = storagePath?.trim();

  if (!normalizedPath) {
    return;
  }

  if (isS3CompatibleBucket(bucket)) {
    await deleteFromS3(normalizedPath);
    return;
  }

  throw new Error(`Storage bucket nao suportado para remocao: ${bucket || "desconhecido"}`);
}