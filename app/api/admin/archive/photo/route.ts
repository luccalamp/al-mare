import { NextResponse } from "next/server";
import { z } from "zod";
import { archivePhoto } from "@/lib/server/recovery";
import { requireAuthorizedStaff, buildJsonError } from "@/lib/server/tenantAccess";

const archivePhotoSchema = z.object({
  photoId: z.string().uuid(),
  reason: z.string().trim().max(240).optional(),
});

export async function POST(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso nao permite arquivar fotos.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const parsedBody = archivePhotoSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    console.error("archive photo validation error:", parsedBody.error);
    return buildJsonError("Payload invalido para arquivar a foto.", 400);
  }

  console.log("archive photo request:", parsedBody.data);

  try {
    const result = await archivePhoto(
      parsedBody.data.photoId,
      authContext.userId,
      parsedBody.data.reason || "Arquivamento administrativo da galeria com quarentena privada."
    );
    console.log("archive photo result:", result);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("archive photo error:", error);
    const message = error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "Falha ao arquivar a foto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
