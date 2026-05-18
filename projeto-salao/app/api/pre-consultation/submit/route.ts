import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

const submitSchema = z.object({
  token: z.string().uuid(),
  payload: z.object({
    nome: z.string().min(1),
    whatsapp: z.string().min(1),
    queixaPrincipal: z.string().min(1),
    objetivoTratamento: z.string().optional(),
    alergias: z.string().optional(),
    medicacoes: z.string().optional(),
    observacoes: z.string().optional(),
    consentimentoDados: z.boolean(),
    consentimentoImagem: z.boolean(),
  }),
});

function isMissingFunctionError(message?: string) {
  return /function .* does not exist|could not find the function/i.test(message || "");
}

function isMissingColumnError(message?: string) {
  return /column .* does not exist/i.test(message || "");
}

export async function POST(request: Request) {
  const parsedBody = submitSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Payload invalido para envio da pre-consulta." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("submit_pre_consultation", {
    p_token: parsedBody.data.token,
    p_payload: parsedBody.data.payload,
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

    console.error("Failed to submit pre-consultation:", error);
    return NextResponse.json({ error: "Não foi possível enviar a triagem agora." }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : undefined;
  if (!row) {
    return NextResponse.json({ error: "Não foi possível concluir a triagem agora." }, { status: 500 });
  }

  if (row.status === "not_found" || row.status === "inactive") {
    return NextResponse.json(
      {
        status: row.status,
        message: row.message,
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      status: "submitted",
      patientName: row.patient_name,
    },
    { status: 200 }
  );
}
