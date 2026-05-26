import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

export type StoredPhotoRecord = {
  id: string;
  clientId: string;
  storageBucket: string;
  storagePath: string;
};

export async function findPhotoRecordByUrl(proxyUrl: string) {
  const normalizedUrl = proxyUrl.trim();
  if (!normalizedUrl) {
    return { data: null, error: null };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("client_photos")
    .select("id, cliente_id, storage_bucket, storage_path")
    .eq("url", normalizedUrl)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data?.id || !data?.cliente_id || !data.storage_bucket || !data.storage_path) {
    return {
      data: null,
      error,
    };
  }

  return {
    data: {
      id: data.id,
      clientId: data.cliente_id,
      storageBucket: data.storage_bucket,
      storagePath: data.storage_path,
    } satisfies StoredPhotoRecord,
    error: null,
  };
}

export async function findPhotoRecordByStoragePath(storagePath: string) {
  const normalizedPath = storagePath.trim();
  if (!normalizedPath) {
    return { data: null, error: null };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("client_photos")
    .select("id, cliente_id, storage_bucket, storage_path")
    .eq("storage_path", normalizedPath)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.id || !data?.cliente_id || !data.storage_bucket || !data.storage_path) {
    return {
      data: null,
      error,
    };
  }

  return {
    data: {
      id: data.id,
      clientId: data.cliente_id,
      storageBucket: data.storage_bucket,
      storagePath: data.storage_path,
    } satisfies StoredPhotoRecord,
    error: null,
  };
}