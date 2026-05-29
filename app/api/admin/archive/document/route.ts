import { NextResponse } from "next/server";
import { z } from "zod";
import { archiveDocument } from "@/lib/server/recovery";
import { requireAuthorizedStaff, buildJsonError, requireCompanyDocumentAccess } from "@/lib/server/tenantAccess";
import { safeErrorMessage } from "@/lib/server/safeError";

const archiveDocumentSchema = z.object({
  documentId: z.string().uuid(),
  reason: z.string().trim().max(240).optional(),
});

export async function POST(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso nao permite arquivar documentos.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const parsedBody = archiveDocumentSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return buildJsonError("Payload invalido para arquivar o documento.", 400);
  }

  const access = await requireCompanyDocumentAccess(
    authContext,
    parsedBody.data.documentId,
    "Seu acesso nao permite arquivar este documento.",
    "Documento invalido para esta operacao."
  );
  if (access.response) {
    return access.response;
  }

  try {
    const result = await archiveDocument(
      parsedBody.data.documentId,
      authContext.userId,
      parsedBody.data.reason || "Arquivamento administrativo do documento com quarentena privada."
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("archive document error:", error);
    return NextResponse.json({ error: safeErrorMessage(error, "Falha ao arquivar o documento.") }, { status: 500 });
  }
}
