import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TWO_FACTOR_VERIFIED_COOKIE } from "@/lib/twoFactorVerification";

const updatePasswordSchema = z.object({
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const parsed = updatePasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Use uma senha de 8 a 128 caracteres." }, { status: 400 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Seu link de acesso expirou. Solicite um novo." }, { status: 401 });
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await supabase.auth.signOut();
    const response = NextResponse.json({ success: true });
    response.cookies.set(TWO_FACTOR_VERIFIED_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
    return response;
  } catch (error) {
    console.warn("[auth/password/update] Password update unavailable", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Nao foi possivel salvar a nova senha agora." }, { status: 500 });
  }
}
