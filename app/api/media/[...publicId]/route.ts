import { NextRequest, NextResponse } from "next/server";
import { buildJsonError, requireAuthorizedStaff, requireClientAccess } from "@/lib/server/tenantAccess";
import { getCloudinarySignedUrl } from "@/lib/server/cloudinary";
import { findCloudinaryPhotoRecordByPublicId } from "@/lib/server/cloudinaryAccess";

export async function GET(req: NextRequest, { params }: { params: { publicId: string[] } }) {
  try {
    const authContext = await requireAuthorizedStaff(req, {
      forbiddenMessage: "Sem permissao para acessar esta imagem.",
    });

    if (authContext instanceof NextResponse) {
      return authContext;
    }

    const publicId = params.publicId.join("/");
    const { data: photoRecord, error: photoLookupError } = await findCloudinaryPhotoRecordByPublicId(publicId);
    if (photoLookupError) {
      console.error("Media proxy: failed to load Cloudinary photo reference", photoLookupError);
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

    const imageResponse = await fetch(getCloudinarySignedUrl(publicId), {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!imageResponse.ok) {
      console.error("Media proxy: Cloudinary fetch failed", imageResponse.status);
      return NextResponse.json({ error: "Imagem nao encontrada." }, { status: 404 });
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Length": imageBuffer.byteLength.toString(),
        "Vary": "Cookie, Authorization",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Media proxy error:", error);
    return NextResponse.json({ error: "Nao foi possivel acessar esta imagem." }, { status: 500 });
  }
}
