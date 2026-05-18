import type { SupabaseClient } from "@supabase/supabase-js";

type CreateSignedUrlOptions = {
  storageBucket: string;
  storagePath: string;
  fallbackUrl?: string;
  expiresIn?: number;
};

export async function createSignedStorageUrl(
  supabase: SupabaseClient,
  options: CreateSignedUrlOptions
): Promise<string> {
  const { storageBucket, storagePath, fallbackUrl, expiresIn = 3600 } = options;

  if (!storageBucket || !storagePath) {
    return fallbackUrl ?? "";
  }

  const { data, error } = await supabase.storage
    .from(storageBucket)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    return fallbackUrl ?? "";
  }

  return data.signedUrl;
}
