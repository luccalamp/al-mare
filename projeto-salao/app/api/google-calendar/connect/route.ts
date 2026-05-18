import { NextResponse } from "next/server";
import { requireAuthorizedStaff } from "@/lib/server/tenantAccess";
import { getGoogleCalendarAuthUrl } from "@/lib/server/googleCalendarAuth";
import crypto from "crypto";

export async function GET(request: Request) {
  const authContext = await requireAuthorizedStaff(request);
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const state = crypto.randomUUID();
  const authUrl = getGoogleCalendarAuthUrl(state);

  const response = NextResponse.json({ authUrl, state });
  return response;
}
