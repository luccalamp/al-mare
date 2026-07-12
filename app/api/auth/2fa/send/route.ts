import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { readServerEnv } from "@/lib/server/supabaseAdmin";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { createSignedJsonCookieValue } from "@/lib/server/signedCookie";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TWO_FACTOR_VERIFIED_COOKIE } from "@/lib/twoFactorVerification";
import crypto from "crypto";

const TWO_FA_COOKIE_SCOPE = "auth:2fa:v1";

function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function hashOTP(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente." },
      { status: 429 }
    );
  }

  const { email, password } = await request.json().catch(() => ({ email: "", password: "" }));
  const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";
  const isGoogleOAuth = password === "__google_oauth__";

  if (!normalizedEmail || !normalizedEmail.includes("@") || typeof password !== "string" || !password) {
    return NextResponse.json({ error: "E-mail e senha são obrigatórios." }, { status: 400 });
  }

  try {
    const resendApiKey = readServerEnv("RESEND_API_KEY");
    if (!resendApiKey) {
      if (process.env.NODE_ENV !== "production") {
        console.error("2fa send: RESEND_API_KEY missing");
      }
      return NextResponse.json({ error: "Nao foi possivel enviar o codigo de verificacao." }, { status: 500 });
    }

    const supabaseUrl = readServerEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabasePublishableKey =
      readServerEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") || readServerEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabasePublishableKey) {
      if (process.env.NODE_ENV !== "production") {
        console.error("2fa send: Supabase public config missing");
      }
      return NextResponse.json({ error: "Nao foi possivel enviar o codigo de verificacao." }, { status: 500 });
    }

    if (isGoogleOAuth) {
      const sessionClient = await createServerSupabaseClient();
      const {
        data: { user },
        error: sessionError,
      } = await sessionClient.auth.getUser();

      if (
        sessionError ||
        !user?.email ||
        user.email.toLowerCase().trim() !== normalizedEmail
      ) {
        return NextResponse.json({ error: "Sessao do Google invalida ou expirada." }, { status: 401 });
      }
    } else {
      const authClient = createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      const { error: passwordError } = await authClient.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (passwordError) {
        if (process.env.NODE_ENV !== "production") {
          console.error("2fa password validation error:", passwordError);
        }
        return NextResponse.json(
          { error: "E-mail ou senha inválidos. Confira os dados e tente novamente." },
          { status: 401 }
        );
      }
    }

    const code = generateOTP();
    const codeHash = hashOTP(code);
    const expiresAt = Date.now() + 10 * 60 * 1000;

    const payload = createSignedJsonCookieValue(TWO_FA_COOKIE_SCOPE, {
      email: normalizedEmail,
      hash: codeHash,
      exp: expiresAt,
      provider: isGoogleOAuth ? "google" : "password",
    });

    const response = NextResponse.json({ sent: true });

    response.headers.set("X-RateLimit-Limit", "5");
    response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
    response.headers.set("X-RateLimit-Reset", String(rateLimit.resetAt));

    response.cookies.set("2fa_payload", payload, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60,
      path: "/",
    });
    response.cookies.set(TWO_FACTOR_VERIFIED_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    const resend = new Resend(resendApiKey);
    const { error: sendError } = await resend.emails.send({
      from: "Al'maré Saúde Capilar <contato@jakoliveira.com.br>",
      to: normalizedEmail,
      subject: "Seu código de verificação — Al'maré",
      html: `
        <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #fdfaf5; border-radius: 24px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 24px; color: #7a4921; letter-spacing: 0.12em; font-weight: 600;">AL'MARÉ</span>
            <span style="display: block; font-size: 10px; color: #9a6d3a; letter-spacing: 0.32em; text-transform: uppercase; margin-top: 4px;">Saúde Capilar</span>
          </div>
          <h1 style="font-size: 18px; color: #1d1d1f; text-align: center;">Código de verificação</h1>
          <p style="font-size: 14px; color: #5a5348; text-align: center; line-height: 1.6;">
            Use o código abaixo para concluir seu acesso ao ambiente clínico.
          </p>
          <div style="background: #fff; border: 1px solid #e7dccd; border-radius: 16px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 42px; letter-spacing: 0.2em; font-weight: 700; color: #7a4921;">${code}</span>
          </div>
          <p style="font-size: 12px; color: #9a6d3a; text-align: center;">
            Este código expira em 10 minutos.
          </p>
          <p style="font-size: 11px; color: #b8a48a; text-align: center; margin-top: 24px;">
            Se você não solicitou este código, ignore este e-mail.
          </p>
        </div>
      `,
    });

    if (sendError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("2fa resend error:", sendError);
      }
      return NextResponse.json({ error: "Erro ao enviar e-mail de verificação." }, { status: 500 });
    }

    return response;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("2fa send error:", error);
    }
    return NextResponse.json({ error: "Não foi possível enviar o código de verificação." }, { status: 500 });
  }
}
