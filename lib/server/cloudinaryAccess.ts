import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

export type CloudinaryPhotoRecord = {
  id: string;
  clientId: string;
};

export async function findCloudinaryPhotoRecordByPublicId(publicId: string) {
  const normalizedPublicId = publicId.trim();
  if (!normalizedPublicId) {
    return { data: null, error: null };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("client_photos")
    .select("id, cliente_id")
    .eq("storage_bucket", "cloudinary")
    .eq("storage_path", normalizedPublicId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data?.id || !data?.cliente_id) {
    return {
      data: null,
      error,
    };
  }

  return {
    data: {
      id: data.id,
      clientId: data.cliente_id,
    } satisfies CloudinaryPhotoRecord,
    error: null,
  };
}