import { NextRequest, NextResponse } from "next/server";
import { requireAuthorizedStaff } from "@/lib/server/tenantAccess";
import { getCloudinarySignedUrl } from "@/lib/server/cloudinary";
import { readServerEnv } from "@/lib/server/supabaseAdmin";

export async function GET(req: NextRequest, { params }: { params: { publicId: string[] } }) {
  try {
    const authContext = await requireAuthorizedStaff(req, {
      forbiddenMessage: "Sem permissao para acessar esta imagem.",
    });

    if (authContext instanceof NextResponse) {
      return authContext;
    }

    const publicId = params.publicId.join("/");
    const cloudName = readServerEnv("CLOUDINARY_CLOUD_NAME");
    const publicUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;

    let imageResponse = await fetch(getCloudinarySignedUrl(publicId), {
      signal: AbortSignal.timeout(10_000),
    });

    if (!imageResponse.ok) {
      imageResponse = await fetch(publicUrl, {
        signal: AbortSignal.timeout(10_000),
      });
    }

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
        "Cache-Control": "private, max-age=86400, s-maxage=86400",
        "Content-Length": imageBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Media proxy error:", error);
    return NextResponse.json({ error: "Nao foi possivel acessar esta imagem." }, { status: 500 });
  }
}
