import { NextResponse } from "next/server";
import { z } from "zod";
import { archivePhoto } from "@/lib/server/recovery";
import { requireAuthorizedStaff, buildJsonError, requirePhotoAccess } from "@/lib/server/tenantAccess";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

const archivePhotoSchema = z.object({
  photoId: z.string().uuid().optional(),
  photoUrl: z.string().optional(),
  reason: z.string().trim().max(240).optional(),
}).refine((data) => data.photoId || data.photoUrl, {
  message: "photoId or photoUrl is required",
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

  let photoId = parsedBody.data.photoId;

  if (!photoId && parsedBody.data.photoUrl) {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("client_photos")
      .select("id")
      .eq("url", parsedBody.data.photoUrl)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error("archive photo lookup error:", error);
      return buildJsonError("Nao foi possivel encontrar a foto.", 500);
    }
    if (!data) {
      return buildJsonError("Foto nao encontrada ou ja arquivada.", 404);
    }
    photoId = data.id;
  }

  const access = await requirePhotoAccess(
    authContext,
    photoId!,
    "Seu acesso nao permite arquivar esta foto.",
    "Foto invalida para esta operacao."
  );
  if (access.response) {
    return access.response;
  }

  try {
    const result = await archivePhoto(
      photoId!,
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
