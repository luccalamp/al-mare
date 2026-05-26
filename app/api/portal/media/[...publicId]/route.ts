import { NextResponse } from "next/server";
import { normalizeStoragePathFromRoute } from "@/lib/server/mediaProxy";
import { findPhotoRecordByStoragePath } from "@/lib/server/photoStorageAccess";
import { downloadManagedPhoto, isManagedPhotoBucket } from "@/lib/server/photoStorage";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMissingColumnError(message?: string) {
  return /column .* does not exist/i.test(message || "");
}

export async function GET(request: Request, { params }: { params: { publicId: string[] } }) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token")?.trim();

    if (!token || !UUID_PATTERN.test(token)) {
      return NextResponse.json({ error: "Imagem nao encontrada." }, { status: 404 });
    }

    const storagePath = normalizeStoragePathFromRoute(params.publicId);
    if (!storagePath) {
      return NextResponse.json({ error: "Imagem nao encontrada." }, { status: 404 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: portalClient, error: portalClientError } = await supabase
      .from("clientes")
      .select("id, portal_active")
      .eq("portal_token", token)
      .is("deleted_at", null)
      .maybeSingle();

    if (portalClientError) {
      if (isMissingColumnError(portalClientError.message)) {
        return NextResponse.json({ error: "Portal indisponivel." }, { status: 503 });
      }

      console.error("[portal-media] Failed to validate portal token", portalClientError);
      return NextResponse.json({ error: "Nao foi possivel validar a imagem agora." }, { status: 500 });
    }

    if (!portalClient || portalClient.portal_active === false) {
      return NextResponse.json({ error: "Imagem nao encontrada." }, { status: 404 });
    }

    const { data: photoRecord, error: photoLookupError } = await findPhotoRecordByStoragePath(storagePath);
    if (photoLookupError) {
      console.error("[portal-media] Failed to load photo reference", photoLookupError);
      return NextResponse.json({ error: "Nao foi possivel validar a imagem agora." }, { status: 500 });
    }

    if (!photoRecord || photoRecord.clientId !== portalClient.id || !isManagedPhotoBucket(photoRecord.storageBucket)) {
      return NextResponse.json({ error: "Imagem nao encontrada." }, { status: 404 });
    }

    const downloaded = await downloadManagedPhoto(photoRecord.storageBucket, photoRecord.storagePath);
    const body = new Uint8Array(downloaded.buffer);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": downloaded.contentType || "image/jpeg",
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Length": downloaded.buffer.byteLength.toString(),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[portal-media] Unexpected error", error);
    return NextResponse.json({ error: "Nao foi possivel acessar esta imagem." }, { status: 500 });
  }
}