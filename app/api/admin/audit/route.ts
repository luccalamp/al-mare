import { NextResponse } from "next/server";
import { listOwnedAuditEntries } from "@/lib/server/recovery";
import { requireAuthorizedStaff } from "@/lib/server/tenantAccess";
import { safeErrorMessage } from "@/lib/server/safeError";

export async function GET(request: Request) {
  const authContext = await requireAuthorizedStaff(request);
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  try {
    const { searchParams } = new URL(request.url);
    const tableName = searchParams.get("table")?.trim() || undefined;
    const recordId = searchParams.get("recordId")?.trim() || undefined;
    const transactionIdValue = searchParams.get("transactionId")?.trim() || undefined;
    const limitValue = Number(searchParams.get("limit") || "60");
    const transactionId = transactionIdValue ? Number(transactionIdValue) : undefined;

    const entries = await listOwnedAuditEntries(
      authContext.userId,
      tableName,
      recordId ? { id: recordId } : undefined,
      Number.isFinite(transactionId) ? transactionId : undefined,
      Number.isFinite(limitValue) ? limitValue : 60
    );

    return NextResponse.json({ entries }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Falha ao carregar o log de auditoria.") },
      { status: 500 }
    );
  }
}
