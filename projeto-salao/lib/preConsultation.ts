import { supabase } from "@/lib/supabaseClient";

const PRODUCTION_ORIGIN = "https://jakoliveira.com.br";

function normalizeWhatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") || digits.length > 11) return digits;
  if (digits.length >= 10) return `55${digits}`;
  return digits;
}

export function buildPortalLink(token: string) {
  return `${PRODUCTION_ORIGIN}/portal/${token}`;
}

export function buildPortalWhatsappMessage(patientName: string, link: string) {
  const firstName = patientName.trim().split(/\s+/)[0] || "tudo bem";
  return [
    `Ola, ${firstName}.`,
    "Segue o seu link de acesso ao portal da Al'mare Saude Capilar:",
    link,
    "Por la voce acompanha seus cuidados recomendados (homecare), fotos de evolucao e seus proximos horarios.",
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

async function parsePortalRouteResponse(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Nao foi possivel gerenciar o link do portal agora.";
    throw new Error(message);
  }

  return payload;
}

export async function issuePortalLink(clientId: string): Promise<{ token: string; linkActive: boolean }> {
  const response = await fetch("/api/portal/link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientId }),
  });
  return parsePortalRouteResponse(response);
}

export async function deactivatePortalLink(clientId: string): Promise<{ linkActive: boolean }> {
  const response = await fetch("/api/portal/link", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientId }),
  });
  return parsePortalRouteResponse(response);
}

export async function togglePortalPreConsulta(clientId: string, active: boolean): Promise<{ linkActive: boolean }> {
  const response = await fetch("/api/portal/pre-consulta", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientId, active }),
  });
  return parsePortalRouteResponse(response);
}

export function notifyPortalUpdate(portalToken?: string) {
  if (!portalToken) return;
  const channel = supabase.channel(`portal:${portalToken}`);
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      void channel.send({
        type: "broadcast",
        event: "update",
        payload: {},
      }).then(() => {
        void supabase.removeChannel(channel);
      });
    }
  });
}

