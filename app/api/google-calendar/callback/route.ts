import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForTokens, readStoredTokens, resolveGoogleCalendarRedirectUri, storeTokens } from "@/lib/server/googleCalendarAuth";
import crypto from "crypto";

const OAUTH_STATE_COOKIE = "gcal_oauth_state";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = body?.code;
    const state = body?.state;

    if (!code) {
      return NextResponse.json({ error: "Código OAuth ausente." }, { status: 400 });
    }

    if (!state) {
      return NextResponse.json({ error: "State OAuth ausente." }, { status: 400 });
    }

    const cookieStore = cookies();
    const expectedStateHash = cookieStore.get(OAUTH_STATE_COOKIE)?.value;

    if (!expectedStateHash) {
      return NextResponse.json({ error: "Sessão OAuth expirada. Inicie a conexão novamente." }, { status: 400 });
    }

    const stateHash = crypto.createHash("sha256").update(state).digest("hex");
    const stateHashBuffer = Buffer.from(stateHash);
    const expectedStateHashBuffer = Buffer.from(expectedStateHash);
    if (
      stateHashBuffer.length !== expectedStateHashBuffer.length ||
      !crypto.timingSafeEqual(stateHashBuffer, expectedStateHashBuffer)
    ) {
      return NextResponse.json({ error: "State OAuth inválido. Possível tentativa de CSRF." }, { status: 403 });
    }

    const redirectUri = resolveGoogleCalendarRedirectUri(request);

    const existingTokens = readStoredTokens();
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    const storedTokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || existingTokens?.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
      email: tokens.email,
    };

    const response = storeTokens(storedTokens, NextResponse.json({ success: true }));
    response.cookies.set(OAUTH_STATE_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
    response.cookies.set("gcal_connected", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Falha ao completar a autenticação com o Google." },
      { status: 500 }
    );
  }
}
