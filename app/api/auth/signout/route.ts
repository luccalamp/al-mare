import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TWO_FACTOR_VERIFIED_COOKIE } from "@/lib/twoFactorVerification";

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.warn("[auth/signout] Supabase signout unavailable", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(TWO_FACTOR_VERIFIED_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  response.cookies.set("2fa_payload", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
