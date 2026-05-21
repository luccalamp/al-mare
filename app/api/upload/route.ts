import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { requireAuthorizedStaff } from "@/lib/server/tenantAccess";
import { uploadToCloudinary, deleteFromCloudinary, buildCloudinaryFolder } from "@/lib/server/cloudinary";

const SUPPORTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

async function authorizeUpload(req: NextRequest) {
  const authContext = await requireAuthorizedStaff(req, {
    forbiddenMessage: "Seu acesso nao permite fazer upload.",
  });

  if (authContext instanceof NextResponse) {
    return authContext;
  }

  return authContext;
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
    const clientName = (formData.get("clientName") as string)?.trim() || undefined;

    if (!file || !clienteId) {
      return NextResponse.json(
        { error: "Missing required fields: file, clienteId" },
        { status: 400 }
      );
    }

    if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Formato de imagem não suportado. Use JPEG, PNG, WebP ou AVIF." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!buffer.byteLength) {
      return NextResponse.json({ error: "O arquivo enviado está vazio." }, { status: 400 });
    }

    const folder = buildCloudinaryFolder(clienteId, clientName, category);
    const uploadResult = await uploadToCloudinary(buffer, file.name || "photo.jpg", folder);

    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();

    const photoRecord = {
      cliente_id: clienteId,
      url: uploadResult.secureUrl,
      type: category || "referencia",
      categoria: category || "referencia",
      caption: caption || null,
      anotacao_tecnica: anotacaoTecnica || null,
      captured_at: capturedAt || now,
      storage_bucket: "cloudinary",
      storage_path: uploadResult.publicId,
    };

    const { data: savedPhoto, error: photoError } = await supabase
      .from("client_photos")
      .insert(photoRecord)
      .select()
      .single();

    if (photoError) {
      await deleteFromCloudinary(uploadResult.publicId).catch(() => {});
      throw new Error(`Failed to save photo reference: ${photoError.message}`);
    }

    if (persistClientPhoto) {
      const { error: clientError } = await supabase
        .from("clientes")
        .update({
          photo_url: uploadResult.secureUrl,
          profile_photo_storage_bucket: "cloudinary",
          profile_photo_storage_path: uploadResult.publicId,
        })
        .eq("id", clienteId)
        .eq("user_id", auth.userId);

      if (clientError) {
        await supabase
          .from("client_photos")
          .delete()
          .eq("id", savedPhoto.id);
        await deleteFromCloudinary(uploadResult.publicId).catch(() => {});
        throw new Error(`Failed to update client photo: ${clientError.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      url: uploadResult.secureUrl,
      publicId: uploadResult.publicId,
      width: uploadResult.width,
      height: uploadResult.height,
      bytes: uploadResult.bytes,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
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

    const publicId = typeof body.publicId === "string" ? body.publicId.trim() : "";
    if (!publicId) {
      return NextResponse.json({ error: "Missing publicId." }, { status: 400 });
    }

    await deleteFromCloudinary(publicId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 }
    );
  }
}
