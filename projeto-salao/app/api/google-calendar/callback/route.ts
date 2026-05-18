import { NextResponse } from "next/server";
import { exchangeCodeForTokens, resolveGoogleCalendarRedirectUri, storeTokens } from "@/lib/server/googleCalendarAuth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = body?.code;

    if (!code) {
      return NextResponse.json({ error: "Código OAuth ausente." }, { status: 400 });
    }

    const redirectUri = resolveGoogleCalendarRedirectUri(request);

    console.log("[gcal-callback] === START ===");
    console.log("[gcal-callback] redirectUri:", redirectUri);
    console.log("[gcal-callback] GOOGLE_CALENDAR_REDIRECT_URI env:", process.env.GOOGLE_CALENDAR_REDIRECT_URI);
    console.log("[gcal-callback] code length:", code.length);

    const tokens = await exchangeCodeForTokens(code, redirectUri);

    console.log("[gcal-callback] tokens received");
    console.log("[gcal-callback] email:", tokens.email);
    console.log("[gcal-callback] has refresh_token:", !!tokens.refresh_token);

    const storedTokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
      email: tokens.email,
    };

    const response = storeTokens(storedTokens);
    response.cookies.set("gcal_connected", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60,
      path: "/",
    });

    console.log("[gcal-callback] === SUCCESS ===");
    return response;
  } catch (err) {
    console.error("[gcal-callback] === ERROR ===");
    console.error("[gcal-callback]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao completar a autenticação com o Google." },
      { status: 500 }
    );
  }
}
