import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { requireAuthenticatedUser } from "@/lib/server/tenantAccess";
import { buildAccessRequestIdentitySnapshot } from "@/lib/accessRequests";
import {
  sendAccessRequestAdminNotificationEmail,
  sendAccessRequestReceiptEmail,
} from "@/lib/server/accessEmails";
import { buildTrustedAppUrl } from "@/lib/server/trustedOrigin";

const requestSchema = z.object({
  fullName: z.string().trim().min(3, "Informe seu nome completo.").max(120, "Nome muito longo."),
  phone: z.string().trim().min(8, "Informe um WhatsApp para contato.").max(30, "WhatsApp inválido."),
  instagramHandle: z.string().trim().max(60, "Instagram muito longo.").optional(),
  justification: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const authContext = await requireAuthenticatedUser(request);
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const parsedBody = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0]?.message || "Payload inválido." }, { status: 400 });
  }

  const email = authContext.user.email?.toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: "Sua conta autenticada não possui um email válido." }, { status: 400 });
  }

  const adminReviewUrl = buildTrustedAppUrl("/admin/acessos", request);
  const requestSnapshot = buildAccessRequestIdentitySnapshot(authContext.user, {
    fullName: parsedBody.data.fullName,
    phone: parsedBody.data.phone,
    instagramHandle: parsedBody.data.instagramHandle || "",
    justification: parsedBody.data.justification || "",
  });
  const now = new Date().toISOString();

  try {
    const admin = createSupabaseAdminClient();

    const { data: existing } = await admin
      .from("access_requests")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      if (existing.status === "approved") {
        return NextResponse.json({ message: "Este email já foi aprovado. Você já pode acessar o sistema." }, { status: 200 });
      }

      const { error: updateError } = await admin
        .from("access_requests")
        .update({
          ...requestSnapshot,
          status: "pending",
          reviewed_by: null,
          approved_at: null,
          password_setup_email_sent_at: null,
          updated_at: now,
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("[access] Erro ao atualizar solicitação existente:", updateError);
        return NextResponse.json({ error: "Não foi possível atualizar sua solicitação agora." }, { status: 500 });
      }

      void Promise.allSettled([
        sendAccessRequestAdminNotificationEmail({
          email,
          fullName: requestSnapshot.full_name,
          phone: requestSnapshot.phone,
          instagramHandle: requestSnapshot.instagram_handle,
          justification: requestSnapshot.justification,
          authProvider: requestSnapshot.auth_provider,
          emailVerified: requestSnapshot.email_verified,
          adminReviewUrl,
        }),
        sendAccessRequestReceiptEmail({
          email,
          fullName: requestSnapshot.full_name,
          phone: requestSnapshot.phone,
          instagramHandle: requestSnapshot.instagram_handle,
          justification: requestSnapshot.justification,
          authProvider: requestSnapshot.auth_provider,
          emailVerified: requestSnapshot.email_verified,
        }),
      ]);

      return NextResponse.json(
        {
          message:
            existing.status === "pending"
              ? "Seus dados foram atualizados. Sua solicitação continua em análise."
              : "Sua solicitação foi reenviada com os novos dados. Aguarde a aprovação do administrador.",
        },
        { status: 200 }
      );
    }

    const { error: insertError } = await admin.from("access_requests").insert({
      email,
      ...requestSnapshot,
      status: "pending",
      reviewed_by: null,
      approved_at: null,
      password_setup_email_sent_at: null,
    });

    if (insertError) {
      console.error("[access] Erro ao inserir solicitação:", insertError);
      return NextResponse.json({ error: "Não foi possível registrar sua solicitação agora." }, { status: 500 });
    }

    void Promise.allSettled([
      sendAccessRequestAdminNotificationEmail({
        email,
        fullName: requestSnapshot.full_name,
        phone: requestSnapshot.phone,
        instagramHandle: requestSnapshot.instagram_handle,
        justification: requestSnapshot.justification,
        authProvider: requestSnapshot.auth_provider,
        emailVerified: requestSnapshot.email_verified,
        adminReviewUrl,
      }),
      sendAccessRequestReceiptEmail({
        email,
        fullName: requestSnapshot.full_name,
        phone: requestSnapshot.phone,
        instagramHandle: requestSnapshot.instagram_handle,
        justification: requestSnapshot.justification,
        authProvider: requestSnapshot.auth_provider,
        emailVerified: requestSnapshot.email_verified,
      }),
    ]);

    return NextResponse.json({ message: "Solicitação enviada com sucesso! Você receberá acesso assim que for aprovado." }, { status: 201 });
  } catch (error) {
    console.error("[access] Erro ao criar solicitação:", error);
    return NextResponse.json(
      { error: "Não foi possível enviar sua solicitação agora. Tente novamente em instantes." },
      { status: 500 }
    );
  }
}
