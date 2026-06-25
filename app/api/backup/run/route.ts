import { NextResponse } from "next/server";
import { runBackupExport } from "@/lib/server/backup";
import { requireAdminRequest, resolveOperationActor } from "@/lib/server/requestGuards";
import { buildJsonError } from "@/lib/server/tenantAccess";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authResponse = requireAdminRequest(request);
  if (authResponse) {
    return authResponse;
  }

  try {
    const result = await runBackupExport("manual", {
      route: "/api/backup/run",
      method: request.method,
      actor: resolveOperationActor(request),
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("backup run error:", error);
    return buildJsonError(
      error instanceof Error ? error.message : "Falha ao executar o backup clinico.",
      500
    );
  }
}
