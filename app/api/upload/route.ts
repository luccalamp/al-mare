import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { buildJsonError, requireAuthorizedStaff, requireClientAccess } from "@/lib/server/tenantAccess";
import { findPhotoRecordByStoragePath } from "@/lib/server/photoStorageAccess";
import { deleteManagedPhoto } from "@/lib/server/photoStorage";
import { uploadToS3, deleteFromS3, buildS3ProxyUrl, getS3StorageBucketLabel } from "@/lib/server/s3";

const SUPPORTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

function sniffMimeTypeFromBuffer(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  const ftyp = buffer.toString("ascii", 4, 8);
  const brand = buffer.toString("ascii", 8, 12);
  if (ftyp === "ftyp" && (brand === "avif" || brand === "avis")) {
    return "image/avif";
  }

  return null;
}

async function authorizeUpload(req: NextRequest) {
  const authContext = await requireAuthorizedStaff(req, {
    forbiddenMessage: "Seu acesso nao permite fazer upload.",
  });

  if (authContext instanceof NextResponse) {
    return authContext;
  }

  return authContext;
}

async function requireStoredPhotoAccess(
  auth: Awaited<ReturnType<typeof authorizeUpload>>,
  storagePath: string,
  forbiddenMessage: string
) {
  if (auth instanceof NextResponse) {
    return { response: auth, photoRecord: null };
  }

  const { data: photoRecord, error: photoLookupError } = await findPhotoRecordByStoragePath(storagePath);
  if (photoLookupError) {
    console.error("Failed to load stored photo reference:", photoLookupError);
    return {
      response: buildJsonError("Nao foi possivel validar a imagem agora.", 500),
      photoRecord: null,
    };
  }

  if (!photoRecord) {
    return {
      response: buildJsonError("Imagem invalida para esta operacao.", 404),
      photoRecord: null,
    };
  }

  const access = await requireClientAccess(auth, photoRecord.clientId, forbiddenMessage, "Imagem invalida para esta operacao.");
  if (access.response) {
    return {
      response: access.response,
      photoRecord: null,
    };
  }

  return {
    response: null,
    photoRecord,
  };
}

export async function POST(req: NextRequest) {
  const auth = await authorizeUpload(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const formData = await req.formData();
    const fileEntry = formData.get("file");
    const file = fileEntry instanceof File ? fileEntry : null;
    const clienteId = (formData.get("clienteId") as string)?.trim() || "";
    const category = (formData.get("category") as string)?.trim() || undefined;
    const caption = (formData.get("caption") as string)?.trim() || undefined;
    const anotacaoTecnica = (formData.get("anotacaoTecnica") as string)?.trim() || undefined;
    const capturedAt = (formData.get("capturedAt") as string)?.trim() || undefined;
    const persistClientPhoto = formData.get("persistClientPhoto") === "true";

    if (!file || !clienteId) {
      return NextResponse.json({ error: "Missing required fields: file, clienteId" }, { status: 400 });
    }

    const access = await requireClientAccess(
      auth,
      clienteId,
      "Seu acesso nao permite enviar arquivos para este paciente.",
      "Cliente invalido para esta operacao."
    );
    if (access.response) {
      return access.response;
    }

    if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Formato de imagem nao suportado. Use JPEG, PNG, WebP ou AVIF." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!buffer.byteLength) {
      return NextResponse.json({ error: "O arquivo enviado esta vazio." }, { status: 400 });
    }

    const detectedMimeType = sniffMimeTypeFromBuffer(buffer);
    if (!detectedMimeType || !SUPPORTED_MIME_TYPES.includes(detectedMimeType)) {
      return NextResponse.json(
        { error: "Nao foi possivel validar o formato real da imagem enviada." },
        { status: 400 }
      );
    }

    if (file.type !== detectedMimeType) {
      return NextResponse.json(
        { error: "Tipo de arquivo inconsistente. Reenvie uma imagem valida." },
        { status: 400 }
      );
    }

    const uploadResult = await uploadToS3(
      buffer,
      file.name || "photo.jpg",
      detectedMimeType,
      clienteId,
      category
    );

    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const proxyUrl = buildS3ProxyUrl(uploadResult.objectKey);

    const photoRecord = {
      cliente_id: clienteId,
      url: proxyUrl,
      type: category || "referencia",
      categoria: category || "referencia",
      caption: caption || null,
      anotacao_tecnica: anotacaoTecnica || null,
      captured_at: capturedAt || now,
      storage_bucket: getS3StorageBucketLabel(),
      storage_path: uploadResult.objectKey,
    };

    const { data: savedPhoto, error: photoError } = await supabase
      .from("client_photos")
      .insert(photoRecord)
      .select()
      .single();

    if (photoError) {
      await deleteFromS3(uploadResult.objectKey).catch(() => {});
      throw new Error(`Failed to save photo reference: ${photoError.message}`);
    }

    if (persistClientPhoto) {
      const { error: clientError } = await supabase
        .from("clientes")
        .update({
          photo_url: proxyUrl,
          profile_photo_storage_bucket: getS3StorageBucketLabel(),
          profile_photo_storage_path: uploadResult.objectKey,
        })
        .eq("id", clienteId)
        .eq("user_id", auth.userId);

      if (clientError) {
        await supabase.from("client_photos").delete().eq("id", savedPhoto.id);
        await deleteFromS3(uploadResult.objectKey).catch(() => {});
        throw new Error(`Failed to update client photo: ${clientError.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      url: proxyUrl,
      publicId: uploadResult.objectKey,
      bytes: uploadResult.bytes,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authorizeUpload(req);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const storagePath = typeof body.publicId === "string" ? body.publicId.trim() : "";
    if (!storagePath) {
      return NextResponse.json({ error: "Missing storage path identifier." }, { status: 400 });
    }

    const access = await requireStoredPhotoAccess(auth, storagePath, "Seu acesso nao permite remover esta imagem.");
    if (access.response || !access.photoRecord) {
      return access.response || buildJsonError("Imagem invalida para esta operacao.", 404);
    }

    if (access.photoRecord.storagePath) {
      await deleteManagedPhoto(access.photoRecord.storageBucket, access.photoRecord.storagePath);
    }

    const supabase = createSupabaseAdminClient();
    const { error: photoDeleteError } = await supabase
      .from("client_photos")
      .delete()
      .eq("id", access.photoRecord.id);

    if (photoDeleteError) {
      console.error("Failed to delete stored photo reference:", photoDeleteError);
    }

    const { error: profileResetError } = await supabase
      .from("clientes")
      .update({
        photo_url: null,
        profile_photo_storage_bucket: null,
        profile_photo_storage_path: null,
      })
      .eq("id", access.photoRecord.clientId)
      .eq("user_id", auth.userId)
      .eq("profile_photo_storage_bucket", access.photoRecord.storageBucket)
      .eq("profile_photo_storage_path", access.photoRecord.storagePath);

    if (profileResetError) {
      console.error("Failed to clear deleted profile photo:", profileResetError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Stored photo delete error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 500 });
  }
}
