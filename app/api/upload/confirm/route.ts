import { NextRequest, NextResponse } from "next/server";
import { requireAuthorizedStaff, requireClientAccess } from "@/lib/server/tenantAccess";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { getS3StorageBucketLabel } from "@/lib/server/s3";
import { normalizePhotoCategory } from "@/lib/photos";
import { safeErrorMessage } from "@/lib/server/safeError";

export async function POST(req: NextRequest) {
  const authContext = await requireAuthorizedStaff(req, {
    forbiddenMessage: "Seu acesso nao permite fazer upload.",
  });
  if (authContext instanceof NextResponse) return authContext;

  try {
    const body = await req.json();
    const clienteId = (body.clienteId as string)?.trim();
    const objectKey = (body.objectKey as string)?.trim();
    const proxyUrl = (body.proxyUrl as string)?.trim();
    const recordCategory = normalizePhotoCategory((body.photoCategory as string)?.trim() || body.category);
    const caption = (body.caption as string)?.trim() || null;
    const anotacaoTecnica = (body.anotacaoTecnica as string)?.trim() || null;
    const capturedAt = (body.capturedAt as string)?.trim() || new Date().toISOString();
    const persistClientPhoto = body.persistClientPhoto === true;

    if (!clienteId || !objectKey || !proxyUrl) {
      return NextResponse.json({ error: "Missing required fields: clienteId, objectKey, proxyUrl" }, { status: 400 });
    }

    const access = await requireClientAccess(
      authContext,
      clienteId,
      "Seu acesso nao permite enviar arquivos para este paciente.",
      "Cliente invalido para esta operacao."
    );
    if (access.response) return access.response;

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
        await supabase.from("client_photos").delete().eq("id", savedPhoto.id);
        throw new Error(`Failed to update client photo: ${clientError.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      url: proxyUrl,
      publicId: objectKey,
    });
  } catch (error) {
    console.error("Confirm upload error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Falha ao confirmar upload.") },
      { status: 500 }
    );
  }
}
