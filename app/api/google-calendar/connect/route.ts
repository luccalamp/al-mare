import { NextResponse } from "next/server";
import { requireAuthorizedStaff } from "@/lib/server/tenantAccess";
import { getGoogleCalendarAuthUrl, resolveGoogleCalendarRedirectUri } from "@/lib/server/googleCalendarAuth";
import crypto from "crypto";

const OAUTH_STATE_COOKIE = "gcal_oauth_state";
const OAUTH_STATE_MAX_AGE = 10 * 60; // 10 minutes

export async function GET(request: Request) {
  const authContext = await requireAuthorizedStaff(request);
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const state = crypto.randomUUID();
  const stateHash = crypto.createHash("sha256").update(state).digest("hex");
  const redirectUri = resolveGoogleCalendarRedirectUri(request);
  const authUrl = getGoogleCalendarAuthUrl(state, redirectUri);

  const response = NextResponse.json({ authUrl, state, redirectUri });

  response.cookies.set(OAUTH_STATE_COOKIE, stateHash, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: OAUTH_STATE_MAX_AGE,
    path: "/",
  });

  return response;
}
