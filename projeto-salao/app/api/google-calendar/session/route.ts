import { NextResponse } from "next/server";
import { requireAuthorizedStaff } from "@/lib/server/tenantAccess";
import { readStoredTokens } from "@/lib/server/googleCalendarAuth";

export async function GET(request: Request) {
  const authContext = await requireAuthorizedStaff(request);
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const tokens = readStoredTokens();

  console.log("[gcal-session] === CHECK ===");
  console.log("[gcal-session] tokens:", tokens ? "found" : "not found");
  if (tokens) {
    console.log("[gcal-session] email:", tokens.email);
    console.log("[gcal-session] expiresAt:", new Date(tokens.expires_at).toISOString());
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
