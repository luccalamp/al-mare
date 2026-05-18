import { NextResponse } from "next/server";
import { requireAuthorizedStaff } from "@/lib/server/tenantAccess";
import { getGoogleCalendarAuthUrl, resolveGoogleCalendarRedirectUri } from "@/lib/server/googleCalendarAuth";
import crypto from "crypto";

export async function GET(request: Request) {
  const authContext = await requireAuthorizedStaff(request);
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const state = crypto.randomUUID();
  const redirectUri = resolveGoogleCalendarRedirectUri(request);
  const authUrl = getGoogleCalendarAuthUrl(state, redirectUri);

  console.log("[gcal-connect] === START ===");
  console.log("[gcal-connect] redirectUri:", redirectUri);
  console.log("[gcal-connect] authUrl:", authUrl);

  const response = NextResponse.json({ authUrl, state, redirectUri });
  return response;
}
