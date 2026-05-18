import { NextResponse } from "next/server";
import { requireAuthorizedStaff } from "@/lib/server/tenantAccess";
import { readStoredTokens } from "@/lib/server/googleCalendarAuth";

export async function GET(request: Request) {
  const authContext = await requireAuthorizedStaff(request);
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const tokens = readStoredTokens();

  if (process.env.NODE_ENV !== "production") {
    console.log("[gcal-session] tokens:", tokens ? "found" : "not found", "email:", tokens?.email);
  }

  if (!tokens) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    email: tokens.email,
    expiresAt: tokens.expires_at,
  });
}
