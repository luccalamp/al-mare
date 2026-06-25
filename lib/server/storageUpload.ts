import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const STORAGE_BUCKETS = {
  gallery: "anamnese-fotos",
  companyDocuments: "company-documents",
  recoveryQuarantine: "recovery-quarantine",
  opsBackups: "ops-backups",
} as const;

export function sanitizeStorageSegment(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "arquivo"
  );
}

export function stripFileExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
}

export function extensionForMimeType(mimeType: string) {
  switch (mimeType.toLowerCase()) {
    case "image/avif":
      return "avif";
    case "image/webp":
      return "webp";
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "application/pdf":
      return "pdf";
    case "text/plain":
      return "txt";
    default:
      return "bin";
  }
}

export function buildStorageObjectReference(storageBucket: string, storagePath: string) {
  return `supabase://${storageBucket}/${storagePath}`;
}

export function buildClientImageStoragePath(input: {
  clientId: string;
  category: string;
  mimeType: string;
  variant?: "main" | "thumb";
}) {
  const extension = extensionForMimeType(input.mimeType);
  const safeCategory = sanitizeStorageSegment(input.category || "referencia");
  const objectId = randomUUID();
  const folder = input.variant === "thumb" ? `${input.clientId}/${safeCategory}/thumbs` : `${input.clientId}/${safeCategory}`;

  return `${folder}/${objectId}.${extension}`;
}

export function buildCompanyDocumentStoragePath(input: {
  folderId: string;
  fileName: string;
  mimeType?: string | null;
}) {
  const extension = input.fileName.split(".").pop()?.toLowerCase();
  const baseName = sanitizeStorageSegment(stripFileExtension(input.fileName));
  const suffix = extension ? `${baseName}.${extension}` : `${baseName}.${extensionForMimeType(input.mimeType || "")}`;

  return `${input.folderId}/${Date.now()}-${randomUUID()}-${suffix}`;
}

export async function uploadPrivateBuffer(
  client: SupabaseClient,
  input: {
    bucket: string;
    path: string;
    buffer: Buffer;
    contentType: string;
    upsert?: boolean;
  }
) {
  const { error } = await client.storage.from(input.bucket).upload(input.path, input.buffer, {
    contentType: input.contentType,
    upsert: input.upsert ?? false,
  });

  if (error) {
    throw error;
  }
}
