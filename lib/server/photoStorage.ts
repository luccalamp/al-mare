import { buildR2ProxyUrl, deleteFromR2, downloadFromR2, getR2StorageBucketLabel } from "@/lib/server/r2";
import { buildS3ProxyUrl, deleteFromS3, downloadFromS3, getS3StorageBucketLabel } from "@/lib/server/s3";

function normalizeBucket(bucket?: string | null) {
  return bucket?.trim().toLowerCase() || "";
}

export function isManagedPhotoBucket(bucket?: string | null) {
  const normalizedBucket = normalizeBucket(bucket);
  return normalizedBucket === getR2StorageBucketLabel()
    || normalizedBucket === getS3StorageBucketLabel();
}

export function resolveManagedPhotoUrl(bucket?: string | null, storagePath?: string | null) {
  const normalizedBucket = normalizeBucket(bucket);
  const normalizedPath = storagePath?.trim();

  if (!normalizedPath) {
    return null;
  }

  if (normalizedBucket === getR2StorageBucketLabel()) {
    return buildR2ProxyUrl(normalizedPath);
  }

  if (normalizedBucket === getS3StorageBucketLabel()) {
    return buildS3ProxyUrl(normalizedPath);
  }

  return null;
}

export async function downloadManagedPhoto(bucket?: string | null, storagePath?: string | null) {
  const normalizedBucket = normalizeBucket(bucket);
  const normalizedPath = storagePath?.trim();

  if (!normalizedPath) {
    throw new Error("Caminho da midia ausente.");
  }

  if (normalizedBucket === getR2StorageBucketLabel()) {
    return downloadFromR2(normalizedPath);
  }

  if (normalizedBucket === getS3StorageBucketLabel()) {
    return downloadFromS3(normalizedPath);
  }

  throw new Error(`Storage bucket nao suportado: ${bucket || "desconhecido"}`);
}

export async function deleteManagedPhoto(bucket?: string | null, storagePath?: string | null) {
  const normalizedBucket = normalizeBucket(bucket);
  const normalizedPath = storagePath?.trim();

  if (!normalizedPath) {
    return;
  }

  if (normalizedBucket === getR2StorageBucketLabel()) {
    await deleteFromR2(normalizedPath);
    return;
  }

  if (normalizedBucket === getS3StorageBucketLabel()) {
    await deleteFromS3(normalizedPath);
    return;
  }

  throw new Error(`Storage bucket nao suportado para remocao: ${bucket || "desconhecido"}`);
}