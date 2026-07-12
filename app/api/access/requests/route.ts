import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { requireAdminRequest, resolveOperationActor } from "@/lib/server/requestGuards";
import { buildAuthConfirmationUrl } from "@/lib/server/authLinks";
import { sendAccessApprovedEmail } from "@/lib/server/accessEmails";
import { buildTrustedAppUrl } from "@/lib/server/trustedOrigin";

const updateRequestSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "denied"]),
});

export async function GET(request: NextRequest) {
  const authResponse = requireAdminRequest(request);
  if (authResponse) {
    return authResponse;
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";

  try {
    const admin = createSupabaseAdminClient();

    const query = admin
      .from("access_requests")
      .select(
        "id, email, requester_user_id, full_name, phone, instagram_handle, justification, auth_provider, email_verified, avatar_url, reviewed_by, status, created_at, updated_at, approved_at, password_setup_email_sent_at"
      )
      .order("created_at", { ascending: false });

    if (status !== "all") {
      query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[access] Erro ao listar solicitações:", error);
      return NextResponse.json({ error: "Não foi possível carregar as solicitações." }, { status: 500 });
    }

    return NextResponse.json({ requests: data || [] }, { status: 200 });
  } catch (error) {
    console.error("[access] Erro ao listar solicitações:", error);
    return NextResponse.json({ error: "Não foi possível carregar as solicitações." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authResponse = requireAdminRequest(request);
  if (authResponse) {
    return authResponse;
  }

  const parsedBody = updateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { id, status } = parsedBody.data;
  const actor = resolveOperationActor(request);

  try {
    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();

    const { data: existing, error: fetchError } = await admin
      .from("access_requests")
      .select(
        "id, email, full_name, phone, instagram_handle, justification, auth_provider, email_verified, status, approved_at"
      )
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
    }

    if (status === "approved") {
      const setupPasswordRedirectUrl = buildTrustedAppUrl("/login?mode=setup-password", request);
      const { data: magicLinkData, error: magicLinkError } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: existing.email,
        options: {
          redirectTo: setupPasswordRedirectUrl,
        },
      });

      if (magicLinkError || !magicLinkData.properties?.hashed_token) {
        console.error("[access] Erro ao gerar link de criação de senha:", magicLinkError);
        return NextResponse.json({ error: "Não foi possível gerar o link de criação de senha agora." }, { status: 500 });
      }

      if (existing.status !== "approved") {
        const { error: approveError } = await admin
          .from("access_requests")
          .update({
            status: "approved",
            reviewed_by: actor,
            approved_at: now,
            updated_at: now,
          })
          .eq("id", id);

        if (approveError) {
          console.error("[access] Erro ao aprovar solicitação:", approveError);
          return NextResponse.json({ error: "Não foi possível aprovar a solicitação." }, { status: 500 });
        }
      }

      try {
        const setupPasswordUrl = buildAuthConfirmationUrl(request, {
          tokenHash: magicLinkData.properties.hashed_token,
          type: "magiclink",
          nextPath: "/login?mode=setup-password",
        });
        await sendAccessApprovedEmail({
          email: existing.email,
          fullName: existing.full_name || null,
          setupPasswordUrl,
        });
      } catch (emailError) {
        console.error("[access] Erro ao enviar e-mail de liberação:", emailError);
        return NextResponse.json(
          {
            error:
              existing.status === "approved"
                ? "O acesso continua aprovado, mas o e-mail de criação de senha falhou. Tente reenviar novamente."
                : "A solicitação foi aprovada, mas o e-mail de criação de senha falhou. Clique em aprovar novamente para reenviar.",
          },
          { status: 500 }
        );
      }

      const { error: sentAtError } = await admin
        .from("access_requests")
        .update({
          reviewed_by: actor,
          password_setup_email_sent_at: now,
          updated_at: now,
        })
        .eq("id", id);

      if (sentAtError) {
        console.error("[access] Erro ao registrar envio do link de senha:", sentAtError);
      }

      const actionLabel = existing.status === "approved" ? "reenviado" : "aprovado";
      console.log(`[access] Solicitação ${id} (${existing.email}) ${actionLabel} por ${actor}`);

      return NextResponse.json(
        {
          message:
            existing.status === "approved"
              ? "E-mail de criação de senha reenviado com sucesso."
              : "Solicitação aprovada e e-mail de criação de senha enviado.",
          request: { id, email: existing.email, status: "approved" },
        },
        { status: 200 }
      );
    }

    const { error: updateError } = await admin
      .from("access_requests")
      .update({
        status,
        reviewed_by: actor,
        approved_at: null,
        updated_at: now,
      })
      .eq("id", id);

    if (updateError) {
      console.error("[access] Erro ao atualizar solicitação:", updateError);
      return NextResponse.json({ error: "Não foi possível atualizar a solicitação." }, { status: 500 });
    }

    console.log(`[access] Solicitação ${id} (${existing.email}) recusado por ${actor}`);

    return NextResponse.json({
      message: "Solicitação recusada com sucesso.",
      request: { id, email: existing.email, status },
    }, { status: 200 });
  } catch (error) {
    console.error("[access] Erro ao atualizar solicitação:", error);
    return NextResponse.json({ error: "Não foi possível atualizar a solicitação." }, { status: 500 });
  }
}

export const POST = PUT;
