import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

function isMissingFunctionError(message?: string) {
  return /function .* does not exist|could not find the function/i.test(message || "");
}

function isMissingColumnError(message?: string) {
  return /column .* does not exist/i.test(message || "");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();

  if (!token) {
    return NextResponse.json({ error: "Token de pre-consulta ausente." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("get_pre_consultation_session", {
    p_token: token,
  });

  if (error) {
    if (isMissingColumnError(error.message) || isMissingFunctionError(error.message)) {
      return NextResponse.json(
        {
          status: "migration_required",
          message: "O fluxo de triagem ainda não está disponível neste ambiente.",
        },
        { status: 200 }
      );
    }

    console.error("Failed to validate pre-consultation token:", error);
    return NextResponse.json({ error: "Não foi possível validar este link agora." }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : undefined;
  if (!row || row.status === "not_found") {
    return NextResponse.json(
      {
        status: "not_found",
        message: row?.message || "Este link nao foi encontrado ou ja expirou.",
      },
      { status: 200 }
    );
  }

  if (row.status === "inactive") {
    return NextResponse.json(
      {
        status: "inactive",
        message: row.message || "Este link de pre-consulta ja foi encerrado pela clinica.",
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      status: "ready",
      clientId: row.client_id,
      patientName: row.patient_name,
      whatsapp: row.whatsapp || undefined,
    },
    { status: 200 }
  );
}
