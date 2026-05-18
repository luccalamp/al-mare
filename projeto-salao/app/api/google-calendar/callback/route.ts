import { NextResponse } from "next/server";
import { exchangeCodeForTokens, storeTokens } from "@/lib/server/googleCalendarAuth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = body?.code;

    if (!code) {
      return NextResponse.json({ error: "Código OAuth ausente." }, { status: 400 });
    }

    const tokens = await exchangeCodeForTokens(code);

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

    return response;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Google Calendar OAuth callback error:", err);
    }
    return NextResponse.json({ error: "Falha ao completar a autenticação com o Google." }, { status: 500 });
  }
}
