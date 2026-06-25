import { NextResponse } from "next/server";
import { z } from "zod";
import { archivePhoto } from "@/lib/server/recovery";
import { buildJsonError, requireAuthorizedStaff } from "@/lib/server/tenantAccess";

const deletePhotoSchema = z.object({
  photoId: z.string().uuid(),
  reason: z.string().trim().max(240).optional(),
});

export async function DELETE(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso nao permite arquivar fotos.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const parsedBody = deletePhotoSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return buildJsonError("Payload invalido para arquivar a foto.", 400);
  }

  try {
    const result = await archivePhoto(
      parsedBody.data.photoId,
      authContext.userId,
      parsedBody.data.reason || "Arquivamento da galeria com quarentena privada."
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("gallery photo delete error:", error);
    const message = error instanceof Error ? error.message : "Falha ao arquivar a foto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
