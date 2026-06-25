import { NextResponse } from "next/server";
import { z } from "zod";
import { archiveDocument } from "@/lib/server/recovery";
import { buildJsonError, requireAuthorizedStaff } from "@/lib/server/tenantAccess";

const deleteDocumentSchema = z.object({
  documentId: z.string().uuid(),
  reason: z.string().trim().max(240).optional(),
});

export async function DELETE(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso nao permite arquivar documentos.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const parsedBody = deleteDocumentSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return buildJsonError("Payload invalido para arquivar o documento.", 400);
  }

  try {
    const result = await archiveDocument(
      parsedBody.data.documentId,
      authContext.userId,
      parsedBody.data.reason || "Arquivamento do documento com quarentena privada."
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("document delete error:", error);
    const message = error instanceof Error ? error.message : "Falha ao arquivar o documento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
