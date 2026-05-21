import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import {
  buildJsonError,
  isMissingColumnError,
  requireClientAccess,
  requireAuthorizedStaff,
} from "@/lib/server/tenantAccess";
import crypto from "crypto";

const bodySchema = z.object({
  clientId: z.string().uuid(),
});

async function parseClientId(request: Request) {
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return {
      clientId: null,
      response: buildJsonError("Cliente inválido para gestão do link do portal.", 400),
    };
  }

  return {
    clientId: parsedBody.data.clientId,
    response: null,
  };
}

function generatePortalToken(): string {
  return crypto.randomUUID();
}

export async function POST(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso não permite gerenciar links do portal.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const { clientId, response } = await parseClientId(request);
  if (response) {
    return response;
  }

  if (!clientId) {
    return buildJsonError("Cliente inválido para gestão do link do portal.", 400);
  }

  const access = await requireClientAccess(
    authContext,
    clientId,
    "Seu acesso não permite gerenciar links deste paciente.",
    "Cliente inválido para gestão do link do portal."
  );
  if (access.response) {
    return access.response;
  }

  const adminClient = createSupabaseAdminClient();
  const token = generatePortalToken();

  const { error } = await adminClient
    .from("clientes")
    .update({ portal_token: token, portal_active: true })
    .eq("id", clientId);

  if (error) {
    if (isMissingColumnError(error.message)) {
      return buildJsonError("O portal do cliente ainda não está disponível neste ambiente.", 503);
    }

    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to issue portal link:", error);
    }
    return buildJsonError("Não foi possível gerar o link do portal agora.", 500);
  }

  return NextResponse.json({
    token,
    linkActive: true,
  });
}

export async function PUT(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso não permite gerenciar links do portal.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const { clientId, response } = await parseClientId(request);
  if (response) {
    return response;
  }

  if (!clientId) {
    return buildJsonError("Cliente inválido para gestão do link do portal.", 400);
  }

  const access = await requireClientAccess(
    authContext,
    clientId,
    "Seu acesso não permite gerenciar links deste paciente.",
    "Cliente inválido para gestão do link do portal."
  );
  if (access.response) {
    return access.response;
  }

  const adminClient = createSupabaseAdminClient();

  const { error } = await adminClient
    .from("clientes")
    .update({ portal_active: false })
    .eq("id", clientId);

  if (error) {
    if (isMissingColumnError(error.message)) {
      return buildJsonError("O portal do cliente ainda não está disponível neste ambiente.", 503);
    }

    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to deactivate portal link:", error);
    }
    return buildJsonError("Não foi possível invalidar o link do portal agora.", 500);
  }

  return NextResponse.json({
    linkActive: false,
  });
}
