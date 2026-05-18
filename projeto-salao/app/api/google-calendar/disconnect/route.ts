import { NextResponse } from "next/server";
import { requireAuthorizedStaff } from "@/lib/server/tenantAccess";
import { clearStoredTokens } from "@/lib/server/googleCalendarAuth";

export async function POST(request: Request) {
  const authContext = await requireAuthorizedStaff(request);
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  return clearStoredTokens();
}
