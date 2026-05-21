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
  const fallbackUrl = options.fallbackUrl?.trim() || buildStorageObjectPublicUrl(storageBucket, storagePath);

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

    return fallbackUrl;
  }

  return data.signedUrl;
}