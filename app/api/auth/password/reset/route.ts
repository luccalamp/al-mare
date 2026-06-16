import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseAdminClient, readServerEnv } from "@/lib/server/supabaseAdmin";
import { checkRateLimit } from "@/lib/server/rateLimit";

type SupabaseGenerateLinkError = {
  code?: string;
  message?: string;
  status?: number;
};

function buildRecoveryEmailHtml(resetUrl: string) {
  return `
    <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #fdfaf5; border-radius: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 24px; color: #7a4921; letter-spacing: 0.12em; font-weight: 600;">AL'MARE</span>
        <span style="display: block; font-size: 10px; color: #9a6d3a; letter-spacing: 0.32em; text-transform: uppercase; margin-top: 4px;">Saude Capilar</span>
      </div>
      <h1 style="font-size: 18px; color: #1d1d1f; text-align: center;">Recuperacao de senha</h1>
      <p style="font-size: 14px; color: #5a5348; text-align: center; line-height: 1.6;">
        Clique no botao abaixo para definir uma nova senha e voltar ao ambiente clinico.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a
          href="${resetUrl}"
          style="display: inline-block; padding: 14px 24px; background: #7a4921; color: #ffffff; text-decoration: none; border-radius: 999px; font-weight: 600;"
        >
          Redefinir senha
        </a>
      </div>
      <p style="font-size: 12px; color: #9a6d3a; text-align: center; line-height: 1.6;">
        Se o botao nao abrir, copie este link no navegador:
      </p>
      <p style="font-size: 11px; color: #8b7760; text-align: center; word-break: break-word;">
        ${resetUrl}
      </p>
      <p style="font-size: 11px; color: #b8a48a; text-align: center; margin-top: 24px;">
        Se voce nao solicitou esta troca, ignore este e-mail.
      </p>
    </div>
  `;
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente." },
      { status: 429 }
    );
  }

  const { email } = await request.json().catch(() => ({ email: "" }));
  const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return NextResponse.json({ error: "Informe um e-mail valido." }, { status: 400 });
  }

  const resendApiKey = readServerEnv("RESEND_API_KEY");
  if (!resendApiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY nao configurada." }, { status: 500 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const redirectTo = new URL("/login?mode=reset-password", request.url).toString();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: {
        redirectTo,
      },
    });

    if (error || !data.properties?.action_link) {
      const typedError = error as SupabaseGenerateLinkError | null;

      if (typedError?.status && typedError.status >= 500) {
        console.error("[auth/password/reset] generateLink error:", typedError);
        return NextResponse.json({ error: "Nao foi possivel preparar o link de redefinicao agora." }, { status: 500 });
      }

      if (process.env.NODE_ENV !== "production") {
        console.warn("[auth/password/reset] generateLink fallback:", typedError);
      }

      return NextResponse.json({ sent: true });
    }

    const resend = new Resend(resendApiKey);
    const { error: sendError } = await resend.emails.send({
      from: "Al'mare Saude Capilar <contato@jakoliveira.com.br>",
      to: normalizedEmail,
      subject: "Recuperacao de senha - Al'mare",
      html: buildRecoveryEmailHtml(data.properties.action_link),
    });

    if (sendError) {
      console.error("[auth/password/reset] resend error:", sendError);
      return NextResponse.json({ error: "Nao foi possivel enviar o e-mail de redefinicao agora." }, { status: 500 });
    }

    const response = NextResponse.json({ sent: true });
    response.headers.set("X-RateLimit-Limit", "5");
    response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
    response.headers.set("X-RateLimit-Reset", String(rateLimit.resetAt));
    return response;
  } catch (error) {
    console.error("[auth/password/reset] unexpected error:", error);
    return NextResponse.json({ error: "Nao foi possivel enviar o link de redefinicao agora." }, { status: 500 });
  }
}
