import { NextResponse } from "next/server";
import { z } from "zod";
import { restoreRecord, restoreTransaction } from "@/lib/server/recovery";
import { requireAdminRequest, resolveOperationActor } from "@/lib/server/requestGuards";

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
  const authResponse = requireAdminRequest(request);
  if (authResponse) {
    return authResponse;
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
    const actor = resolveOperationActor(request);
    const results = parsedBody.data.transactionId
      ? await restoreTransaction(parsedBody.data.transactionId, actor)
      : [await restoreRecord(parsedBody.data.tableName!, parsedBody.data.recordId!, actor)];

    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao restaurar o registro solicitado." },
      { status: 500 }
    );
  }
}
