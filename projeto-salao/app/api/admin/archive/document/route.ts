import { NextResponse } from "next/server";
import { z } from "zod";
import { archiveDocument } from "@/lib/server/recovery";
import { requireAdminRequest, resolveOperationActor } from "@/lib/server/requestGuards";

const archiveDocumentSchema = z.object({
  documentId: z.string().uuid(),
  reason: z.string().trim().max(240).optional(),
});

export async function POST(request: Request) {
  const authResponse = requireAdminRequest(request);
  if (authResponse) {
    return authResponse;
  }

  const parsedBody = archiveDocumentSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Payload invalido para arquivar o documento." }, { status: 400 });
  }

  try {
    const result = await archiveDocument(
      parsedBody.data.documentId,
      resolveOperationActor(request),
      parsedBody.data.reason || "Arquivamento administrativo do documento com quarentena privada."
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao arquivar o documento." },
      { status: 500 }
    );
  }
}
