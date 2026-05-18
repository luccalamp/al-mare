import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { buildStorageObjectPublicUrl, createSignedStorageUrl } from "@/lib/server/storageUrls";
import {
  buildJsonError,
  isMissingColumnError,
  requireAuthorizedStaff,
  requireCompanyDocumentFolderAccess,
} from "@/lib/server/tenantAccess";

const nullableTrimmedString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") {
      return null;
    }

    const trimmedValue = value.trim();
    return trimmedValue || null;
  });

const createSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create-folder"),
    name: z.string().trim().min(1),
    notes: nullableTrimmedString,
  }),
  z.object({
    action: z.literal("register-document"),
    folderId: z.string().uuid(),
    name: z.string().trim().min(1),
    fileName: z.string().trim().min(1),
    mimeType: nullableTrimmedString,
    sizeBytes: z.number().int().nonnegative(),
    storageBucket: z.string().trim().min(1),
    storagePath: z.string().trim().min(1),
  }),
]);

const updateSchema = z.object({
  action: z.literal("update-folder-notes"),
  folderId: z.string().uuid(),
  notes: nullableTrimmedString,
});

function buildCompanyDocumentError(error: { message?: string } | null | undefined, fallback: string) {
  const message = error?.message || "";

  if (isMissingColumnError(message)) {
    return buildJsonError("A central de documentos ainda não está disponível neste ambiente.", 503);
  }

  if (/duplicate key value|already exists|idx_company_document_folders_nome_unique/i.test(message)) {
    return buildJsonError("Já existe uma pasta com esse nome.", 409);
  }

  console.error("Failed to persist company document data:", error);
  return buildJsonError(fallback, 500);
}

export async function GET(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso não permite gerenciar documentos.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const [foldersResult, documentsResult] = await Promise.all([
    authContext.admin
      .from("company_document_folders")
      .select("*")
      .eq("user_id", authContext.userId)
      .order("created_at", { ascending: true }),
    authContext.admin
      .from("company_documents")
      .select(
        "id, folder_id, nome, arquivo_nome, mime_type, tamanho_bytes, storage_bucket, storage_path, public_url, created_at, updated_at, company_document_folders(nome)"
      )
      .eq("user_id", authContext.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (foldersResult.error) {
    return buildCompanyDocumentError(foldersResult.error, "Não foi possível carregar as pastas agora.");
  }

  if (documentsResult.error) {
    return buildCompanyDocumentError(documentsResult.error, "Não foi possível carregar os documentos agora.");
  }

  const storageAdmin = createSupabaseAdminClient();
  const signedDocuments = await Promise.all(
    (Array.isArray(documentsResult.data) ? documentsResult.data : []).map(async (document) => ({
      ...document,
      public_url: await createSignedStorageUrl(storageAdmin, {
        storageBucket: document.storage_bucket,
        storagePath: document.storage_path,
        fallbackUrl: document.public_url,
      }),
    }))
  );

  return NextResponse.json({
    folders: Array.isArray(foldersResult.data) ? foldersResult.data : [],
    documents: signedDocuments,
  });
}

export async function POST(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso não permite gerenciar documentos.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const parsedBody = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return buildJsonError("Dados inválidos para esta operação de documentos.", 400);
  }

  switch (parsedBody.data.action) {
    case "create-folder": {
      const { data, error } = await authContext.admin
        .from("company_document_folders")
        .insert({
          user_id: authContext.userId,
          nome: parsedBody.data.name,
          notas: parsedBody.data.notes,
        })
        .select("*")
        .single();

      if (error || !data) {
        return buildCompanyDocumentError(error, "Não foi possível criar a pasta agora.");
      }

      return NextResponse.json({ record: data });
    }

    case "register-document": {
      const access = await requireCompanyDocumentFolderAccess(
        authContext,
        parsedBody.data.folderId,
        "Seu acesso não permite enviar documentos para esta pasta.",
        "Pasta inválida para esta operação."
      );
      if (access.response) {
        return access.response || buildJsonError("Pasta inválida para esta operação.", 404);
      }

      const { data, error } = await authContext.admin
        .from("company_documents")
        .insert({
          folder_id: parsedBody.data.folderId,
          nome: parsedBody.data.name,
          arquivo_nome: parsedBody.data.fileName,
          mime_type: parsedBody.data.mimeType,
          tamanho_bytes: parsedBody.data.sizeBytes,
          storage_bucket: parsedBody.data.storageBucket,
          storage_path: parsedBody.data.storagePath,
          public_url: buildStorageObjectPublicUrl(parsedBody.data.storageBucket, parsedBody.data.storagePath),
        })
        .select(
          "id, folder_id, nome, arquivo_nome, mime_type, tamanho_bytes, storage_bucket, storage_path, public_url, created_at, updated_at, company_document_folders(nome)"
        )
        .single();

      if (error || !data) {
        return buildCompanyDocumentError(error, "Não foi possível registrar o documento agora.");
      }

      const storageAdmin = createSupabaseAdminClient();
      const signedRecord = {
        ...data,
        public_url: await createSignedStorageUrl(storageAdmin, {
          storageBucket: data.storage_bucket,
          storagePath: data.storage_path,
          fallbackUrl: data.public_url,
        }),
      };

      return NextResponse.json({ record: signedRecord });
    }
  }
}

export async function PUT(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso não permite gerenciar documentos.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const parsedBody = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return buildJsonError("Dados inválidos para atualizar a pasta.", 400);
  }

  const access = await requireCompanyDocumentFolderAccess(
    authContext,
    parsedBody.data.folderId,
    "Seu acesso não permite editar esta pasta.",
    "Pasta inválida para esta operação."
  );
  if (access.response) {
    return access.response || buildJsonError("Pasta inválida para esta operação.", 404);
  }

  const { data, error } = await authContext.admin
    .from("company_document_folders")
    .update({ notas: parsedBody.data.notes })
    .eq("id", parsedBody.data.folderId)
    .eq("user_id", authContext.userId)
    .select("*")
    .single();

  if (error || !data) {
    return buildCompanyDocumentError(error, "Não foi possível salvar o texto da pasta agora.");
  }

  return NextResponse.json({ record: data });
}