import { NextResponse } from "next/server";
import { requireAuthorizedStaff } from "@/lib/server/tenantAccess";
import { readStoredTokens } from "@/lib/server/googleCalendarAuth";

export async function GET(request: Request) {
  console.log("[gcal-session-api] === CHECK START ===");

  const authContext = await requireAuthorizedStaff(request);
  if (authContext instanceof NextResponse) {
    console.log("[gcal-session-api] Auth failed, status:", authContext.status);
    return authContext;
  }

  console.log("[gcal-session-api] Auth passed for user:", authContext.userId);

  const tokens = readStoredTokens();

  console.log("[gcal-session-api] Tokens found:", !!tokens);
  if (tokens) {
    console.log("[gcal-session-api] Email:", tokens.email);
    console.log("[gcal-session-api] Expires:", new Date(tokens.expires_at).toISOString());
  }

  if (!tokens) {
    console.log("[gcal-session-api] === RETURNING NOT CONNECTED ===");
    return NextResponse.json({ connected: false });
  }

  console.log("[gcal-session-api] === RETURNING CONNECTED ===");
  return NextResponse.json({
    connected: true,
    email: tokens.email,
    expiresAt: tokens.expires_at,
  });
}
