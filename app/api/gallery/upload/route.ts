import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { insertClientPhoto, normalizeGalleryCategory, storeOptimizedClientImage } from "@/lib/server/gallery";
import { ImageValidationError } from "@/lib/server/imageOptimization";
import { buildJsonError, requireAuthorizedStaff, requireClientAccess } from "@/lib/server/tenantAccess";

export const runtime = "nodejs";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function removeUploadedImageObjects(input: {
  bucket: string;
  storagePath: string;
  thumbnailStoragePath: string;
}) {
  const storageClient = createSupabaseAdminClient();
  await storageClient.storage
    .from(input.bucket)
    .remove([input.storagePath, input.thumbnailStoragePath])
    .catch(() => undefined);
}

export async function POST(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso nao permite enviar fotos.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return buildJsonError("Payload invalido para envio da foto.", 400);
  }

  const clientId = getString(formData, "clientId");
  const intent = getString(formData, "intent") || "gallery";
  const category = normalizeGalleryCategory(getString(formData, "type"));
  const caption = getString(formData, "caption") || null;
  const file = formData.get("file");

  if (!clientId || !(file instanceof File)) {
    return buildJsonError("Informe cliente e arquivo para enviar a foto.", 400);
  }

  const access = await requireClientAccess(
    authContext,
    clientId,
    "Seu acesso nao permite enviar fotos para esta paciente.",
    "Cliente invalido para esta operacao."
  );
  if (access.response) {
    return access.response || buildJsonError("Cliente invalido para esta operacao.", 404);
  }

  const storageClient = createSupabaseAdminClient();
  let storedImage:
    | Awaited<ReturnType<typeof storeOptimizedClientImage>>
    | null = null;

  try {
    storedImage = await storeOptimizedClientImage({
      storageClient,
      clientId,
      category: intent === "avatar" ? "avatar" : category,
      fileBuffer: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
    });

    if (intent === "avatar") {
      return NextResponse.json({
        asset: {
          storageBucket: storedImage.bucket,
          storagePath: storedImage.storagePath,
          optimizedStoragePath: storedImage.optimizedStoragePath,
          thumbnailStoragePath: storedImage.thumbnailStoragePath,
          signedUrl: storedImage.signedUrl,
          thumbnailUrl: storedImage.thumbnailSignedUrl,
          mimeType: storedImage.asset.mimeType,
          originalMimeType: storedImage.asset.originalMimeType,
          sizeBytes: storedImage.asset.optimizedBytes,
          originalSizeBytes: storedImage.asset.originalBytes,
          width: storedImage.asset.width,
          height: storedImage.asset.height,
          finalFormat: storedImage.asset.finalFormat,
        },
      });
    }

    const record = await insertClientPhoto({
      dbClient: authContext.admin,
      clientId,
      category,
      caption,
      storedImage,
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    if (storedImage) {
      await removeUploadedImageObjects({
        bucket: storedImage.bucket,
        storagePath: storedImage.storagePath,
        thumbnailStoragePath: storedImage.thumbnailStoragePath,
      });
    }

    if (error instanceof ImageValidationError) {
      return buildJsonError(error.message, error.status);
    }

    console.error("gallery upload error:", error);
    return buildJsonError("Nao foi possivel enviar a foto agora.", 500);
  }
}
