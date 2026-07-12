import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { readSignedJsonCookieValue, timingSafeEqualHex } from "@/lib/server/signedCookie";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createTwoFactorVerificationCookieValue,
  readSessionIdFromAccessToken,
  TWO_FACTOR_VERIFIED_COOKIE,
  TWO_FACTOR_VERIFIED_MAX_AGE_SECONDS,
} from "@/lib/twoFactorVerification";
import crypto from "crypto";

const TWO_FA_COOKIE_SCOPE = "auth:2fa:v1";

type PendingTwoFactorPayload = {
  email: string;
  hash: string;
  exp: number;
  provider?: "password" | "google";
};

function hashOTP(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Codigo invalido." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const payloadRaw = cookieStore.get("2fa_payload")?.value;
  if (!payloadRaw) {
    return NextResponse.json(
      { error: "Sessao de verificacao expirada. Solicite um novo codigo." },
      { status: 400 }
    );
  }

  const payload = readSignedJsonCookieValue<PendingTwoFactorPayload>(
    TWO_FA_COOKIE_SCOPE,
    payloadRaw
  );
  if (!payload) {
    return NextResponse.json({ error: "Sessao de verificacao invalida." }, { status: 400 });
  }

  if (Date.now() > payload.exp) {
    return NextResponse.json({ error: "Codigo expirado. Solicite um novo." }, { status: 400 });
  }

  if (!timingSafeEqualHex(hashOTP(code), payload.hash)) {
    return NextResponse.json({ error: "Codigo incorreto." }, { status: 401 });
  }

  const provider = payload.provider === "google" ? "google" : "password";
  if (provider === "password" && !password) {
    return NextResponse.json(
      { error: "A senha nao esta mais disponivel. Inicie o acesso novamente." },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    let userId: string | null = null;
    let userEmail: string | null = null;
    let accessToken: string | null = null;

    if (provider === "password") {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: payload.email,
        password,
      });

      if (error || !data.user || !data.session) {
        return NextResponse.json(
          { error: "E-mail ou senha invalidos. Inicie o acesso novamente." },
          { status: 401 }
        );
      }

      userId = data.user.id;
      userEmail = data.user.email?.toLowerCase().trim() || null;
      accessToken = data.session.access_token;
    } else {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (userError || !user || !session) {
        return NextResponse.json({ error: "Sessao do Google expirada." }, { status: 401 });
      }

      userId = user.id;
      userEmail = user.email?.toLowerCase().trim() || null;
      accessToken = session.access_token;
    }

    if (!userId || userEmail !== payload.email.toLowerCase().trim()) {
      return NextResponse.json({ error: "A sessao nao corresponde ao codigo enviado." }, { status: 401 });
    }

    const sessionId = readSessionIdFromAccessToken(accessToken);
    if (!sessionId) {
      return NextResponse.json(
        { error: "Nao foi possivel validar a sessao com seguranca." },
        { status: 500 }
      );
    }

    const verificationCookie = await createTwoFactorVerificationCookieValue(userId, sessionId);
    const response = NextResponse.json({ success: true });
    response.headers.set("X-RateLimit-Limit", "10");
    response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
    response.headers.set("X-RateLimit-Reset", String(rateLimit.resetAt));
    response.cookies.set(TWO_FACTOR_VERIFIED_COOKIE, verificationCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: TWO_FACTOR_VERIFIED_MAX_AGE_SECONDS,
      path: "/",
    });
    response.cookies.set("2fa_payload", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    console.warn("[auth/2fa/verify] Verification unavailable", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Nao foi possivel validar o codigo agora." }, { status: 500 });
  }
}
