import { NextRequest, NextResponse } from "next/server";
import { requireAuthorizedStaff, requireClientAccess } from "@/lib/server/tenantAccess";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { buildS3ProxyUrl, getS3StorageBucketLabel, isS3ObjectKeyForClient } from "@/lib/server/s3";
import { normalizePhotoCategory } from "@/lib/photos";
import { safeErrorMessage } from "@/lib/server/safeError";
import { archivePhoto } from "@/lib/server/recovery";

export async function POST(req: NextRequest) {
  const authContext = await requireAuthorizedStaff(req, {
    forbiddenMessage: "Seu acesso nao permite fazer upload.",
  });
  if (authContext instanceof NextResponse) return authContext;

  try {
    const body = await req.json();
    const clienteId = (body.clienteId as string)?.trim();
    const objectKey = (body.objectKey as string)?.trim();
    const recordCategory = normalizePhotoCategory((body.photoCategory as string)?.trim() || body.category);
    const caption = (body.caption as string)?.trim() || null;
    const anotacaoTecnica = (body.anotacaoTecnica as string)?.trim() || null;
    const capturedAt = (body.capturedAt as string)?.trim() || new Date().toISOString();
    const persistClientPhoto = body.persistClientPhoto === true;

    if (!clienteId || !objectKey) {
      return NextResponse.json({ error: "Missing required fields: clienteId, objectKey" }, { status: 400 });
    }

    const access = await requireClientAccess(
      authContext,
      clienteId,
      "Seu acesso nao permite enviar arquivos para este paciente.",
      "Cliente invalido para esta operacao."
    );
    if (access.response) return access.response;

    if (!isS3ObjectKeyForClient(clienteId, objectKey)) {
      return NextResponse.json({ error: "Objeto de upload invalido para este paciente." }, { status: 400 });
    }

    const proxyUrl = buildS3ProxyUrl(objectKey);

    const supabase = createSupabaseAdminClient();

    const { data: savedPhoto, error: photoError } = await supabase
      .from("client_photos")
      .insert({
        cliente_id: clienteId,
        url: proxyUrl,
        type: recordCategory,
        categoria: recordCategory,
        caption,
        anotacao_tecnica: anotacaoTecnica,
        captured_at: capturedAt,
        storage_bucket: getS3StorageBucketLabel(),
        storage_path: objectKey,
      })
      .select()
      .single();

    if (photoError) {
      throw new Error(`Failed to save photo reference: ${photoError.message}`);
    }

    if (persistClientPhoto) {
      const { error: clientError } = await supabase
        .from("clientes")
        .update({
          photo_url: proxyUrl,
          profile_photo_storage_bucket: getS3StorageBucketLabel(),
          profile_photo_storage_path: objectKey,
        })
        .eq("id", clienteId)
        .eq("user_id", authContext.userId);

      if (clientError) {
        await archivePhoto(
          savedPhoto.id,
          authContext.userId,
          "Rollback recuperavel do upload apos falha ao atualizar foto do paciente."
        ).catch(() => {
          console.error("Failed to archive confirmed photo after client update error.");
        });
        throw new Error(`Failed to update client photo: ${clientError.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      url: proxyUrl,
      publicId: objectKey,
      record: {
        id: savedPhoto.id,
        date: savedPhoto.captured_at || savedPhoto.created_at,
        type: normalizePhotoCategory(savedPhoto.categoria || savedPhoto.type),
        url: proxyUrl,
        caption: savedPhoto.caption || undefined,
        technicalNote: savedPhoto.anotacao_tecnica || undefined,
      },
    });
  } catch (error) {
    console.error("Confirm upload error.");
    return NextResponse.json(
      { error: safeErrorMessage(error, "Falha ao confirmar upload.") },
      { status: 500 }
    );
  }
}
