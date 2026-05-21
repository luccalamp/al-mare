import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthorizedStaff } from "@/lib/server/tenantAccess";

const postSchema = z.object({
  key: z.string().min(1),
  payload: z.any(),
});

export async function GET(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso não permite ler preferências da clínica.",
  });
  if (authContext instanceof NextResponse) return authContext;

  const url = new URL(request.url);
  const key = url.searchParams.get("key") || null;

  if (!key) {
    return NextResponse.json({ error: "key required" }, { status: 400 });
  }

  const { data, error } = await authContext.admin
    .from("clinic_preferences")
    .select("payload")
    .eq("user_id", authContext.userId)
    .eq("preference_key", key)
    .maybeSingle();

  if (error) {
    console.error("Failed to read clinic preference:", error);
    return NextResponse.json({ error: "Falha ao ler preferências." }, { status: 500 });
  }

  return NextResponse.json({ payload: data?.payload ?? null });
}

export async function POST(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso não permite atualizar preferências da clínica.",
  });
  if (authContext instanceof NextResponse) return authContext;

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos para esta operação." }, { status: 400 });
  }

  const { key, payload } = parsed.data;

  const { error } = await authContext.admin.from("clinic_preferences").upsert(
    {
      user_id: authContext.userId,
      preference_key: key,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,preference_key" }
  );

  if (error) {
    console.error("Failed to upsert clinic preference:", error);
    return NextResponse.json({ error: "Não foi possível salvar as preferências agora." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
