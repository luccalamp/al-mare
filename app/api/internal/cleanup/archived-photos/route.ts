import { NextRequest, NextResponse } from "next/server";
import { getCronSecret, createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { deleteManagedPhoto, isManagedPhotoBucket } from "@/lib/server/photoStorage";

export async function POST(req: NextRequest) {
  const cronSecret = getCronSecret();
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");

  if (!cronSecret || authHeader !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: clients, error: clientError } = await supabase
      .from("clientes")
      .select("id, profile_photo_storage_bucket, profile_photo_storage_path")
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff);

    if (clientError) {
      return NextResponse.json({ error: clientError.message }, { status: 500 });
    }

    const results: Array<{ clientId: string; photosPurged: number; avatarPurged: boolean; status: string }> = [];

    for (const client of clients || []) {
      try {
        let photosPurged = 0;

        const { data: photos } = await supabase
          .from("client_photos")
          .select("id, storage_bucket, storage_path")
          .eq("cliente_id", client.id);

        for (const photo of photos || []) {
          if (isManagedPhotoBucket(photo.storage_bucket) && photo.storage_path) {
            try {
              await deleteManagedPhoto(photo.storage_bucket, photo.storage_path);
            } catch {
              // file may already be gone
            }
          }
        }

        const { error: photosDeleteError } = await supabase
          .from("client_photos")
          .delete()
          .eq("cliente_id", client.id);

        if (photosDeleteError) throw photosDeleteError;
        photosPurged = (photos || []).length;

        let avatarPurged = false;
        if (isManagedPhotoBucket(client.profile_photo_storage_bucket) && client.profile_photo_storage_path) {
          try {
            await deleteManagedPhoto(client.profile_photo_storage_bucket, client.profile_photo_storage_path);
            avatarPurged = true;
          } catch {
            // file may already be gone
          }
        }

        const { error: clientDeleteError } = await supabase
          .from("clientes")
          .delete()
          .eq("id", client.id);

        if (clientDeleteError) throw clientDeleteError;

        results.push({ clientId: client.id, photosPurged, avatarPurged, status: "purged" });
      } catch (err) {
        results.push({ clientId: client.id, photosPurged: 0, avatarPurged: false, status: `error: ${err instanceof Error ? err.message : "unknown"}` });
      }
    }

    return NextResponse.json({ purged: results.filter(r => r.status === "purged").length, results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}
