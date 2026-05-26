import { NextRequest, NextResponse } from "next/server";
import { normalizeStoragePathFromRoute } from "@/lib/server/mediaProxy";
import { findPhotoRecordByStoragePath } from "@/lib/server/photoStorageAccess";
import { downloadManagedPhoto } from "@/lib/server/photoStorage";
import { buildJsonError, requireAuthorizedStaff, requireClientAccess } from "@/lib/server/tenantAccess";

export async function GET(req: NextRequest, { params }: { params: { publicId: string[] } }) {
  try {
    const authContext = await requireAuthorizedStaff(req, {
      forbiddenMessage: "Sem permissao para acessar esta imagem.",
    });

    if (authContext instanceof NextResponse) {
      return authContext;
    }

    const storagePath = normalizeStoragePathFromRoute(params.publicId);
    const { data: photoRecord, error: photoLookupError } = await findPhotoRecordByStoragePath(storagePath);
    if (photoLookupError) {
      console.error("Media proxy: failed to load photo reference", photoLookupError);
      return buildJsonError("Nao foi possivel validar a imagem agora.", 500);
    }

    if (!photoRecord) {
      return buildJsonError("Imagem invalida para esta operacao.", 404);
    }

    const access = await requireClientAccess(
      authContext,
      photoRecord.clientId,
      "Sem permissao para acessar esta imagem.",
      "Imagem invalida para esta operacao."
    );
    if (access.response) {
      return access.response;
    }

    let downloaded;
    try {
      downloaded = await downloadManagedPhoto(photoRecord.storageBucket, photoRecord.storagePath);
    } catch (downloadError) {
      console.error("Media proxy: managed photo fetch failed", downloadError);
      return NextResponse.json({ error: "Imagem nao encontrada." }, { status: 404 });
    }

    const body = new Uint8Array(downloaded.buffer);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": downloaded.contentType || "image/jpeg",
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Length": downloaded.buffer.byteLength.toString(),
        "Vary": "Cookie, Authorization",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Media proxy error:", error);
    return NextResponse.json({ error: "Nao foi possivel acessar esta imagem." }, { status: 500 });
  }
}
