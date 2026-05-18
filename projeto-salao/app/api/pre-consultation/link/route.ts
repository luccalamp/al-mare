import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import {
  buildJsonError,
  isMissingColumnError,
  isMissingFunctionError,
  requireClientAccess,
  requireAuthorizedStaff,
} from "@/lib/server/tenantAccess";

const bodySchema = z.object({
  clientId: z.string().uuid(),
});

async function parseClientId(request: Request) {
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return {
      clientId: null,
      response: buildJsonError("Cliente inválido para gestão do link de triagem.", 400),
    };
  }

  return {
    clientId: parsedBody.data.clientId,
    response: null,
  };
}

function parseRpcRow(data: unknown) {
  const row = Array.isArray(data) ? data[0] : undefined;
  if (!row || typeof row !== "object") {
    return null;
  }

  return row as {
    token?: string;
    link_active?: boolean;
    responded_at?: string | null;
  };
}

export async function POST(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso não permite gerenciar links de triagem.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const { clientId, response } = await parseClientId(request);
  if (response) {
    return response;
  }

  if (!clientId) {
    return buildJsonError("Cliente inválido para gestão do link de triagem.", 400);
  }

  const access = await requireClientAccess(
    authContext,
    clientId,
    "Seu acesso não permite gerenciar links deste paciente.",
    "Cliente inválido para gestão do link de triagem."
  );
  if (access.response) {
    return access.response;
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient.rpc("issue_pre_consultation_link", {
    p_client_id: clientId,
  });

  if (error) {
    if (isMissingColumnError(error.message) || isMissingFunctionError(error.message)) {
      return buildJsonError("O fluxo de triagem ainda não está disponível neste ambiente.", 503);
    }

    console.error("Failed to issue pre-consultation link:", error);
    return buildJsonError("Não foi possível gerar o link de triagem agora.", 500);
  }

  const row = parseRpcRow(data);
  if (!row?.token) {
    return buildJsonError("Não foi possível preparar o link de triagem agora.", 500);
  }

  return NextResponse.json({
    token: row.token,
    linkActive: row.link_active ?? true,
    respondedAt: row.responded_at ?? null,
  });
}

export async function PUT(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso não permite gerenciar links de triagem.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const { clientId, response } = await parseClientId(request);
  if (response) {
    return response;
  }

  if (!clientId) {
    return buildJsonError("Cliente inválido para gestão do link de triagem.", 400);
  }

  const access = await requireClientAccess(
    authContext,
    clientId,
    "Seu acesso não permite gerenciar links deste paciente.",
    "Cliente inválido para gestão do link de triagem."
  );
  if (access.response) {
    return access.response;
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient.rpc("deactivate_pre_consultation_link", {
    p_client_id: clientId,
  });

  if (error) {
    if (isMissingColumnError(error.message) || isMissingFunctionError(error.message)) {
      return buildJsonError("O fluxo de triagem ainda não está disponível neste ambiente.", 503);
    }

    console.error("Failed to deactivate pre-consultation link:", error);
    return buildJsonError("Não foi possível invalidar o link de triagem agora.", 500);
  }

  const row = parseRpcRow(data);
  return NextResponse.json({
    token: row?.token ?? null,
    linkActive: row?.link_active ?? false,
    respondedAt: row?.responded_at ?? null,
  });
}