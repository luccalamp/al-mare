import { NextResponse } from "next/server";
import { runBackupExport } from "@/lib/server/backup";
import { requireCronOrAdminRequest } from "@/lib/server/requestGuards";

async function handleRequest(request: Request) {
  const authResponse = requireCronOrAdminRequest(request);
  if (authResponse) {
    return authResponse;
  }

  try {
    const triggerSource = request.headers.get("x-admin-token") ? "manual" : "vercel-cron";
    const result = await runBackupExport(triggerSource, {
      route: "/api/internal/backups/export",
      method: request.method,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao executar o backup clinico." },
      { status: 500 }
    );
  }
}

export function GET(request: Request) {
  return handleRequest(request);
}

export function POST(request: Request) {
  return handleRequest(request);
}
