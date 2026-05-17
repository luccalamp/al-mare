import { NextResponse } from "next/server";
import { z } from "zod";
import { archiveClient } from "@/lib/server/recovery";
import { requireAdminRequest, resolveOperationActor } from "@/lib/server/requestGuards";

const archiveClientSchema = z.object({
  clientId: z.string().uuid(),
  reason: z.string().trim().max(240).optional(),
});

export async function POST(request: Request) {
  const authResponse = requireAdminRequest(request);
  if (authResponse) {
    return authResponse;
  }

  const parsedBody = archiveClientSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Payload invalido para arquivar a paciente." }, { status: 400 });
  }

  try {
    const result = await archiveClient(
      parsedBody.data.clientId,
      resolveOperationActor(request),
      parsedBody.data.reason || "Arquivamento administrativo com quarentena de midias."
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao arquivar a paciente." },
      { status: 500 }
    );
  }
}
