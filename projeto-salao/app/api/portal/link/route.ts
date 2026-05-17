import { NextResponse } from "next/server";
import { requireAuthorizedStaff } from "@/lib/server/tenantAccess";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import crypto from "crypto";

export async function POST(request: Request) {
  const authContext = await requireAuthorizedStaff(request);
  if (authContext instanceof NextResponse) return authContext;

  const { clientId } = await request.json().catch(() => ({}));
  if (!clientId) return NextResponse.json({ error: "clientId é obrigatório." }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const token = crypto.randomUUID();

  const { error } = await supabase.from("clientes").update({ portal_token: token, portal_active: true }).eq("id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ token, linkActive: true });
}

export async function PUT(request: Request) {
  const authContext = await requireAuthorizedStaff(request);
  if (authContext instanceof NextResponse) return authContext;

  const { clientId } = await request.json().catch(() => ({}));
  if (!clientId) return NextResponse.json({ error: "clientId é obrigatório." }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("clientes").update({ portal_active: false }).eq("id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ linkActive: false });
}
