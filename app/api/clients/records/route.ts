import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveManagedPhotoUrl } from "@/lib/server/photoStorage";
import { buildStorageObjectPublicUrl } from "@/lib/server/storageUrls";
import {
  buildJsonError,
  isMissingColumnError,
  requireAuthorizedStaff,
  requireClientAccess,
} from "@/lib/server/tenantAccess";

const appointmentStatusSchema = z.enum(["agendado", "confirmado", "realizado", "cancelado", "faltou"]);
const appointmentOriginSchema = z.enum(["interno", "google_calendar", "n8n", "manual"]);

const nullableTrimmedString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") {
      return null;
    }

    const trimmedValue = value.trim();
    return trimmedValue || null;
  });

const payloadSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("gallery-photo"),
    clientId: z.string().uuid(),
    type: z.string().trim().min(1),
    categoria: nullableTrimmedString,
    caption: nullableTrimmedString,
    storageBucket: z.string().trim().min(1),
    storagePath: z.string().trim().min(1),
    url: nullableTrimmedString,
  }),
  z.object({
    action: z.literal("diagnostico"),
    clientId: z.string().uuid(),
    porosidade: z.number().int().min(1).max(5),
    elasticidade: z.number().int().min(1).max(3),
    historiaQuimicaPrevia: nullableTrimmedString,
    resultadoTesteMecha: z.string(),
  }),
  z.object({
    action: z.literal("procedimento"),
    clientId: z.string().uuid(),
    tecnicaUtilizada: z.string().trim().min(1),
    valor: z.number().nullable().optional(),
    misturaTonalizante: nullableTrimmedString,
    alturaClareamento: z.number().int().min(1).max(10).nullable().optional(),
    fundoClareamentoObtido: nullableTrimmedString,
    volumagemOx: nullableTrimmedString,
  }),
  z.object({
    action: z.literal("homecare"),
    clientId: z.string().uuid(),
    produtosRecomendados: z.string().trim().min(1),
    obsCuidados: nullableTrimmedString,
    dataRetornoSugerida: nullableTrimmedString,
    valorTotal: z.number().positive().nullish(),
    formaPagamento: z.enum(["normal", "avista", "parcelado"]).nullish(),
    parcelas: z.number().int().positive().nullish(),
    pago: z.boolean().nullish(),
    confirmadoEm: nullableTrimmedString,
  }),
  z.object({
    action: z.literal("ficha-anamnese"),
    clientId: z.string().uuid(),
    dados: z.unknown(),
  }),
  z.object({
    action: z.literal("confirmar-pagamento"),
    clientId: z.string().uuid(),
    homecareId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("appointment"),
    clientId: z.string().uuid(),
    titulo: z.string().trim().min(1),
    inicioEm: z.string().trim().min(1),
    fimEm: z.string().trim().min(1),
    status: appointmentStatusSchema,
    origem: appointmentOriginSchema,
    observacoes: nullableTrimmedString,
    googleEventId: nullableTrimmedString,
    googleCalendarId: nullableTrimmedString,
    metadata: z.record(z.string(), z.unknown()).optional().default({}),
  }),
]);

const updateSchema = z.object({
  action: z.literal("link-google-appointment"),
  clientId: z.string().uuid(),
  appointmentId: z.string().uuid(),
  googleEventId: nullableTrimmedString,
  googleCalendarId: nullableTrimmedString,
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

function buildRecordError(error: { message?: string } | null | undefined, fallback: string) {
  const message = error?.message || "";

  if (isMissingColumnError(message)) {
    return buildJsonError("O cadastro clínico ainda não está disponível neste ambiente.", 503);
  }

  console.error("Failed to persist client record:", error);
  return buildJsonError(fallback, 500);
}

export async function POST(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso não permite atualizar registros clínicos.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const parsedBody = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return buildJsonError("Dados clínicos inválidos para esta operação.", 400);
  }

  const { clientId } = parsedBody.data;
  const access = await requireClientAccess(
    authContext,
    clientId,
    "Seu acesso não permite atualizar registros clínicos deste paciente.",
    "Cliente inválido para esta operação."
  );
  if (access.response) {
    return access.response || buildJsonError("Cliente inválido para esta operação.", 404);
  }

  switch (parsedBody.data.action) {
    case "gallery-photo": {
      const canonicalUrl = resolveManagedPhotoUrl(
        parsedBody.data.storageBucket,
        parsedBody.data.storagePath
      ) || parsedBody.data.url || buildStorageObjectPublicUrl(parsedBody.data.storageBucket, parsedBody.data.storagePath) || "";

      const { data, error } = await authContext.admin
        .from("client_photos")
        .insert({
          cliente_id: clientId,
          url: canonicalUrl,
          type: parsedBody.data.type,
          categoria: parsedBody.data.categoria || parsedBody.data.type,
          caption: parsedBody.data.caption,
          storage_bucket: parsedBody.data.storageBucket,
          storage_path: parsedBody.data.storagePath,
        })
        .select("id")
        .single();

      if (error || !data) {
        return buildRecordError(error, "Não foi possível registrar a foto agora.");
      }

      return NextResponse.json({ record: data });
    }

    case "diagnostico": {
      const { data, error } = await authContext.admin
        .from("diagnostico_capilar")
        .insert({
          cliente_id: clientId,
          porosidade: parsedBody.data.porosidade,
          elasticidade: parsedBody.data.elasticidade,
          historia_quimica_previa: parsedBody.data.historiaQuimicaPrevia,
          resultado_teste_mecha: parsedBody.data.resultadoTesteMecha,
        })
        .select("id, created_at, porosidade, elasticidade, historia_quimica_previa, resultado_teste_mecha, presenca_metais")
        .single();

      if (error || !data) {
        return buildRecordError(error, "Não foi possível salvar o diagnóstico agora.");
      }

      return NextResponse.json({ record: data });
    }

    case "procedimento": {
      const { data, error } = await authContext.admin
        .from("historico_procedimentos")
        .insert({
          cliente_id: clientId,
          tecnica_utilizada: parsedBody.data.tecnicaUtilizada,
          valor_procedimento: parsedBody.data.valor ?? null,
          mistura_tonalizante: parsedBody.data.misturaTonalizante,
          altura_clareamento: parsedBody.data.alturaClareamento ?? null,
          fundo_clareamento_obtido: parsedBody.data.fundoClareamentoObtido,
          volumagem_ox: parsedBody.data.volumagemOx,
        })
        .select("*")
        .single();

      if (error || !data) {
        return buildRecordError(error, "Não foi possível salvar o procedimento agora.");
      }

      return NextResponse.json({ record: data });
    }

    case "homecare": {
      const { data, error } = await authContext.admin
        .from("manutencao_homecare")
        .insert({
          cliente_id: clientId,
          produtos_recomendados: parsedBody.data.produtosRecomendados,
          obs_cuidados: parsedBody.data.obsCuidados,
          data_retorno_sugerida: parsedBody.data.dataRetornoSugerida,
          valor_total: parsedBody.data.valorTotal,
          forma_pagamento: parsedBody.data.formaPagamento,
          parcelas: parsedBody.data.parcelas,
          pago: parsedBody.data.pago ?? false,
          confirmado_em: parsedBody.data.confirmadoEm || null,
        })
        .select("id, created_at, produtos_recomendados, obs_cuidados, data_retorno_sugerida, valor_total, forma_pagamento, parcelas, pago, confirmado_em")
        .single();

      if (error || !data) {
        return buildRecordError(error, "Não foi possível salvar o homecare agora.");
      }

      return NextResponse.json({ record: data });
    }

    case "ficha-anamnese": {
      const { data, error } = await authContext.admin
        .from("ficha_anamnese_capilar")
        .upsert(
          {
            cliente_id: clientId,
            dados: parsedBody.data.dados,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "cliente_id" }
        )
        .select("dados")
        .single();

      if (error || !data) {
        return buildRecordError(error, "Não foi possível salvar a ficha clínica agora.");
      }

      return NextResponse.json({ record: data });
    }

    case "confirmar-pagamento": {
      const { data, error } = await authContext.admin
        .from("manutencao_homecare")
        .update({
          pago: true,
          confirmado_em: new Date().toISOString(),
        })
        .eq("id", parsedBody.data.homecareId)
        .select("id, created_at, pago, confirmado_em")
        .single();

      if (error || !data) {
        return buildRecordError(error, "Não foi possível confirmar o pagamento.");
      }

      return NextResponse.json({ record: data });
    }

    case "appointment": {
      const { data, error } = await authContext.admin
        .from("agendamentos")
        .insert({
          cliente_id: clientId,
          titulo: parsedBody.data.titulo,
          inicio_em: parsedBody.data.inicioEm,
          fim_em: parsedBody.data.fimEm,
          status: parsedBody.data.status,
          origem: parsedBody.data.origem,
          observacoes: parsedBody.data.observacoes,
          google_event_id: parsedBody.data.googleEventId,
          google_calendar_id: parsedBody.data.googleCalendarId,
          metadata: parsedBody.data.metadata,
        })
        .select("*")
        .single();

      if (error || !data) {
        return buildRecordError(error, "Não foi possível salvar o agendamento agora.");
      }

      return NextResponse.json({ record: data });
    }
  }
}

export async function PUT(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso não permite atualizar registros clínicos.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const parsedBody = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return buildJsonError("Dados do agendamento inválidos para esta operação.", 400);
  }

  const access = await requireClientAccess(
    authContext,
    parsedBody.data.clientId,
    "Seu acesso não permite atualizar registros clínicos deste paciente.",
    "Cliente inválido para esta operação."
  );
  if (access.response) {
    return access.response || buildJsonError("Cliente inválido para esta operação.", 404);
  }

  const { data, error } = await authContext.admin
    .from("agendamentos")
    .update({
      origem: "google_calendar",
      google_event_id: parsedBody.data.googleEventId,
      google_calendar_id: parsedBody.data.googleCalendarId,
      metadata: parsedBody.data.metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsedBody.data.appointmentId)
    .eq("cliente_id", parsedBody.data.clientId)
    .eq("user_id", authContext.userId)
    .select("*")
    .single();

  if (error || !data) {
    return buildRecordError(error, "Não foi possível vincular o agendamento agora.");
  }

  return NextResponse.json({ record: data });
}

export async function DELETE(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso não permite excluir registros clínicos.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const recordId = url.searchParams.get("recordId");
  const clientId = url.searchParams.get("clientId");

  if (!action || !recordId || !clientId) {
    return buildJsonError("Parâmetros inválidos para exclusão.", 400);
  }

  const access = await requireClientAccess(
    authContext,
    clientId,
    "Seu acesso não permite excluir registros clínicos deste paciente.",
    "Cliente inválido para esta operação."
  );
  if (access.response) {
    return access.response || buildJsonError("Cliente inválido para esta operação.", 404);
  }

  switch (action) {
    case "procedimento": {
      const { error } = await authContext.admin
        .from("historico_procedimentos")
        .delete()
        .eq("id", recordId)
        .eq("cliente_id", clientId);

      if (error) {
        return buildRecordError(error, "Não foi possível excluir o procedimento.");
      }

      return NextResponse.json({ success: true });
    }

    default:
      return buildJsonError("Ação de exclusão não suportada.", 400);
  }
}