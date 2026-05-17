import { NextResponse } from "next/server";
import { SupabaseClient, createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

export type AuthorizedStaffContext = {
  admin: SupabaseClient;
  userId: string;
};

export function buildJsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function createServerUserClient(token: string) {
  const readEnvFromDotenv = (name: string) => {
    const candidates = [
      path.resolve(process.cwd(), ".env.local"),
      path.resolve(process.cwd(), "projeto salao", ".env.local"),
      path.resolve(process.cwd(), "projeto-salao", ".env.local"),
      path.resolve(__dirname, "..", "..", ".env.local"),
    ];

    for (const p of candidates) {
      try {
        if (!fs.existsSync(p)) continue;
        const content = fs.readFileSync(p, "utf8");
        const re = new RegExp(`^${name.replace(/[\\-\\/\\^$*+?.()|[\\]{}]/g, "\\$&")}\\s*=\\s*(.*)$`, "mi");
        const m = content.match(re);
        if (m && m[1]) {
          let v = m[1].trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
          return v;
        }
      } catch {
        // ignore
      }
    }

    return null;
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || readEnvFromDotenv("NEXT_PUBLIC_SUPABASE_URL") || "";
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || readEnvFromDotenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") || "";

  if (!supabaseUrl || !publishable) {
    console.error("Missing Supabase URL or publishable key for server-side client. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }

  return createClient(supabaseUrl, publishable, {
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

export async function requireAuthorizedStaff(
  request: Request,
  options?: {
    forbiddenMessage?: string;
  }
) {
  void options;

  const bearerToken = readBearerToken(request);
  if (!bearerToken) {
    return buildJsonError("Sua sessão expirou. Entre novamente para continuar.", 401);
  }

  const userClient = createServerUserClient(bearerToken);
  const { data: userData, error: userError } = await userClient.auth.getUser();

  if (userError || !userData?.user) {
    return buildJsonError("Sua sessão expirou. Entre novamente para continuar.", 401);
  }

  return {
    admin: userClient,
    userId: userData.user.id,
  } satisfies AuthorizedStaffContext;
}

export async function requireOrganizationMembership(
  context: AuthorizedStaffContext,
  organizationId: string,
  forbiddenMessage = "Seu acesso não permite gerenciar dados desta empresa."
) {
  if (organizationId !== context.userId) {
    return buildJsonError(forbiddenMessage, 403);
  }

  return null;
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

export async function loadClientOrganizationId(context: AuthorizedStaffContext, clientId: string) {
  const { userId, response } = await loadOwnedRowUserId(
    context,
    "clientes",
    clientId,
    "Cliente inválido para esta operação.",
    "Não foi possível validar o cliente agora."
  );

  return {
    organizationId: userId,
    response,
  };
}

export async function requireClientOrganizationAccess(
  context: AuthorizedStaffContext,
  clientId: string,
  forbiddenMessage = "Seu acesso não permite gerenciar este paciente.",
  notFoundMessage = "Cliente inválido para esta operação."
) {
  const { userId, response } = await requireOwnedRowAccess(
    context,
    "clientes",
    clientId,
    forbiddenMessage,
    notFoundMessage,
    "Não foi possível validar o cliente agora."
  );

  if (response || !userId) {
    return {
      organizationId: null,
      response: response || buildJsonError(notFoundMessage, 404),
    };
  }

  return {
    organizationId: userId,
    response: null,
  };
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

export async function loadCompanyDocumentFolderOrganizationId(context: AuthorizedStaffContext, folderId: string) {
  const { userId, response } = await loadOwnedRowUserId(
    context,
    "company_document_folders",
    folderId,
    "Pasta inválida para esta operação.",
    "Não foi possível validar a pasta agora."
  );

  return {
    organizationId: userId,
    response,
  };
}

export async function requireCompanyDocumentFolderAccess(
  context: AuthorizedStaffContext,
  folderId: string,
  forbiddenMessage = "Seu acesso não permite gerenciar os documentos desta pasta.",
  notFoundMessage = "Pasta inválida para esta operação."
) {
  const { userId, response } = await requireOwnedRowAccess(
    context,
    "company_document_folders",
    folderId,
    forbiddenMessage,
    notFoundMessage,
    "Não foi possível validar a pasta agora."
  );

  if (response || !userId) {
    return {
      organizationId: null,
      response: response || buildJsonError(notFoundMessage, 404),
    };
  }

  return {
    organizationId: userId,
    response: null,
  };
}