import { NextResponse } from "next/server";
import { z } from "zod";
import { archiveClient } from "@/lib/server/recovery";
import { requireAuthorizedStaff, buildJsonError } from "@/lib/server/tenantAccess";

const archiveClientSchema = z.object({
  clientId: z.string().uuid(),
  reason: z.string().trim().max(240).optional(),
});

export async function POST(request: Request) {
  const authContext = await requireAuthorizedStaff(request);
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const parsedBody = archiveClientSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    console.error("archive client validation error:", parsedBody.error);
    return buildJsonError("Payload invalido para arquivar a paciente.", 400);
  }

  console.log("archive client request:", parsedBody.data);

  try {
    const result = await archiveClient(
      parsedBody.data.clientId,
      authContext.userId,
      parsedBody.data.reason || "Arquivamento administrativo com quarentena de midias."
    );
    console.log("archive client result:", result);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("archive client error:", error);
    const message = error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "Falha ao arquivar a paciente.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
