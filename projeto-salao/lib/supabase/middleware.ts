import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token || null;
}

export async function updateSupabaseSession(request: NextRequest, requestHeaders: Headers = new Headers(request.headers)) {
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
    return { response, user: null };
  }

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

    const {
      data: { user: bearerUser },
    } = await bearerClient.auth.getUser();

    if (bearerUser) {
      return { response, user: bearerUser };
    }
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}