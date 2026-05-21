import { NextResponse } from "next/server";
import { z } from "zod";
import { archiveDocument } from "@/lib/server/recovery";
import { requireAuthorizedStaff, buildJsonError } from "@/lib/server/tenantAccess";

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

  try {
    const result = await archiveDocument(
      parsedBody.data.documentId,
      authContext.userId,
      parsedBody.data.reason || "Arquivamento administrativo do documento com quarentena privada."
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("archive document error:", error);
    const message = error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "Falha ao arquivar o documento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
