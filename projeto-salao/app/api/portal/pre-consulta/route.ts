import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { requireAuthorizedStaff, requireClientAccess, buildJsonError } from "@/lib/server/tenantAccess";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();

  if (!token || !UUID_PATTERN.test(token)) {
    return NextResponse.json({ error: "Token inválido." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const { nome, whatsapp, queixaPrincipal, objetivoTratamento, alergias, medicacoes, observacoes, consentimentoDados, consentimentoImagem } = body as {
    nome: string; whatsapp: string; queixaPrincipal: string; objetivoTratamento?: string; alergias?: string; medicacoes?: string; observacoes?: string; consentimentoDados: boolean; consentimentoImagem: boolean;
  };

  if (!queixaPrincipal || !consentimentoDados) {
    return NextResponse.json({ error: "Preencha a queixa principal e aceite os termos." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data: clientData, error: clientError } = await supabase
      .from("clientes")
      .select("id, nome, token_pre_consulta, link_ativo, pre_consulta_respondida_em")
      .eq("portal_token", token)
      .is("deleted_at", null)
      .single();

    if (clientError || !clientData) return NextResponse.json({ error: "Link não encontrado." }, { status: 404 });
    if (clientData.pre_consulta_respondida_em) return NextResponse.json({ error: "Avaliação já foi respondida." }, { status: 400 });
    if (!clientData.link_ativo || !clientData.token_pre_consulta) return NextResponse.json({ error: "Link expirado ou desativado." }, { status: 400 });

    const payload = { nome, whatsapp, queixaPrincipal, objetivoTratamento: objetivoTratamento || null, alergias: alergias || null, medicacoes: medicacoes || null, observacoes: observacoes || null, consentimentoDados, consentimentoImagem: consentimentoImagem || false };

    const { error: submitError } = await supabase.rpc("submit_pre_consultation", { p_token: clientData.token_pre_consulta, p_payload: payload });
    if (submitError) {
      console.error("[portal/pre-consulta] RPC error:", JSON.stringify(submitError));
      return NextResponse.json({ error: "Erro ao enviar avaliação." }, { status: 500 });
    }

    return NextResponse.json({ status: "submitted", patientName: nome });
  } catch (err) {
    console.error("[portal/pre-consulta] Unexpected error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso não permite gerenciar links.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return buildJsonError("Dados inválidos.", 400);
  }

  const { clientId, active } = body as { clientId: string; active: boolean };

  if (!clientId || typeof active !== "boolean") {
    return buildJsonError("ID do cliente e status são obrigatórios.", 400);
  }

  const access = await requireClientAccess(
    authContext,
    clientId,
    "Seu acesso não permite gerenciar este paciente.",
    "Cliente inválido."
  );
  if (access.response) {
    return access.response || buildJsonError("Cliente inválido.", 404);
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data: clientCheck, error: checkError } = await supabase
      .from("clientes")
      .select("id, link_ativo, token_pre_consulta")
      .eq("id", clientId)
      .single();

    if (checkError || !clientCheck) {
      console.error("[portal/pre-consulta/toggle] Client not found:", clientId, checkError);
      return buildJsonError("Cliente não encontrado.", 404);
    }

    if (active && !clientCheck.token_pre_consulta) {
      return buildJsonError("Gere o link do portal antes de ativar a avaliação.", 400);
    }

    const { error } = await supabase
      .from("clientes")
      .update({ link_ativo: active })
      .eq("id", clientId);

    if (error) {
      console.error("[portal/pre-consulta/toggle] Update error:", JSON.stringify(error));
      return buildJsonError("Não foi possível alterar o status.", 500);
    }

    console.log("[portal/pre-consulta/toggle] Updated link_ativo to", active, "for client", clientId);

    return NextResponse.json({ linkActive: active });
  } catch (err) {
    console.error("[portal/pre-consulta/toggle] Unexpected error:", err);
    return buildJsonError("Erro interno.", 500);
  }
}
