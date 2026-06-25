import type { SupabaseClient } from "@supabase/supabase-js";
import { readServerEnv } from "@/lib/server/supabaseAdmin";

const DEFAULT_SIGNED_URL_EXPIRES_IN = 60 * 60;

function encodeStoragePath(storagePath: string) {
  return storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function buildStorageObjectPublicUrl(storageBucket?: string | null, storagePath?: string | null) {
  const supabaseUrl = readServerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const normalizedBucket = storageBucket?.trim();
  const normalizedPath = storagePath?.trim();

  if (!supabaseUrl || !normalizedBucket || !normalizedPath) {
    return null;
  }

  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${encodeURIComponent(normalizedBucket)}/${encodeStoragePath(normalizedPath)}`;
}

export function buildStorageUnavailablePlaceholder() {
  return "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='420' viewBox='0 0 640 420'%3E%3Crect width='640' height='420' fill='%23f4efe7'/%3E%3Ctext x='50%25' y='48%25' dominant-baseline='middle' text-anchor='middle' fill='%23706a5f' font-family='Arial,sans-serif' font-size='22'%3EImagem indisponivel%3C/text%3E%3Ctext x='50%25' y='57%25' dominant-baseline='middle' text-anchor='middle' fill='%238c8578' font-family='Arial,sans-serif' font-size='15'%3ETente recarregar ou reenviar a foto.%3C/text%3E%3C/svg%3E";
}

export async function createSignedStorageUrl(
  client: SupabaseClient,
  options: {
    storageBucket?: string | null;
    storagePath?: string | null;
    fallbackUrl?: string | null;
    expiresIn?: number;
  }
) {
  const storageBucket = options.storageBucket?.trim();
  const storagePath = options.storagePath?.trim();
  const fallbackUrl = options.fallbackUrl?.trim() || null;

  if (!storageBucket || !storagePath) {
    return fallbackUrl;
  }

  const { data, error } = await client.storage
    .from(storageBucket)
    .createSignedUrl(storagePath, options.expiresIn ?? DEFAULT_SIGNED_URL_EXPIRES_IN);

  if (error || !data?.signedUrl) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to create signed storage URL:", {
        storageBucket,
        storagePath,
        error,
      });
    }

    return null;
  }

  return data.signedUrl;
}
