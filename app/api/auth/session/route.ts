import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { readSignedJsonCookieValue } from "@/lib/server/signedCookie";
import {
  isTwoFactorVerificationValid,
  readSessionIdFromAccessToken,
  TWO_FACTOR_VERIFIED_COOKIE,
} from "@/lib/twoFactorVerification";

const TWO_FA_COOKIE_SCOPE = "auth:2fa:v1";

type PendingTwoFactorPayload = {
  email: string;
  hash: string;
  exp: number;
  provider?: "password" | "google";
};

async function readPendingTwoFactor() {
  const cookieStore = await cookies();
  const payload = readSignedJsonCookieValue<PendingTwoFactorPayload>(
    TWO_FA_COOKIE_SCOPE,
    cookieStore.get("2fa_payload")?.value
  );

  if (!payload || payload.exp <= Date.now() || !payload.email) {
    return null;
  }

  return {
    email: payload.email,
    provider: payload.provider === "google" ? "google" : "password",
  } as const;
}

export async function GET() {
  const pendingTwoFactor = await readPendingTwoFactor();

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { user: null, twoFactorVerified: false, pendingTwoFactor },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const sessionId = readSessionIdFromAccessToken(session?.access_token);
    const cookieStore = await cookies();
    const twoFactorVerified = await isTwoFactorVerificationValid(
      cookieStore.get(TWO_FACTOR_VERIFIED_COOKIE)?.value,
      user.id,
      sessionId
    );

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email ?? null,
        },
        twoFactorVerified,
        pendingTwoFactor,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.warn("[auth/session] Session lookup unavailable", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { user: null, twoFactorVerified: false, pendingTwoFactor },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
