import { NextRequest, NextResponse } from "next/server";
import { requireAuthorizedStaff } from "@/lib/server/tenantAccess";
import { getCloudinarySignedUrl } from "@/lib/server/cloudinary";

export async function GET(req: NextRequest, { params }: { params: { publicId: string } }) {
  try {
    const authContext = await requireAuthorizedStaff(req, {
      forbiddenMessage: "Sem permissao para acessar esta imagem.",
    });

    if (authContext instanceof NextResponse) {
      return authContext;
    }

    const publicId = decodeURIComponent(params.publicId);
    const signedUrl = getCloudinarySignedUrl(publicId, { expiresInSeconds: 120 });

    return NextResponse.redirect(signedUrl, {
      status: 302,
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Media proxy error:", error);
    return NextResponse.json({ error: "Nao foi possivel acessar esta imagem." }, { status: 500 });
  }
}
