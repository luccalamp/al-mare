"use client";

import { useState } from "react";
import { Client } from "@/types";
import ImageConsentDocument from "@/components/ImageConsentDocument";
import {
  buildPreConsultationLink,
  buildPreConsultationWhatsappMessage,
  buildWhatsappShareUrl,
} from "@/lib/preConsultation";
import { Link2, Loader2, Send, ShieldCheck } from "lucide-react";

function formatMaskedToken(token?: string) {
  if (!token) {
    return "Nenhum link emitido ainda.";
  }

  if (token.length <= 16) {
    return token;
  }

  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

interface ClientPreConsultationTabProps {
  client: Client;
  onGeneratePreConsultationLink: (clientId: string) => Promise<string>;
  onDeactivatePreConsultationLink: (clientId: string) => Promise<void>;
}

export default function ClientPreConsultationTab({
  client,
  onGeneratePreConsultationLink,
  onDeactivatePreConsultationLink,
}: ClientPreConsultationTabProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const token = client.preConsultation?.token;
  const linkActive = client.preConsultation?.linkActive;
  const respondedAt = client.preConsultation?.respondedAt;

  const resolveShareableLink = async () => {
    if (token && linkActive && typeof window !== "undefined") {
      const link = buildPreConsultationLink(token, window.location.origin);
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        // Ignore clipboard failures; opening WhatsApp is the main action.
      }
      return link;
    }

    return onGeneratePreConsultationLink(client.id);
  };

  const handleGenerateLink = async () => {
    try {
      setBusy(true);
      await onGeneratePreConsultationLink(client.id);
      setMessage("Link de triagem copiado com sucesso.");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Não foi possível gerar o link agora.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeactivateLink = async () => {
    try {
      setBusy(true);
      await onDeactivatePreConsultationLink(client.id);
      setMessage("Link de pré-consulta desativado.");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Não foi possível invalidar o link agora.");
    } finally {
      setBusy(false);
    }
  };

  const handleShareOnWhatsapp = async () => {
    try {
      setBusy(true);
      const link = await resolveShareableLink();
      const message = buildPreConsultationWhatsappMessage(client.profile.nome, link);
      const whatsappUrl = buildWhatsappShareUrl(client.profile.whatsapp, message);
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      setMessage("Mensagem pronta aberta no WhatsApp com o link da pré-consulta.");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Não foi possível abrir o WhatsApp agora.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
      <section className="rounded-[32px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.8)] p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl bg-[var(--color-brand-soft)] p-2 text-[var(--color-brand-deep)]">
            <Link2 size={18} />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">
                Aba de pré-consulta
              </p>
              <h3 className="mt-2 text-lg font-semibold text-[var(--color-text)]">
                Link público de triagem antes da sessão
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                Gere um link exclusivo para a paciente preencher a triagem inicial. As respostas alimentam a ficha clínica e mantêm o consentimento de imagem documentado.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-[var(--color-brand-line)] bg-white/70 px-4 py-3 text-sm text-[var(--color-text)]">
                <strong>Status</strong>
                <p className="mt-1">{linkActive ? "Ativo" : token ? "Inativo" : "Aguardando geração"}</p>
              </div>
              <div className="rounded-2xl border border-[var(--color-brand-line)] bg-white/70 px-4 py-3 text-sm text-[var(--color-text)]">
                <strong>Última resposta</strong>
                <p className="mt-1">{respondedAt ? new Date(respondedAt).toLocaleString("pt-BR") : "Sem envio registrado"}</p>
              </div>
              <div className="rounded-2xl border border-[var(--color-brand-line)] bg-white/70 px-4 py-3 text-sm text-[var(--color-text)]">
                <strong>Código do link</strong>
                <p className="mt-1 break-all text-xs text-[var(--color-text-secondary)]">{formatMaskedToken(token)}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleGenerateLink}
                disabled={busy}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#7a4921] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#623915] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : token ? "Gerar novo link" : "Gerar link"}
              </button>
              <button
                type="button"
                onClick={handleShareOnWhatsapp}
                disabled={busy}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={15} /> Enviar no WhatsApp
              </button>
              <button
                type="button"
                onClick={handleDeactivateLink}
                disabled={busy || !token || !linkActive}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-brand-line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Invalidar link atual
              </button>
            </div>

            {message && <p className="text-xs text-[var(--color-brand-deep)]">{message}</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[32px] border border-[var(--color-brand-line)] bg-white/80 p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-2xl bg-[var(--color-brand-soft)] p-2 text-[var(--color-brand-deep)]">
              <ShieldCheck size={18} />
            </div>
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-[var(--color-text)]">O que a paciente recebe nesse fluxo</h3>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                A página pública coleta queixa principal, objetivo com o tratamento, alergias, medicações, observações e os dois consentimentos principais antes da avaliação presencial.
              </p>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                A ficha clínica deixa de duplicar dados de cadastro. Nome, contatos e dados pessoais passam a vir do perfil da paciente, reduzindo retrabalho e inconsistência.
              </p>
            </div>
          </div>
        </div>

        <ImageConsentDocument compact />
      </section>
    </div>
  );
}