import { NextResponse } from "next/server";
import { listAuditEntries } from "@/lib/server/recovery";
import { requireAdminRequest } from "@/lib/server/requestGuards";

export async function GET(request: Request) {
  const authResponse = requireAdminRequest(request);
  if (authResponse) {
    return authResponse;
  }

  try {
    const { searchParams } = new URL(request.url);
    const tableName = searchParams.get("table")?.trim() || undefined;
    const recordId = searchParams.get("recordId")?.trim() || undefined;
    const transactionIdValue = searchParams.get("transactionId")?.trim() || undefined;
    const limitValue = Number(searchParams.get("limit") || "60");
    const transactionId = transactionIdValue ? Number(transactionIdValue) : undefined;

    const entries = await listAuditEntries(
      tableName,
      recordId ? { id: recordId } : undefined,
      Number.isFinite(transactionId) ? transactionId : undefined,
      Number.isFinite(limitValue) ? limitValue : 60
    );

    return NextResponse.json({ entries }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar o log de auditoria." },
      { status: 500 }
    );
  }
}
