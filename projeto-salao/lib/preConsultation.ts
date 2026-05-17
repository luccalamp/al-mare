type SessionUnavailableStatus = "inactive" | "not_found" | "migration_required";

export type PreConsultationSessionResult =
  | {
      status: "ready";
      clientId: string;
      patientName: string;
      whatsapp?: string;
    }
  | {
      status: SessionUnavailableStatus;
      message: string;
    };

export type PublicPreConsultationPayload = {
  nome: string;
  whatsapp: string;
  queixaPrincipal: string;
  objetivoTratamento?: string;
  alergias?: string;
  medicacoes?: string;
  observacoes?: string;
  consentimentoDados: boolean;
  consentimentoImagem: boolean;
};

export function buildPreConsultationLink(token: string, origin: string) {
  return `${origin}/pre-consulta/${token}`;
}

function normalizeWhatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") || digits.length > 11) return digits;
  if (digits.length >= 10) return `55${digits}`;
  return digits;
}

export function buildPreConsultationWhatsappMessage(patientName: string, link: string) {
  const firstName = patientName.trim().split(/\s+/)[0] || "tudo bem";
  return [
    `Ola, ${firstName}.`,
    "Segue o seu link de pre-consulta da Al'mare Saude Capilar:",
    link,
    "Preencha antes do atendimento para agilizar a avaliacao clinica.",
  ].join("\n\n");
}

export function buildWhatsappShareUrl(phone: string, message: string) {
  const normalizedPhone = normalizeWhatsappNumber(phone);
  const encodedMessage = encodeURIComponent(message);

  if (!normalizedPhone) {
    return `https://api.whatsapp.com/send?text=${encodedMessage}`;
  }

  return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
}

async function parseRouteResponse(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Nao foi possivel concluir a triagem agora.";
    throw new Error(message);
  }

  return payload;
}

export async function getPreConsultationSession(token: string): Promise<PreConsultationSessionResult> {
  const response = await fetch(`/api/pre-consultation/session?token=${encodeURIComponent(token)}`, {
    method: "GET",
    cache: "no-store",
  });
  const row = await parseRouteResponse(response);

  if (!row || row.status === "not_found") {
    return {
      status: "not_found",
      message: row?.message || "Este link não foi encontrado ou já expirou.",
    };
  }

  if (row.status === "inactive") {
    return {
      status: "inactive",
      message: row.message || "Este link de pré-consulta já foi encerrado pela clínica.",
    };
  }

  return {
    status: "ready",
    clientId: row.clientId,
    patientName: row.patientName,
    whatsapp: row.whatsapp || undefined,
  };
}

export async function submitPreConsultation(token: string, payload: PublicPreConsultationPayload) {
  const response = await fetch("/api/pre-consultation/submit", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      token,
      payload,
    }),
  });

  const row = await parseRouteResponse(response);
  if (!row) {
    throw new Error("Nao foi possivel concluir a triagem agora.");
  }

  if (row.status === "not_found" || row.status === "inactive") {
    return {
      status: row.status,
      message: row.message,
    };
  }

  return {
    status: "submitted" as const,
    patientName: row.patientName,
  };
}