"use client";

import { useState } from "react";
import { Client, PortalLink } from "@/types";
import {
  buildPortalLink,
  buildPortalWhatsappMessage,
  buildWhatsappShareUrl,
  issuePortalLink,
  deactivatePortalLink,
} from "@/lib/preConsultation";
import { Globe, Link2, Loader2, Send, ToggleLeft, ToggleRight } from "lucide-react";

function formatMaskedToken(token?: string) {
  if (!token) return "Nenhum link emitido ainda.";
  if (token.length <= 16) return token;
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

interface ClientLinksTabProps {
  client: Client;
  portalLink?: PortalLink;
  onTogglePreConsulta: (clientId: string, active: boolean) => Promise<void>;
}

export default function ClientLinksTab({
  client,
  portalLink,
  onTogglePreConsulta,
}: ClientLinksTabProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  const preConsultaActive = client.preConsultation?.linkActive ?? false;
  const preConsultaResponded = client.preConsultation?.respondedAt;

  const handleGeneratePortalLink = async () => {
    try {
      setBusy(true);
      const result = await issuePortalLink(client.id);
      const link = buildPortalLink(result.token);
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        // Ignore
      }
      setMessage("Link do portal copiado com sucesso.");
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(error);
      }
      setMessage(error instanceof Error ? error.message : "Não foi possível gerar o link do portal agora.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeactivatePortalLink = async () => {
    try {
      setBusy(true);
      await deactivatePortalLink(client.id);
      setMessage("Link do portal desativado.");
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(error);
      }
      setMessage(error instanceof Error ? error.message : "Não foi possível invalidar o link do portal agora.");
    } finally {
      setBusy(false);
    }
  };

  const handleSharePortalOnWhatsapp = async () => {
    try {
      setBusy(true);
      const token = portalLink?.token;
      let link = token ? buildPortalLink(token) : null;
      if (!link) {
        const result = await issuePortalLink(client.id);
        link = buildPortalLink(result.token);
      }
      const msg = buildPortalWhatsappMessage(client.profile.nome, link);
      const whatsappUrl = buildWhatsappShareUrl(client.profile.whatsapp, msg);
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      setMessage("Mensagem pronta aberta no WhatsApp com o link do portal.");
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(error);
      }
      setMessage(error instanceof Error ? error.message : "Não foi possível abrir o WhatsApp agora.");
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePreConsulta = async () => {
    if (!preConsultaActive && !portalLink?.token) {
      setMessage("Gere o link do portal antes de ativar a avaliação.");
      return;
    }

    try {
      setToggling(true);
      await onTogglePreConsulta(client.id, !preConsultaActive);
      setMessage(preConsultaActive ? "Avaliação inicial desativada no portal." : "Avaliação inicial ativada no portal.");
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(error);
      }
      setMessage(error instanceof Error ? error.message : "Não foi possível alterar o status.");
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
      {/* Portal do Cliente */}
      <section className="rounded-[32px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.8)] p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl bg-[var(--color-brand-soft)] p-2 text-[var(--color-brand-deep)]">
            <Globe size={18} />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">
                Links de acesso
              </p>
              <h3 className="mt-2 text-lg font-semibold text-[var(--color-text)]">
                Portal da paciente
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                Link único de acesso onde a paciente consulta homecare, agendamentos, galeria e — quando ativado — preenche a avaliação inicial.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--color-brand-line)] bg-white/70 px-4 py-3 text-sm text-[var(--color-text)]">
                <strong>Status do portal</strong>
                <p className="mt-1">{portalLink?.linkActive ? "Ativo" : portalLink?.token ? "Inativo" : "Aguardando geração"}</p>
              </div>
              <div className="rounded-2xl border border-[var(--color-brand-line)] bg-white/70 px-4 py-3 text-sm text-[var(--color-text)]">
                <strong>Código do link</strong>
                <p className="mt-1 break-all text-xs text-[var(--color-text-secondary)]">{formatMaskedToken(portalLink?.token)}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleGeneratePortalLink}
                disabled={busy}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-brand-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : portalLink?.token ? "Gerar novo link" : "Gerar link do portal"}
              </button>
              <button
                type="button"
                onClick={handleSharePortalOnWhatsapp}
                disabled={busy}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={15} /> Enviar no WhatsApp
              </button>
              <button
                type="button"
                onClick={handleDeactivatePortalLink}
                disabled={busy || !portalLink?.token || !portalLink?.linkActive}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-brand-line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Invalidar link
              </button>
            </div>

            {message && <p className="text-xs text-[var(--color-brand-deep)]">{message}</p>}
          </div>
        </div>
      </section>

      {/* Toggle Avaliação Inicial */}
      <section className="rounded-[32px] border border-[var(--color-brand-line)] bg-white/80 p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl bg-[var(--color-brand-soft)] p-2 text-[var(--color-brand-deep)]">
            <Link2 size={18} />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">
                Avaliação inicial
              </p>
              <h3 className="mt-2 text-lg font-semibold text-[var(--color-text)]">
                Formulário dentro do portal
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                Quando ativado, a paciente ve a aba &quot;Avaliação&quot; no portal e pode preencher a triagem inicial. Quando desativado, apenas homecare, agendamentos e galeria ficam visiveis.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-[var(--color-brand-line)] bg-white/70 px-4 py-3 text-sm text-[var(--color-text)]">
                <strong>Avaliação no portal</strong>
                <p className="mt-1">{preConsultaActive ? "Ativada" : "Desativada"}</p>
              </div>
              <div className="rounded-2xl border border-[var(--color-brand-line)] bg-white/70 px-4 py-3 text-sm text-[var(--color-text)]">
                <strong>Status</strong>
                <p className="mt-1">{preConsultaResponded ? "Preenchida" : preConsultaActive ? "Aguardando" : "—"}</p>
              </div>
              <div className="rounded-2xl border border-[var(--color-brand-line)] bg-white/70 px-4 py-3 text-sm text-[var(--color-text)]">
                <strong>Enviada em</strong>
                <p className="mt-1">{preConsultaResponded ? new Date(preConsultaResponded).toLocaleString("pt-BR") : "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTogglePreConsulta}
                disabled={toggling || (!preConsultaActive && !portalLink?.token)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-brand-line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                title={!preConsultaActive && !portalLink?.token ? "Gere o link do portal primeiro" : undefined}
              >
                {toggling ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : preConsultaActive ? (
                  <>
                    <ToggleRight size={20} className="text-green-600" />
                    Desativar avaliação
                  </>
                ) : (
                  <>
                    <ToggleLeft size={20} className="text-gray-400" />
                    Ativar avaliação
                  </>
                )}
              </button>
              {!preConsultaActive && !portalLink?.token && (
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Gere o link do portal antes de ativar a avaliação.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
