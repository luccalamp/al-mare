import { NextResponse } from "next/server";
import { z } from "zod";
import { archivePhoto } from "@/lib/server/recovery";
import { normalizeStoragePathFromRoute } from "@/lib/server/mediaProxy";
import { findPhotoRecordByStoragePath } from "@/lib/server/photoStorageAccess";
import { requireAuthorizedStaff, buildJsonError, requirePhotoAccess } from "@/lib/server/tenantAccess";
import { safeErrorMessage } from "@/lib/server/safeError";

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
    return buildJsonError("Payload invalido para arquivar a foto.", 400);
  }

  let photoId = parsedBody.data.photoId;

  if (!photoId && parsedBody.data.photoUrl) {
    const mediaPrefix = "/api/media/";
    const photoUrl = parsedBody.data.photoUrl.trim();
    const mediaPathIndex = photoUrl.indexOf(mediaPrefix);

    if (mediaPathIndex >= 0) {
      const storagePath = normalizeStoragePathFromRoute(
        photoUrl.slice(mediaPathIndex + mediaPrefix.length).split("/")
      );
      const { data: pathMatch, error: pathMatchError } = await findPhotoRecordByStoragePath(storagePath);

      if (pathMatchError) {
        return buildJsonError("Nao foi possivel encontrar a foto.", 500);
      }

      photoId = pathMatch?.id;
    }
  }

  if (!photoId && parsedBody.data.photoUrl) {
    const { data, error } = await authContext.admin
      .from("client_photos")
      .select("id, clientes!inner(user_id)")
      .eq("url", parsedBody.data.photoUrl)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      return buildJsonError("Nao foi possivel encontrar a foto.", 500);
    }

    const ownerRelation = Array.isArray(data?.clientes) ? data.clientes[0] : data?.clientes;
    if (!data?.id || ownerRelation?.user_id !== authContext.userId) {
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

  if (!photoId) {
    return buildJsonError("Foto nao encontrada ou ja arquivada.", 404);
  }

  try {
    const result = await archivePhoto(
      photoId,
      authContext.userId,
      parsedBody.data.reason || "Arquivamento administrativo da galeria com quarentena privada."
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error, "Falha ao arquivar a foto.") }, { status: 500 });
  }
}
