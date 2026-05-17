import { NextResponse } from "next/server";
import { z } from "zod";
import { archivePhoto } from "@/lib/server/recovery";
import { requireAdminRequest, resolveOperationActor } from "@/lib/server/requestGuards";

const archivePhotoSchema = z.object({
  photoId: z.string().uuid(),
  reason: z.string().trim().max(240).optional(),
});

export async function POST(request: Request) {
  const authResponse = requireAdminRequest(request);
  if (authResponse) {
    return authResponse;
  }

  const parsedBody = archivePhotoSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Payload invalido para arquivar a foto." }, { status: 400 });
  }

  try {
    const result = await archivePhoto(
      parsedBody.data.photoId,
      resolveOperationActor(request),
      parsedBody.data.reason || "Arquivamento administrativo da galeria com quarentena privada."
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao arquivar a foto." },
      { status: 500 }
    );
  }
}
