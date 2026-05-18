import { NextResponse } from "next/server";
import { type User, SupabaseClient, createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AuthenticatedUserContext = {
  client: SupabaseClient;
  user: User;
  userId: string;
};

export type AuthorizedStaffContext = {
  admin: SupabaseClient;
  userId: string;
  user: User;
};

export function buildJsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function createServerUserClient(token: string) {
  const { supabaseUrl, supabasePublishableKey } = getSupabasePublicConfig();

  return createClient(supabaseUrl, supabasePublishableKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function createRequestUserClient(request: Request) {
  const bearerToken = readBearerToken(request);
  if (bearerToken) {
    return createServerUserClient(bearerToken);
  }

  return createServerSupabaseClient();
}

export function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token || null;
}

export function isMissingFunctionError(message?: string) {
  return /function .* does not exist|could not find the function/i.test(message || "");
}

export function isMissingColumnError(message?: string) {
  return /column .* does not exist/i.test(message || "");
}

export async function requireAuthenticatedUser(request: Request) {
  const client = createRequestUserClient(request);
  const { data: userData, error: userError } = await client.auth.getUser();

  if (userError || !userData?.user) {
    return buildJsonError("Sua sessão expirou. Entre novamente para continuar.", 401);
  }

  return {
    client,
    user: userData.user,
    userId: userData.user.id,
  } satisfies AuthenticatedUserContext;
}

export async function requireAuthorizedStaff(
  request: Request,
  options?: {
    forbiddenMessage?: string;
  }
) {
  void options;

  const authContext = await requireAuthenticatedUser(request);
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  return {
    admin: authContext.client,
    userId: authContext.userId,
    user: authContext.user,
  } satisfies AuthorizedStaffContext;
}

async function loadOwnedRowUserId(
  context: AuthorizedStaffContext,
  table: string,
  rowId: string,
  notFoundMessage: string,
  fallbackMessage: string
) {
  const { admin } = context;

  const { data: row, error } = await admin
    .from(table)
    .select("user_id")
    .eq("id", rowId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error.message)) {
      return {
        userId: null,
        response: buildJsonError("O isolamento por usuário ainda não está disponível neste ambiente.", 503),
      };
    }

    console.error(`Failed to validate ${table} owner:`, error);
    return {
      userId: null,
      response: buildJsonError(fallbackMessage, 500),
    };
  }

  if (!row?.user_id) {
    return {
      userId: null,
      response: buildJsonError(notFoundMessage, 404),
    };
  }

  return {
    userId: row.user_id,
    response: null,
  };
}

async function requireOwnedRowAccess(
  context: AuthorizedStaffContext,
  table: string,
  rowId: string,
  forbiddenMessage: string,
  notFoundMessage: string,
  fallbackMessage: string
) {
  const { userId, response } = await loadOwnedRowUserId(
    context,
    table,
    rowId,
    notFoundMessage,
    fallbackMessage
  );

  if (response || !userId) {
    return {
      userId: null,
      response: response || buildJsonError(notFoundMessage, 404),
    };
  }

  if (userId !== context.userId) {
    return {
      userId: null,
      response: buildJsonError(forbiddenMessage, 403),
    };
  }

  return {
    userId,
    response: null,
  };
}

export async function loadClientUserId(context: AuthorizedStaffContext, clientId: string) {
  return loadOwnedRowUserId(
    context,
    "clientes",
    clientId,
    "Cliente inválido para esta operação.",
    "Não foi possível validar o cliente agora."
  );
}

export async function requireClientAccess(
  context: AuthorizedStaffContext,
  clientId: string,
  forbiddenMessage = "Seu acesso não permite gerenciar este paciente.",
  notFoundMessage = "Cliente inválido para esta operação."
) {
  return requireOwnedRowAccess(
    context,
    "clientes",
    clientId,
    forbiddenMessage,
    notFoundMessage,
    "Não foi possível validar o cliente agora."
  );
}

export async function loadCompanyDocumentFolderUserId(context: AuthorizedStaffContext, folderId: string) {
  return loadOwnedRowUserId(
    context,
    "company_document_folders",
    folderId,
    "Pasta inválida para esta operação.",
    "Não foi possível validar a pasta agora."
  );
}

export async function requireCompanyDocumentFolderAccess(
  context: AuthorizedStaffContext,
  folderId: string,
  forbiddenMessage = "Seu acesso não permite gerenciar os documentos desta pasta.",
  notFoundMessage = "Pasta inválida para esta operação."
) {
  return requireOwnedRowAccess(
    context,
    "company_document_folders",
    folderId,
    forbiddenMessage,
    notFoundMessage,
    "Não foi possível validar a pasta agora."
  );
}