import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { createSignedStorageUrl } from "@/lib/server/storageUrls";
import {
  STORAGE_BUCKETS,
  buildCompanyDocumentStoragePath,
  buildStorageObjectReference,
  stripFileExtension,
  uploadPrivateBuffer,
} from "@/lib/server/storageUpload";
import { buildJsonError, requireAuthorizedStaff, requireCompanyDocumentFolderAccess } from "@/lib/server/tenantAccess";

export const runtime = "nodejs";

const MAX_DOCUMENT_UPLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMimeType(mimeType?: string | null) {
  return mimeType?.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
}

function validateDocumentFile(file: File) {
  const mimeType = normalizeMimeType(file.type);

  if (file.size <= 0) {
    throw new Error("Arquivo vazio.");
  }

  if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    throw new Error("Documento muito grande. Envie arquivos de ate 15 MB.");
  }

  if (!ALLOWED_DOCUMENT_MIME_TYPES.has(mimeType)) {
    throw new Error("Formato de documento nao suportado para esta central de arquivos.");
  }

  return mimeType;
}

async function removeUploadedDocument(storagePath: string) {
  const storageClient = createSupabaseAdminClient();
  await storageClient.storage
    .from(STORAGE_BUCKETS.companyDocuments)
    .remove([storagePath])
    .catch(() => undefined);
}

export async function POST(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso nao permite enviar documentos.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return buildJsonError("Payload invalido para envio de documentos.", 400);
  }

  const folderId = getString(formData, "folderId");
  const files = [...formData.getAll("files"), ...formData.getAll("file")].filter((entry): entry is File => entry instanceof File);

  if (!folderId || files.length === 0) {
    return buildJsonError("Informe a pasta e ao menos um arquivo.", 400);
  }

  const access = await requireCompanyDocumentFolderAccess(
    authContext,
    folderId,
    "Seu acesso nao permite enviar documentos para esta pasta.",
    "Pasta invalida para esta operacao."
  );
  if (access.response) {
    return access.response || buildJsonError("Pasta invalida para esta operacao.", 404);
  }

  const storageClient = createSupabaseAdminClient();
  const createdDocuments: unknown[] = [];

  for (const file of files) {
    let storagePath: string | null = null;

    try {
      const mimeType = validateDocumentFile(file);
      storagePath = buildCompanyDocumentStoragePath({
        folderId,
        fileName: file.name,
        mimeType,
      });

      await uploadPrivateBuffer(storageClient, {
        bucket: STORAGE_BUCKETS.companyDocuments,
        path: storagePath,
        buffer: Buffer.from(await file.arrayBuffer()),
        contentType: mimeType,
      });

      const { data, error } = await authContext.admin
        .from("company_documents")
        .insert({
          folder_id: folderId,
          nome: stripFileExtension(file.name),
          arquivo_nome: file.name,
          mime_type: mimeType,
          tamanho_bytes: file.size,
          storage_bucket: STORAGE_BUCKETS.companyDocuments,
          storage_path: storagePath,
          public_url: buildStorageObjectReference(STORAGE_BUCKETS.companyDocuments, storagePath),
        })
        .select(
          "id, folder_id, nome, arquivo_nome, mime_type, tamanho_bytes, storage_bucket, storage_path, public_url, created_at, updated_at, company_document_folders(nome)"
        )
        .single();

      if (error || !data) {
        throw error || new Error("Nao foi possivel registrar o documento.");
      }

      createdDocuments.push({
        ...data,
        public_url: await createSignedStorageUrl(storageClient, {
          storageBucket: data.storage_bucket,
          storagePath: data.storage_path,
        }),
      });
    } catch (error) {
      if (storagePath) {
        await removeUploadedDocument(storagePath);
      }

      const message = error instanceof Error ? error.message : "Nao foi possivel enviar os documentos agora.";
      return buildJsonError(message, 400);
    }
  }

  return NextResponse.json({ documents: createdDocuments }, { status: 201 });
}
