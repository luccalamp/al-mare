import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { getTrustedAppOrigin } from "@/lib/server/trustedOrigin";
import { TWO_FACTOR_VERIFIED_COOKIE } from "@/lib/twoFactorVerification";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = getTrustedAppOrigin(request);

  if (!code) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const { supabaseUrl, supabasePublishableKey } = getSupabasePublicConfig();

  const cookieHeader = request.headers.get("cookie") || "";
  const requestCookies = cookieHeader.split(";").map((c) => {
    const [name, ...rest] = c.trim().split("=");
    return { name, value: rest.join("=") };
  });

  const response = NextResponse.redirect(new URL("/login?status=oauth-2fa", origin));

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return requestCookies;
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] exchangeCodeForSession error:", error);
    return NextResponse.redirect(new URL("/login?status=oauth-error", origin));
  }

  response.cookies.set(TWO_FACTOR_VERIFIED_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
