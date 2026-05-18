import { NextResponse } from "next/server";
import { z } from "zod";
import { restoreRecord, restoreTransaction } from "@/lib/server/recovery";
import { requireAuthorizedStaff } from "@/lib/server/tenantAccess";

const restoreSchema = z
  .object({
    tableName: z.enum(["clientes", "client_photos", "company_documents"]).optional(),
    recordId: z.string().uuid().optional(),
    transactionId: z.number().int().positive().optional(),
  })
  .refine((value) => Boolean(value.transactionId || (value.tableName && value.recordId)), {
    message: "Informe um transactionId ou um par tableName + recordId para restauracao.",
  });

export async function POST(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso não permite operacoes de restauracao.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const rawBody = await request.json().catch(() => null);
  if (rawBody && typeof rawBody === "object" && "transactionId" in rawBody && typeof rawBody.transactionId === "string") {
    rawBody.transactionId = Number(rawBody.transactionId);
  }

  const parsedBody = restoreSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0]?.message || "Payload invalido para restauracao." }, { status: 400 });
  }

  try {
    const results = parsedBody.data.transactionId
      ? await restoreTransaction(parsedBody.data.transactionId, authContext.userId)
      : [await restoreRecord(parsedBody.data.tableName!, parsedBody.data.recordId!, authContext.userId)];

    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao restaurar o registro solicitado." },
      { status: 500 }
    );
  }
}
