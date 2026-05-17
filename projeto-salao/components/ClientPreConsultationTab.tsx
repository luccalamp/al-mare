"use client";

import { useState } from "react";
import { Client, PortalLink } from "@/types";
import { buildPortalLink, buildPortalWhatsappMessage, buildWhatsappShareUrl, issuePortalLink, deactivatePortalLink } from "@/lib/preConsultation";
import { Loader2, Send, Globe, ClipboardList, CheckCircle2 } from "lucide-react";

function formatMaskedToken(token?: string) {
  if (!token) return "Nenhum link emitido ainda.";
  if (token.length <= 16) return token;
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

interface ClientPreConsultationTabProps {
  client: Client;
  portalLink?: PortalLink;
}

export default function ClientPreConsultationTab({ client, portalLink }: ClientPreConsultationTabProps) {
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalMessage, setPortalMessage] = useState<string | null>(null);

  const respondedAt = client.preConsultation?.respondedAt;
  const preConsultaCompleted = !!respondedAt;

  const handleGeneratePortalLink = async () => {
    try {
      setPortalBusy(true);
      const result = await issuePortalLink(client.id);
      const link = buildPortalLink(result.token);
      try { await navigator.clipboard.writeText(link); } catch {}
      setPortalMessage("Link do portal copiado com sucesso.");
    } catch (error) {
      if (process.env.NODE_ENV !== "production") console.error(error);
      setPortalMessage(error instanceof Error ? error.message : "Não foi possível gerar o link do portal agora.");
    } finally { setPortalBusy(false); }
  };

  const handleDeactivatePortalLink = async () => {
    try {
      setPortalBusy(true);
      await deactivatePortalLink(client.id);
      setPortalMessage("Link do portal desativado.");
    } catch (error) {
      if (process.env.NODE_ENV !== "production") console.error(error);
      setPortalMessage(error instanceof Error ? error.message : "Não foi possível invalidar o link do portal agora.");
    } finally { setPortalBusy(false); }
  };

  const handleSharePortalOnWhatsapp = async () => {
    try {
      setPortalBusy(true);
      const token = portalLink?.token;
      let link = token ? buildPortalLink(token) : null;
      if (!link) { const result = await issuePortalLink(client.id); link = buildPortalLink(result.token); }
      const msg = buildPortalWhatsappMessage(client.profile.nome, link);
      const whatsappUrl = buildWhatsappShareUrl(client.profile.whatsapp, msg);
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      setPortalMessage("Mensagem pronta aberta no WhatsApp com o link do portal.");
    } catch (error) {
      if (process.env.NODE_ENV !== "production") console.error(error);
      setPortalMessage(error instanceof Error ? error.message : "Não foi possível abrir o WhatsApp agora.");
    } finally { setPortalBusy(false); }
  };

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
      <section className="rounded-[32px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.8)] p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl bg-[var(--color-brand-soft)] p-2 text-[var(--color-brand-deep)]"><ClipboardList size={18} /></div>
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Pré-consulta</p>
              <h3 className="mt-2 text-lg font-semibold text-[var(--color-text)]">Triagem clínica integrada ao portal</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">A pré-consulta agora faz parte do portal do cliente. Ao acessar o link do portal, o cliente pode preencher a triagem clínica diretamente.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--color-brand-line)] bg-white/70 px-4 py-3 text-sm text-[var(--color-text)]">
                <strong>Status</strong>
                <div className="mt-1 flex items-center gap-2">
                  {preConsultaCompleted ? (<><CheckCircle2 size={14} className="text-emerald-600" /><span className="text-emerald-700">Respondida</span></>) : (<><span className="w-2 h-2 rounded-full bg-amber-500" /><span>Pendente</span></>)}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--color-brand-line)] bg-white/70 px-4 py-3 text-sm text-[var(--color-text)]">
                <strong>Última resposta</strong>
                <p className="mt-1">{respondedAt ? new Date(respondedAt).toLocaleString("pt-BR") : "Sem envio registrado"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.8)] p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl bg-[var(--color-sage-soft)] p-2 text-[var(--color-sage)]"><Globe size={18} /></div>
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-sage)]">Portal do cliente</p>
              <h3 className="mt-2 text-lg font-semibold text-[var(--color-text)]">Link de acesso completo</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">Gere um link exclusivo para o cliente acessar o portal com pré-consulta, homecare, fotos de evolução e próximos agendamentos — sem necessidade de login.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--color-brand-line)] bg-white/70 px-4 py-3 text-sm text-[var(--color-text)]"><strong>Status</strong><p className="mt-1">{portalLink?.linkActive ? "Ativo" : portalLink?.token ? "Inativo" : "Aguardando geração"}</p></div>
              <div className="rounded-2xl border border-[var(--color-brand-line)] bg-white/70 px-4 py-3 text-sm text-[var(--color-text)]"><strong>Código do link</strong><p className="mt-1 break-all text-xs text-[var(--color-text-secondary)]">{formatMaskedToken(portalLink?.token)}</p></div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={handleGeneratePortalLink} disabled={portalBusy} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-sage)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">{portalBusy ? <Loader2 size={16} className="animate-spin" /> : portalLink?.token ? "Gerar novo link" : "Gerar link do portal"}</button>
              <button type="button" onClick={handleSharePortalOnWhatsapp} disabled={portalBusy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-line)] bg-[var(--color-sage-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-sage)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"><Send size={15} /> Enviar no WhatsApp</button>
              <button type="button" onClick={handleDeactivatePortalLink} disabled={portalBusy || !portalLink?.token || !portalLink?.linkActive} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-brand-line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)] disabled:cursor-not-allowed disabled:opacity-40">Invalidar link</button>
            </div>
            {portalMessage && <p className="text-xs text-[var(--color-brand-deep)]">{portalMessage}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
