import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { deleteManagedPhoto, isManagedPhotoBucket } from "@/lib/server/photoStorage";
import { requireCronOrAdminRequest } from "@/lib/server/requestGuards";
import { safeErrorMessage } from "@/lib/server/safeError";

type ArchivedPhotoRow = {
  id: string;
  cliente_id: string;
  storage_bucket?: string | null;
  storage_path?: string | null;
  quarantined_bucket?: string | null;
  quarantined_storage_path?: string | null;
};

type ArchivedClientRow = {
  id: string;
  profile_photo_storage_bucket?: string | null;
  profile_photo_storage_path?: string | null;
  profile_photo_quarantined_bucket?: string | null;
  profile_photo_quarantined_path?: string | null;
};

function resolveManagedAssetLocation(
  primaryBucket?: string | null,
  primaryPath?: string | null,
  fallbackBucket?: string | null,
  fallbackPath?: string | null
) {
  return {
    bucket: primaryBucket || fallbackBucket || null,
    path: primaryPath || fallbackPath || null,
  };
}

async function purgeManagedAsset(
  bucket?: string | null,
  path?: string | null
) {
  if (!isManagedPhotoBucket(bucket) || !path) {
    return false;
  }

  await deleteManagedPhoto(bucket, path);
  return true;
}

export async function POST(req: NextRequest) {
  const authResponse = requireCronOrAdminRequest(req);
  if (authResponse) {
    return authResponse;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: archivedPhotos, error: archivedPhotosError } = await supabase
      .from("client_photos")
      .select("id, cliente_id, storage_bucket, storage_path, quarantined_bucket, quarantined_storage_path")
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff);

    if (archivedPhotosError) {
      return NextResponse.json({ error: archivedPhotosError.message }, { status: 500 });
    }

    const purgedPhotoIds = new Set<string>();
    const photoResults: Array<{ photoId: string; clientId: string; assetPurged: boolean; status: string }> = [];

    for (const photo of (archivedPhotos as ArchivedPhotoRow[] | null) || []) {
      try {
        const managedAsset = resolveManagedAssetLocation(
          photo.quarantined_bucket,
          photo.quarantined_storage_path,
          photo.storage_bucket,
          photo.storage_path
        );

        const assetPurged = await purgeManagedAsset(managedAsset.bucket, managedAsset.path);

        const { error: photoDeleteError } = await supabase
          .from("client_photos")
          .delete()
          .eq("id", photo.id);

        if (photoDeleteError) {
          throw photoDeleteError;
        }

        purgedPhotoIds.add(photo.id);
        photoResults.push({ photoId: photo.id, clientId: photo.cliente_id, assetPurged, status: "purged" });
      } catch (err) {
        photoResults.push({
          photoId: photo.id,
          clientId: photo.cliente_id,
          assetPurged: false,
          status: `error: ${err instanceof Error ? err.message : "unknown"}`,
        });
      }
    }

    const { data: clients, error: clientError } = await supabase
      .from("clientes")
      .select("id, profile_photo_storage_bucket, profile_photo_storage_path, profile_photo_quarantined_bucket, profile_photo_quarantined_path")
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff);

    if (clientError) {
      return NextResponse.json({ error: clientError.message }, { status: 500 });
    }

    const results: Array<{ clientId: string; photosPurged: number; avatarPurged: boolean; status: string }> = [];

    for (const client of (clients as ArchivedClientRow[] | null) || []) {
      try {
        let photosPurged = 0;

        const { data: photos, error: photosError } = await supabase
          .from("client_photos")
          .select("id, storage_bucket, storage_path, quarantined_bucket, quarantined_storage_path")
          .eq("cliente_id", client.id);

        if (photosError) {
          throw photosError;
        }

        for (const photo of (photos as ArchivedPhotoRow[] | null) || []) {
          if (!purgedPhotoIds.has(photo.id)) {
            const managedAsset = resolveManagedAssetLocation(
              photo.quarantined_bucket,
              photo.quarantined_storage_path,
              photo.storage_bucket,
              photo.storage_path
            );
            await purgeManagedAsset(managedAsset.bucket, managedAsset.path);
          }
        }

        const { error: photosDeleteError } = await supabase
          .from("client_photos")
          .delete()
          .eq("cliente_id", client.id);

        if (photosDeleteError) throw photosDeleteError;
        photosPurged = (photos || []).length;

        const avatarAsset = resolveManagedAssetLocation(
          client.profile_photo_quarantined_bucket,
          client.profile_photo_quarantined_path,
          client.profile_photo_storage_bucket,
          client.profile_photo_storage_path
        );
        const avatarPurged = await purgeManagedAsset(avatarAsset.bucket, avatarAsset.path);

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

    return NextResponse.json({
      purgedPhotos: photoResults.filter((result) => result.status === "purged").length,
      purgedClients: results.filter((result) => result.status === "purged").length,
      photoResults,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Cleanup failed") },
      { status: 500 }
    );
  }
}
