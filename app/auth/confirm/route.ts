import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTrustedAppOrigin } from "@/lib/server/trustedOrigin";
import { TWO_FACTOR_VERIFIED_COOKIE } from "@/lib/twoFactorVerification";

const ALLOWED_EMAIL_OTP_TYPES = new Set<EmailOtpType>(["magiclink", "recovery"]);

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash")?.trim();
  const requestedType = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const requestedNext = requestUrl.searchParams.get("next") || "/login";
  const origin = getTrustedAppOrigin(request);
  const nextPath = requestedNext.startsWith("/login") ? requestedNext : "/login";

  if (!tokenHash || !requestedType || !ALLOWED_EMAIL_OTP_TYPES.has(requestedType)) {
    return NextResponse.redirect(new URL("/login?status=invalid-link", origin));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: requestedType,
  });

  if (error) {
    console.warn("[auth/confirm] Email link verification failed", {
      message: error.message,
    });
    return NextResponse.redirect(new URL("/login?status=invalid-link", origin));
  }

  const response = NextResponse.redirect(new URL(nextPath, origin));
  response.cookies.set(TWO_FACTOR_VERIFIED_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
