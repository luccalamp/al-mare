import { NextResponse } from "next/server";
import { runBackupExport } from "@/lib/server/backup";
import { buildJsonError, requireAuthorizedStaff } from "@/lib/server/tenantAccess";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso nao permite executar backups.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  try {
    const result = await runBackupExport("manual", {
      route: "/api/backup/run",
      method: request.method,
      actor: authContext.userId,
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
