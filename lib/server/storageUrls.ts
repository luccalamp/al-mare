import type { SupabaseClient } from "@supabase/supabase-js";
import { readServerEnv } from "@/lib/server/supabaseAdmin";

const DEFAULT_SIGNED_URL_EXPIRES_IN = 60 * 60;
const STORAGE_FALLBACK_LABEL = "Imagem temporariamente indisponivel";

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

export function buildStorageUnavailablePlaceholder(label = STORAGE_FALLBACK_LABEL) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200"><rect width="1200" height="1200" rx="48" fill="#f5ede1"/><rect x="120" y="120" width="960" height="960" rx="36" fill="#eadcc8"/><path d="M320 820l180-220 120 140 110-100 150 180H320z" fill="#c49a6c"/><circle cx="470" cy="430" r="70" fill="#b07a45"/><text x="600" y="930" text-anchor="middle" fill="#7a4921" font-family="Arial, sans-serif" font-size="44">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
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
      console.error("Failed to create signed storage URL.");
    }

    return null;
  }

  return data.signedUrl;
}
