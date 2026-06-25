import { NextResponse } from "next/server";
import { requireAuthorizedStaff } from "@/lib/server/tenantAccess";
import { applyStoredTokensCookie, getValidAccessToken } from "@/lib/server/googleCalendarAuth";

export async function GET(request: Request) {
  const authContext = await requireAuthorizedStaff(request);
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const auth = await getValidAccessToken();
  if (!auth) {
    return NextResponse.json({ connected: false });
  }

  const response = NextResponse.json({
    connected: true,
    email: auth.email,
    expiresAt: auth.expiresAt,
  });

  if (auth.refreshedTokens) {
    response.headers.set("X-GCal-Token-Refreshed", "true");
    applyStoredTokensCookie(response, auth.refreshedTokens);
  }

  return response;
}
