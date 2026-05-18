import nodemailer from "nodemailer";
import { ADMIN_EMAIL } from "@/lib/adminEmail";
import { getAuthProviderLabel } from "@/lib/accessRequests";

type AccessRequestNotificationEmailInput = {
  email: string;
  fullName: string | null;
  phone: string | null;
  instagramHandle: string | null;
  justification: string | null;
  authProvider: string | null;
  emailVerified: boolean;
  adminReviewUrl: string;
};

type AccessApprovalEmailInput = {
  email: string;
  fullName: string | null;
  setupPasswordUrl: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatField(value: string | null | undefined, fallback = "Não informado") {
  if (!value) {
    return fallback;
  }

  return escapeHtml(value);
}

function createMailer() {
  if (!ADMIN_EMAIL) {
    throw new Error("ADMIN_EMAIL não configurado para o envio dos e-mails de acesso.");
  }

  const smtpPass = process.env.SMTP_PASS?.trim();
  if (!smtpPass) {
    throw new Error("SMTP_PASS não configurado para o envio dos e-mails de acesso.");
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: ADMIN_EMAIL,
      pass: smtpPass,
    },
  });
}

async function sendAccessEmail(to: string, subject: string, html: string, text: string) {
  const transporter = createMailer();

  await transporter.sendMail({
    from: `"Al'maré Saúde Capilar" <${ADMIN_EMAIL}>`,
    to,
    subject,
    html,
    text,
  });
}

export async function sendAccessRequestAdminNotificationEmail(input: AccessRequestNotificationEmailInput) {
  const providerLabel = getAuthProviderLabel(input.authProvider);
  const verificationLabel = input.emailVerified ? "Sim" : "Não";
  const instagramLabel = input.instagramHandle ? `@${input.instagramHandle}` : null;

  await sendAccessEmail(
    ADMIN_EMAIL,
    `Nova solicitação de acesso - ${input.fullName || input.email}`,
    `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#2f241b;max-width:640px;">
        <h2 style="margin-bottom:16px;">Nova solicitação de acesso</h2>
        <p><strong>E-mail autenticado:</strong> ${formatField(input.email)}</p>
        <p><strong>Nome informado:</strong> ${formatField(input.fullName)}</p>
        <p><strong>WhatsApp:</strong> ${formatField(input.phone)}</p>
        <p><strong>Instagram:</strong> ${formatField(instagramLabel)}</p>
        <p><strong>Origem do login:</strong> ${formatField(providerLabel)}</p>
        <p><strong>E-mail verificado:</strong> ${verificationLabel}</p>
        <p><strong>Vínculo com a clínica:</strong> ${formatField(input.justification)}</p>
        <p style="margin-top:24px;">
          <a href="${escapeHtml(input.adminReviewUrl)}" style="display:inline-block;padding:12px 18px;background:#7a4921;color:#ffffff;text-decoration:none;border-radius:10px;">
            Revisar solicitações
          </a>
        </p>
      </div>
    `,
    [
      "Nova solicitação de acesso",
      `E-mail autenticado: ${input.email}`,
      `Nome informado: ${input.fullName || "Não informado"}`,
      `WhatsApp: ${input.phone || "Não informado"}`,
      `Instagram: ${instagramLabel || "Não informado"}`,
      `Origem do login: ${providerLabel}`,
      `E-mail verificado: ${verificationLabel}`,
      `Vínculo com a clínica: ${input.justification || "Não informado"}`,
      `Revisar solicitações: ${input.adminReviewUrl}`,
    ].join("\n")
  );
}

export async function sendAccessRequestReceiptEmail(input: Omit<AccessRequestNotificationEmailInput, "adminReviewUrl">) {
  await sendAccessEmail(
    input.email,
    "Recebemos sua solicitação de acesso",
    `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#2f241b;max-width:640px;">
        <h2 style="margin-bottom:16px;">Solicitação recebida</h2>
        <p>Recebemos seu pedido de acesso ao sistema da Al'maré.</p>
        <p><strong>Nome:</strong> ${formatField(input.fullName)}</p>
        <p><strong>WhatsApp:</strong> ${formatField(input.phone)}</p>
        <p><strong>Instagram:</strong> ${formatField(input.instagramHandle ? `@${input.instagramHandle}` : null)}</p>
        <p><strong>Vínculo com a clínica:</strong> ${formatField(input.justification)}</p>
        <p>Quando o acesso for liberado, enviaremos para este mesmo e-mail um link para entrar e criar sua senha.</p>
        <p>Se precisar complementar algo, responda este e-mail ou aguarde o contato da clínica.</p>
      </div>
    `,
    [
      "Solicitação recebida",
      `Nome: ${input.fullName || "Não informado"}`,
      `WhatsApp: ${input.phone || "Não informado"}`,
      `Instagram: ${input.instagramHandle ? `@${input.instagramHandle}` : "Não informado"}`,
      `Vínculo com a clínica: ${input.justification || "Não informado"}`,
      "Quando o acesso for liberado, enviaremos para este mesmo e-mail um link para entrar e criar sua senha.",
    ].join("\n")
  );
}

export async function sendAccessApprovedEmail(input: AccessApprovalEmailInput) {
  const recipientName = input.fullName ? escapeHtml(input.fullName) : "Olá";
  const safeSetupPasswordUrl = escapeHtml(input.setupPasswordUrl);

  await sendAccessEmail(
    input.email,
    "Seu acesso foi liberado - crie sua senha",
    `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#2f241b;max-width:640px;">
        <h2 style="margin-bottom:16px;">Acesso liberado</h2>
        <p>${recipientName}, seu acesso ao sistema da Al'maré foi liberado.</p>
        <p>Use o botão abaixo para entrar e criar sua senha no Supabase. Se você já tiver uma senha, o mesmo link também pode ser usado para redefini-la.</p>
        <p style="margin:24px 0;">
          <a href="${safeSetupPasswordUrl}" style="display:inline-block;padding:12px 18px;background:#7a4921;color:#ffffff;text-decoration:none;border-radius:10px;">
            Entrar e criar minha senha
          </a>
        </p>
        <p>Esse link tem validade limitada. Se expirar, peça o reenvio na tela de acessos ou entre com Google e solicite novamente.</p>
      </div>
    `,
    [
      "Acesso liberado",
      `${input.fullName || "Olá"}, seu acesso ao sistema da Al'maré foi liberado.`,
      "Use o link abaixo para entrar e criar sua senha no Supabase:",
      input.setupPasswordUrl,
      "Esse link tem validade limitada. Se expirar, peça o reenvio na tela de acessos ou entre com Google e solicite novamente.",
    ].join("\n")
  );
}