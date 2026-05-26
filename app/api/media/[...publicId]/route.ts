import { NextRequest, NextResponse } from "next/server";
import { buildJsonError, requireAuthorizedStaff, requireClientAccess } from "@/lib/server/tenantAccess";
import { getCloudinarySignedUrl } from "@/lib/server/cloudinary";
import { findPhotoRecordByStoragePath } from "@/lib/server/cloudinaryAccess";
import { downloadFromR2, getR2StorageBucketLabel } from "@/lib/server/r2";

export async function GET(req: NextRequest, { params }: { params: { publicId: string[] } }) {
  try {
    const authContext = await requireAuthorizedStaff(req, {
      forbiddenMessage: "Sem permissao para acessar esta imagem.",
    });

    if (authContext instanceof NextResponse) {
      return authContext;
    }

    const storagePath = params.publicId.join("/");
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

    let imageBuffer: ArrayBuffer | Buffer;
    let contentType = "image/jpeg";

    if (photoRecord.storageBucket === "cloudinary") {
      const imageResponse = await fetch(getCloudinarySignedUrl(photoRecord.storagePath), {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });

      if (!imageResponse.ok) {
        console.error("Media proxy: Cloudinary fetch failed", imageResponse.status);
        return NextResponse.json({ error: "Imagem nao encontrada." }, { status: 404 });
      }

      imageBuffer = await imageResponse.arrayBuffer();
      contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    } else if (photoRecord.storageBucket === getR2StorageBucketLabel()) {
      try {
        const downloaded = await downloadFromR2(photoRecord.storagePath);
        imageBuffer = downloaded.buffer;
        contentType = downloaded.contentType || "image/jpeg";
      } catch (downloadError) {
        console.error("Media proxy: R2 fetch failed", downloadError);
        return NextResponse.json({ error: "Imagem nao encontrada." }, { status: 404 });
      }
    } else {
      console.error("Media proxy: unsupported storage bucket", photoRecord.storageBucket);
      return NextResponse.json({ error: "Midia com armazenamento nao suportado." }, { status: 500 });
    }

    const body = imageBuffer instanceof ArrayBuffer ? imageBuffer : new Uint8Array(imageBuffer);

    return new NextResponse(body, {
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
