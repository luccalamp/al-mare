import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { requireAuthenticatedUser } from "@/lib/server/tenantAccess";
import type { AccessApprovalStatus } from "@/lib/accessRequests";

export async function GET(request: NextRequest) {
  const authContext = await requireAuthenticatedUser(request);
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const email = authContext.user.email?.toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: "Sua conta autenticada não possui um email válido." }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from("access_requests")
      .select(
        "status, created_at, full_name, phone, instagram_handle, justification, auth_provider, email_verified, avatar_url, approved_at, password_setup_email_sent_at"
      )
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("[access] Erro ao verificar status:", error);
      return NextResponse.json({ error: "Não foi possível verificar o status." }, { status: 500 });
    }

    const status: AccessApprovalStatus = (data?.status as AccessApprovalStatus | null) || "none";

    return NextResponse.json({
      email,
      status,
      requestedAt: data?.created_at || null,
      request: data
        ? {
            fullName: data.full_name || null,
            phone: data.phone || null,
            instagramHandle: data.instagram_handle || null,
            justification: data.justification || null,
            authProvider: data.auth_provider || null,
            emailVerified: Boolean(data.email_verified),
            avatarUrl: data.avatar_url || null,
            approvedAt: data.approved_at || null,
            passwordSetupEmailSentAt: data.password_setup_email_sent_at || null,
          }
        : null,
    }, { status: 200 });
  } catch (error) {
    console.error("[access] Erro ao verificar status:", error);
    return NextResponse.json({ error: "Não foi possível verificar o status." }, { status: 500 });
  }
}