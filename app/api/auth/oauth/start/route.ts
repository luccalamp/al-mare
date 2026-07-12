import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTrustedAppOrigin } from "@/lib/server/trustedOrigin";

export async function GET(request: Request) {
  const origin = getTrustedAppOrigin(request);

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: new URL("/auth/callback", origin).toString(),
        skipBrowserRedirect: true,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error || !data.url) {
      console.warn("[auth/oauth] Unable to start Google OAuth", {
        message: error?.message || "authorization URL missing",
      });
      return NextResponse.redirect(new URL("/login?status=oauth-error", origin));
    }

    return NextResponse.redirect(data.url);
  } catch (error) {
    console.warn("[auth/oauth] Unexpected OAuth start failure", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(new URL("/login?status=oauth-error", origin));
  }
}
