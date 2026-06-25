import { NextResponse } from "next/server";
import { type User, SupabaseClient, createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

export type AuthenticatedUserContext = {
  client: SupabaseClient;
  user: User;
  userId: string;
};

export type AuthorizedStaffContext = {
  admin: SupabaseClient;
  userId: string;
  user: User;
  authorizationSource: "access_requests" | "app_metadata";
  staffRole?: string;
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
  const authContext = await requireAuthenticatedUser(request);
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const appMetadataAuthorization = getAppMetadataStaffAuthorization(authContext.user);
  if (appMetadataAuthorization.authorized) {
    return {
      admin: authContext.client,
      userId: authContext.userId,
      user: authContext.user,
      authorizationSource: "app_metadata",
      staffRole: appMetadataAuthorization.role,
    } satisfies AuthorizedStaffContext;
  }

  const approvedAccessRequest = await loadApprovedAccessRequest(authContext.user);
  if (approvedAccessRequest instanceof NextResponse) {
    return approvedAccessRequest;
  }

  if (!approvedAccessRequest) {
    return buildJsonError(options?.forbiddenMessage || "Seu acesso ainda nao foi aprovado.", 403);
  }

  return {
    admin: authContext.client,
    userId: authContext.userId,
    user: authContext.user,
    authorizationSource: "access_requests",
    staffRole: "staff",
  } satisfies AuthorizedStaffContext;
}

function getStringClaim(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getStringListClaim(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => getStringClaim(item))
      .filter((item): item is string => Boolean(item));
  }

  return [];
}

function getAppMetadataStaffAuthorization(user: User) {
  const metadata = (user.app_metadata || {}) as Record<string, unknown>;
  const nestedClaims = metadata.claims && typeof metadata.claims === "object"
    ? metadata.claims as Record<string, unknown>
    : {};

  const approvedStatus = [
    metadata.access_status,
    metadata.staff_status,
    metadata.approval_status,
    nestedClaims.access_status,
    nestedClaims.staff_status,
    nestedClaims.approval_status,
  ]
    .map((value) => getStringClaim(value)?.toLowerCase())
    .some((value) => value === "approved");

  if (approvedStatus) {
    return { authorized: true, role: "staff" };
  }

  const roles = [
    ...getStringListClaim(metadata.role),
    ...getStringListClaim(metadata.app_role),
    ...getStringListClaim(metadata.roles),
    ...getStringListClaim(metadata.staff_roles),
    ...getStringListClaim(nestedClaims.role),
    ...getStringListClaim(nestedClaims.roles),
  ].map((role) => role.toLowerCase());

  const allowedRole = roles.find((role) =>
    ["staff", "admin", "owner", "operator", "operations"].includes(role)
  );

  if (allowedRole) {
    return { authorized: true, role: allowedRole };
  }

  const permissions = [
    ...getStringListClaim(metadata.permissions),
    ...getStringListClaim(nestedClaims.permissions),
  ].map((permission) => permission.toLowerCase());

  if (permissions.some((permission) => ["staff:access", "admin:operations"].includes(permission))) {
    return { authorized: true, role: "staff" };
  }

  return { authorized: false, role: undefined };
}

async function loadApprovedAccessRequest(user: User) {
  const email = user.email?.toLowerCase().trim();
  const admin = createSupabaseAdminClient();

  const byRequester = await admin
    .from("access_requests")
    .select("id, status")
    .eq("requester_user_id", user.id)
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();

  if (byRequester.error && !isMissingColumnError(byRequester.error.message)) {
    console.error("Failed to validate approved staff access:", byRequester.error);
    return buildJsonError("Nao foi possivel validar sua autorizacao agora.", 500);
  }

  if (byRequester.data?.status === "approved") {
    return byRequester.data;
  }

  if (!email) {
    return null;
  }

  const byEmail = await admin
    .from("access_requests")
    .select("id, status")
    .eq("email", email)
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();

  if (byEmail.error) {
    console.error("Failed to validate approved staff access:", byEmail.error);
    return buildJsonError("Nao foi possivel validar sua autorizacao agora.", 500);
  }

  return byEmail.data?.status === "approved" ? byEmail.data : null;
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

export async function requireCompanyDocumentAccess(
  context: AuthorizedStaffContext,
  documentId: string,
  forbiddenMessage = "Seu acesso não permite gerenciar este documento.",
  notFoundMessage = "Documento inválido para esta operação."
) {
  return requireOwnedRowAccess(
    context,
    "company_documents",
    documentId,
    forbiddenMessage,
    notFoundMessage,
    "Não foi possível validar o documento agora."
  );
}

export async function requirePhotoAccess(
  context: AuthorizedStaffContext,
  photoId: string,
  forbiddenMessage = "Seu acesso não permite gerenciar esta foto.",
  notFoundMessage = "Foto inválida para esta operação."
) {
  const { admin } = context;

  const { data, error } = await admin
    .from("client_photos")
    .select("cliente_id, clientes!inner(user_id)")
    .eq("id", photoId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error.message)) {
      return {
        userId: null,
        response: buildJsonError("O isolamento por usuário ainda não está disponível neste ambiente.", 503),
      };
    }

    console.error("Failed to validate client_photos owner:", error);
    return {
      userId: null,
      response: buildJsonError("Não foi possível validar a foto agora.", 500),
    };
  }

  const ownerRelation = Array.isArray(data?.clientes) ? data.clientes[0] : data?.clientes;
  const ownerUserId = typeof ownerRelation?.user_id === "string" && ownerRelation.user_id.trim()
    ? ownerRelation.user_id
    : null;

  if (!ownerUserId) {
    return {
      userId: null,
      response: buildJsonError(notFoundMessage, 404),
    };
  }

  if (ownerUserId !== context.userId) {
    return {
      userId: null,
      response: buildJsonError(forbiddenMessage, 403),
    };
  }

  return {
    userId: ownerUserId,
    response: null,
  };
}
