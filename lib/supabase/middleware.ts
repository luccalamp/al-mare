import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { readSessionIdFromClaims } from "@/lib/twoFactorVerification";

type SessionIdentity = {
  id: string;
};

function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token || null;
}

function hasSupabaseSessionCookie(request: NextRequest, supabaseUrl: string) {
  try {
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    if (!projectRef) {
      return false;
    }

    const cookiePrefix = `sb-${projectRef}-auth-token`;
    return request.cookies
      .getAll()
      .some(({ name }) => name === cookiePrefix || name.startsWith(`${cookiePrefix}.`));
  } catch {
    return false;
  }
}

function readIdentity(claims: unknown) {
  if (!claims || typeof claims !== "object") {
    return { user: null, sessionId: null };
  }

  const subject = (claims as Record<string, unknown>).sub;
  if (typeof subject !== "string" || !subject.trim()) {
    return { user: null, sessionId: null };
  }

  return {
    user: { id: subject } satisfies SessionIdentity,
    sessionId: readSessionIdFromClaims(claims),
  };
}

function getSafeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function updateSupabaseSession(
  request: NextRequest,
  requestHeaders: Headers = new Headers(request.headers)
) {
  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const { supabaseUrl, supabasePublishableKey } = getSupabasePublicConfig();

  if (!supabaseUrl || !supabasePublishableKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[middleware] Supabase public config ausente; autenticacao ignorada nesta request.");
    }
    return { response, user: null, sessionId: null };
  }

  try {
    const bearerToken = readBearerToken(request);
    if (bearerToken) {
      const bearerClient = createClient(supabaseUrl, supabasePublishableKey, {
        global: {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      const { data, error } = await bearerClient.auth.getClaims(bearerToken);
      if (!error) {
        const identity = readIdentity(data?.claims);
        if (identity.user) {
          return { response, ...identity };
        }
      }
    }

    if (!hasSupabaseSessionCookie(request, supabaseUrl)) {
      return { response, user: null, sessionId: null };
    }

    const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data, error } = await supabase.auth.getClaims();
    if (error) {
      return { response, user: null, sessionId: null };
    }

    return { response, ...readIdentity(data?.claims) };
  } catch (error) {
    console.warn("[middleware] Supabase session validation unavailable", {
      message: getSafeErrorMessage(error),
    });
    return { response, user: null, sessionId: null };
  }
}
