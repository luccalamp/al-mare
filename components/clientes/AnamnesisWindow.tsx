/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { AppointmentDraft, Client, FichaAnamneseCapilarDados, PortalLink, WindowTab, HOME_CARE_PRODUCTS, calcularPrecoComDesconto, calcularParcelas } from "@/types";
import PhotoEvolutionComparison from "./PhotoEvolutionComparison";

const AnamneseCapilarTab = dynamic(() => import("./AnamneseCapilarTab"), { ssr: false });
import ClientProfileTab from "./ClientProfileTab";
import ClientEvolutionTab from "./ClientEvolutionTab";
import ClientAgendaTab from "./ClientAgendaTab";
import ClientFinanceiroTab from "./ClientFinanceiroTab";
import ClientAssinaturasTab from "./ClientAssinaturasTab";
import ClientLinksTab from "./ClientLinksTab";
import {
  CAPILLARY_THERAPY_BUDGET_PRESETS,
  CAPILLARY_THERAPY_MANUAL_TOPICS,
  CAPILLARY_THERAPY_PAYMENT_POLICY,
  CAPILLARY_THERAPY_PDFS,
  CAPILLARY_THERAPY_SESSION_STEPS,
  CapillaryTherapyBudgetPreset,
} from "@/lib/capillaryTherapyReference";
import { getPhotoCategoryLabel, normalizePhotoCategory } from "@/lib/photos";
import {
  WORKFLOW_STAGE_TEMPLATE_LABELS,
  WorkflowStageDefinition,
  WorkflowStageId,
  WorkflowStageTemplate,
  createCustomWorkflowStage,
  createDefaultWorkflowStages,
  fetchWorkflowStagesFromSupabase,
  readWorkflowStagesCache,
  saveWorkflowStagesToSupabase,
  writeWorkflowStagesCache,
} from "@/lib/workflowStages";
import { useMediaCapture } from "@/hooks/useMediaCapture";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  ImageIcon,
  Link2,
  ShieldCheck,
  Zap,
  FlaskConical,
  ShoppingBag,
  Calendar,
  Loader2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Banknote,
  ClipboardList,
  Plus,
  RefreshCcw,
  Trash2,
  GripVertical,
  X,
  Activity,
  ChevronUp,
  CheckCircle,
  Settings,
  Info,
  Check,
  PenTool,
  FileText,
  ExternalLink,
} from "lucide-react";

interface AnamnesisWindowProps {
  client: Client;
  portalLink?: PortalLink;
  onClose: () => void;
  onUpdate: (client: Client, photoFiles?: { file: File; type: string }[]) => Promise<void> | void;
  onAddDiagnostico: (
    clientId: string,
    diagnostico: {
      porosidade: 1 | 2 | 3 | 4 | 5;
      elasticidade: 1 | 2 | 3;
      historiaQuimicaPrevia?: string;
      resultadoTesteMecha: string;
    }
  ) => Promise<void>;
  onAddProcedimento: (
    clientId: string,
    procedimento: {
      tecnicaUtilizada: string;
      valor?: number | null;
      anotacoes?: string;
      alturaClareamento?: number | null;
      fundoClareamentoObtido?: string;
      volumagemOx?: string;
    }
  ) => Promise<void>;
  onDeleteProcedimento: (clientId: string, procedureId: string) => Promise<void>;
  onAddHomecare: (
    clientId: string,
    input: {
      produtosRecomendados: string;
      obsCuidados?: string;
      dataRetornoSugerida?: string;
      valorTotal?: number;
      formaPagamento?: "normal" | "avista" | "parcelado";
      parcelas?: number;
    }
  ) => Promise<void>;
  onConfirmarPagamento: (clientId: string, homecareId: string) => Promise<void>;
  onAddAppointment: (clientId: string, input: AppointmentDraft) => Promise<Client["appointments"][number]>;
  onLinkAppointmentToGoogle: (
    clientId: string,
    appointmentId: string,
    input: Pick<AppointmentDraft, "googleEventId" | "googleCalendarId" | "metadata">
  ) => Promise<Client["appointments"][number]>;
  onSaveFichaAnamnese: (clientId: string, dados: FichaAnamneseCapilarDados) => Promise<void>;
  onDeletePhoto: (clientId: string, photoId: string) => Promise<void>;
  onDeleteClient: (clientId: string) => Promise<void>;
  onTogglePreConsulta: (clientId: string, active: boolean) => Promise<void>;
  initialTab?: WindowTab;
}

const formatDate = (iso?: string) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
};

const formatBRL = (n?: number) =>
  n != null && !Number.isNaN(n)
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)
    : "—";

const ELASTICITY_LABELS: Record<1 | 2 | 3, { label: string; summary: string }> = {
  1: {
    label: "Estável",
    summary: "Boa resposta ao estiramento e menor risco de quebra imediata.",
  },
  2: {
    label: "Sensibilizada",
    summary: "Exige tempo de pausa controlado e protocolo de proteção.",
  },
  3: {
    label: "Crítica",
    summary: "Risco alto de ruptura e necessidade de recuperação antes de química forte.",
  },
};

const POROSITY_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Muito baixa",
  2: "Baixa",
  3: "Média",
  4: "Alta",
  5: "Muito alta",
};

const CUSTOM_STAGE_TEMPLATE_HELP: Record<WorkflowStageTemplate, string> = {
  livre: "Use esta etapa para encaixar qualquer bloco livre no fluxo da clínica.",
  checklist: "Boa para conferências rápidas, pré-requisitos e validações antes de avançar.",
  orientacao: "Ideal para alinhar condutas, recomendações e pontos de atenção da paciente.",
  retorno: "Funciona bem para revisões, acompanhamentos e próximos combinados da jornada.",
};

function getDiagnosisTone(diagnostico?: Client["diagnosticos"][number]) {
  if (!diagnostico) {
    return {
      label: "Sem leitura",
      summary: "Cadastre o primeiro diagnóstico para liberar a leitura técnica desta paciente.",
      badgeClass: "bg-[rgba(122,73,33,0.08)] text-[var(--color-brand-deep)]",
    };
  }

  if (diagnostico.elasticidade === 3 || diagnostico.porosidade >= 5) {
    return {
      label: "Risco elevado",
      summary: "Priorize reconstrução, teste de segurança e baixa agressão química.",
      badgeClass: "bg-rose-100 text-rose-700",
    };
  }

  if (diagnostico.elasticidade === 2 || diagnostico.porosidade === 4) {
    return {
      label: "Atenção",
      summary: "A fibra pede controle rigoroso de exposição, calor e saturação.",
      badgeClass: "bg-amber-100 text-amber-700",
    };
  }

  return {
    label: "Equilíbrio técnico",
    summary: "Cenário estável para avançar com protocolo bem monitorado.",
    badgeClass: "bg-emerald-100 text-emerald-700",
  };
}

function renderWorkflowStageIcon(stage: WorkflowStageDefinition) {
  if (stage.source === "custom") {
    if (stage.template === "checklist") return <ClipboardList size={14} />;
    if (stage.template === "orientacao") return <ShieldCheck size={14} />;
    if (stage.template === "retorno") return <Calendar size={14} />;
    return <Plus size={14} />;
  }

  switch (stage.id) {
    case "perfil":
      return <User size={14} />;
    case "agenda":
      return <Calendar size={14} />;
    case "pre-consulta":
      return <Link2 size={14} />;
    case "anamnese":
      return <ClipboardList size={14} />;
    case "diagnostico":
      return <ShieldCheck size={14} />;
    case "colorimetria":
      return <FlaskConical size={14} />;
    case "pos-venda":
      return <ShoppingBag size={14} />;
    case "galeria":
      return <ImageIcon size={14} />;
    case "evolucao":
      return <Activity size={14} />;
    case "financeiro":
      return <Banknote size={14} />;
    case "assinaturas":
      return <PenTool size={14} />;
    default:
      return <ClipboardList size={14} />;
  }
}

// ---- ABA: DIAGNÓSTICO (ESTRUTURA & SAÚDE) ----
function DiagnosisTab({
  client,
  onAddDiagnostico,
}: {
  client: Client;
  onAddDiagnostico: AnamnesisWindowProps["onAddDiagnostico"];
}) {
  const history = useMemo(
    () => [...client.diagnosticos].sort((left, right) => new Date(right.data).getTime() - new Date(left.data).getTime()),
    [client.diagnosticos]
  );
  const latest = history[0];
  const previous = history[1];
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [porosidade, setPorosidade] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [elasticidade, setElasticidade] = useState<1 | 2 | 3>(1);
  const [historiaQuimicaPrevia, setHistoriaQuimicaPrevia] = useState("");
  const [resultadoTesteMecha, setResultadoTesteMecha] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const latestElasticidade = latest ? ELASTICITY_LABELS[latest.elasticidade] : null;
  const latestPorosidade = latest ? POROSITY_LABELS[latest.porosidade] : null;
  const diagnosisTone = getDiagnosisTone(latest);
  const progressionNote = useMemo(() => {
    if (!latest || !previous) return null;

    const notes: string[] = [];
    if (latest.elasticidade !== previous.elasticidade) {
      notes.push(
        latest.elasticidade > previous.elasticidade
          ? `Elasticidade piorou de ${ELASTICITY_LABELS[previous.elasticidade].label.toLowerCase()} para ${ELASTICITY_LABELS[latest.elasticidade].label.toLowerCase()}.`
          : `Elasticidade melhorou de ${ELASTICITY_LABELS[previous.elasticidade].label.toLowerCase()} para ${ELASTICITY_LABELS[latest.elasticidade].label.toLowerCase()}.`
      );
    }

    if (latest.porosidade !== previous.porosidade) {
      notes.push(
        latest.porosidade > previous.porosidade
          ? `Porosidade subiu de ${POROSITY_LABELS[previous.porosidade].toLowerCase()} para ${POROSITY_LABELS[latest.porosidade].toLowerCase()}.`
          : `Porosidade reduziu de ${POROSITY_LABELS[previous.porosidade].toLowerCase()} para ${POROSITY_LABELS[latest.porosidade].toLowerCase()}.`
      );
    }

    if (notes.length === 0) {
      return "Sem variação técnica relevante em relação ao registro anterior.";
    }

    return notes.join(" ");
  }, [latest, previous]);

  const resetForm = () => {
    setPorosidade(3);
    setElasticidade(1);
    setHistoriaQuimicaPrevia("");
    setResultadoTesteMecha("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!resultadoTesteMecha.trim()) {
      setFeedback({ type: "error", message: "Informe o resultado do teste de mecha." });
      return;
    }

    try {
      setIsSubmitting(true);
      setFeedback(null);
      await onAddDiagnostico(client.id, {
        porosidade,
        elasticidade,
        historiaQuimicaPrevia: historiaQuimicaPrevia.trim(),
        resultadoTesteMecha: resultadoTesteMecha.trim(),
      });
      setFeedback({ type: "success", message: "Diagnóstico salvo com sucesso." });
      resetForm();
      setTimeout(() => {
        setIsFormOpen(false);
        setFeedback(null);
      }, 700);
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Não foi possível salvar o diagnóstico agora." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative space-y-5 p-4 sm:space-y-6 sm:p-6">
      <section className="rounded-[32px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.82)] p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Saúde Capilar</p>
            <h3 className="text-lg font-semibold text-[var(--color-text)]">Mapa técnico da fibra em uma leitura só</h3>
            <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
              Reúna elasticidade, porosidade, histórico químico e resultado do teste de mecha em um painel clínico mais fácil de revisar antes de qualquer procedimento.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#7a4921] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#623915]"
          >
            {isFormOpen ? "Fechar formulário" : "+ Novo diagnóstico"}
          </button>
        </div>

        {!latest ? (
          <div className="mt-5 rounded-[28px] border border-dashed border-[var(--color-brand-line)] bg-white/60 px-5 py-8 text-center text-sm text-[var(--color-text-secondary)]">
            Nenhum diagnóstico técnico registrado para esta paciente ainda.
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-[24px] border border-[var(--color-brand-line)] bg-white/70 px-4 py-4 shadow-[0_10px_24px_rgba(94,58,28,0.05)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Elasticidade</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{latestElasticidade?.label}</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{latestElasticidade?.summary}</p>
            </div>
            <div className="rounded-[24px] border border-[var(--color-brand-line)] bg-white/70 px-4 py-4 shadow-[0_10px_24px_rgba(94,58,28,0.05)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Porosidade</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{latestPorosidade}</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Escala {latest.porosidade}/5 para leitura de absorção e retenção.</p>
            </div>
            <div className="rounded-[24px] border border-[var(--color-brand-line)] bg-white/70 px-4 py-4 shadow-[0_10px_24px_rgba(94,58,28,0.05)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Painel</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{history.length} leitura{history.length !== 1 ? "s" : ""}</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Última atualização em {formatDate(latest.data)}.</p>
            </div>
          </div>
        )}

        {isFormOpen && (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4 rounded-[28px] border border-[var(--color-brand-line)] bg-white/80 p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold text-[var(--color-text)]">Novo Diagnóstico Capilar</h4>
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setFeedback(null);
                }}
                disabled={isSubmitting}
                className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] disabled:opacity-50"
              >
                Fechar
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">Porosidade (1-5)</span>
                <select
                  value={porosidade}
                  onChange={(e) => setPorosidade(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-[var(--color-brand-line)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-brand-accent)]/25"
                >
                  <option value={1}>1 — muito baixa</option>
                  <option value={2}>2 — baixa</option>
                  <option value={3}>3 — média</option>
                  <option value={4}>4 — alta</option>
                  <option value={5}>5 — muito alta</option>
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">Elasticidade</span>
                <select
                  value={elasticidade}
                  onChange={(e) => setElasticidade(Number(e.target.value) as 1 | 2 | 3)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-[var(--color-brand-line)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-brand-accent)]/25"
                >
                  <option value={1}>Saudável</option>
                  <option value={2}>Sensibilizado</option>
                  <option value={3}>Crítico</option>
                </select>
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">Histórico Químico</span>
              <textarea
                value={historiaQuimicaPrevia}
                onChange={(e) => setHistoriaQuimicaPrevia(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-[var(--color-brand-line)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-brand-accent)]/25"
                placeholder="Descreva os processos químicos anteriores..."
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">Teste de Mecha</span>
              <textarea
                value={resultadoTesteMecha}
                onChange={(e) => setResultadoTesteMecha(e.target.value)}
                rows={2}
                required
                className="w-full rounded-xl border border-[var(--color-brand-line)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-brand-accent)]/25"
                placeholder="Resultado técnico do teste de mecha"
              />
            </label>

            {feedback && (
              <div
                className={`text-xs font-medium rounded-xl px-3 py-2 ${
                  feedback.type === "success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                }`}
              >
                {feedback.message}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#7a4921] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#623915] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                {isSubmitting ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
        <article className="rounded-[32px] border border-[var(--color-brand-line)] bg-white/85 p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Leitura atual</p>
              <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)]">
                {latest ? "Panorama do último diagnóstico" : "Aguardando o primeiro diagnóstico"}
              </h3>
            </div>
            <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${diagnosisTone.badgeClass}`}>
              {diagnosisTone.label}
            </span>
          </div>

          <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{diagnosisTone.summary}</p>

          {latest ? (
            <>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Elasticidade</p>
                  <div className="mt-3 flex gap-1.5">
                    {[1, 2, 3].map((value) => (
                      <div
                        key={value}
                        className={`h-2 flex-1 rounded-full ${value <= latest.elasticidade ? "bg-[#7a4921]" : "bg-white"}`}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-base font-semibold text-[var(--color-text)]">{latestElasticidade?.label}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{latestElasticidade?.summary}</p>
                </div>

                <div className="rounded-[24px] border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Porosidade</p>
                  <div className="mt-3 flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <div
                        key={value}
                        className={`h-2 flex-1 rounded-full ${value <= latest.porosidade ? "bg-[#b98555]" : "bg-white"}`}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-base font-semibold text-[var(--color-text)]">{latestPorosidade}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Nível {latest.porosidade}/5 na escala clínica de abertura da fibra.</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
                <div className="rounded-[24px] border border-[var(--color-brand-line)] bg-white/70 px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Histórico químico</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {latest.historiaQuimicaPrevia || "Sem histórico químico informado neste registro."}
                  </p>

                  {progressionNote && (
                    <div className="mt-4 rounded-2xl bg-[var(--color-brand-soft)] px-4 py-3 text-sm text-[var(--color-brand-deep)]">
                      {progressionNote}
                    </div>
                  )}
                </div>

                <div className="rounded-[24px] border border-[var(--color-brand-line)] bg-white/70 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Teste de mecha</p>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                        latest.presencaMetais ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {latest.presencaMetais ? "Metais detectados" : "Sem metais"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {latest.resultadoTesteMecha || "Teste pendente."}
                  </p>
                  <p className="mt-4 text-xs text-[var(--color-text-secondary)]">Registro coletado em {formatDate(latest.data)}.</p>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-[24px] border border-dashed border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-4 py-5 text-sm text-[var(--color-text-secondary)]">
              Assim que o primeiro diagnóstico for salvo, esta área passa a resumir a saúde da fibra, as mudanças entre leituras e o resultado do teste de mecha.
            </div>
          )}
        </article>

        <article className="rounded-[32px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.82)] p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Histórico</p>
          <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)]">Linha do tempo clínica</h3>

          {history.length === 0 ? (
            <div className="mt-4 rounded-[24px] border border-dashed border-[var(--color-brand-line)] bg-white/60 px-4 py-5 text-sm text-[var(--color-text-secondary)]">
              Ainda não há entradas para comparar evolução técnica.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {history.map((diagnostico, index) => {
                const tone = getDiagnosisTone(diagnostico);
                return (
                  <div key={diagnostico.id} className="rounded-[24px] border border-[var(--color-brand-line)] bg-white/75 px-4 py-4 shadow-[0_10px_24px_rgba(94,58,28,0.05)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Leitura {String(index + 1).padStart(2, "0")}</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">{formatDate(diagnostico.data)}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${tone.badgeClass}`}>
                        {tone.label}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl bg-[var(--color-brand-soft)] px-3 py-3 text-sm text-[var(--color-brand-deep)]">
                        <strong className="block text-[11px] uppercase tracking-[0.18em]">Elasticidade</strong>
                        {ELASTICITY_LABELS[diagnostico.elasticidade].label}
                      </div>
                      <div className="rounded-2xl bg-[var(--color-brand-soft)] px-3 py-3 text-sm text-[var(--color-brand-deep)]">
                        <strong className="block text-[11px] uppercase tracking-[0.18em]">Porosidade</strong>
                        {POROSITY_LABELS[diagnostico.porosidade]}
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                      {diagnostico.resultadoTesteMecha || "Sem observação do teste de mecha."}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

// ---- ABA: PROCEDIMENTOS (historico_procedimentos) ----
function ColorimetyTab({
  client,
  onAddProcedimento,
  onDeleteProcedimento,
}: {
  client: Client;
  onAddProcedimento: AnamnesisWindowProps["onAddProcedimento"];
  onDeleteProcedimento: AnamnesisWindowProps["onDeleteProcedimento"];
}) {
  const procedures = useMemo(
    () => [...client.colorimetrias].sort((left, right) => new Date(right.data).getTime() - new Date(left.data).getTime()),
    [client.colorimetrias]
  );
  const latest = procedures[0];
  const totalRevenue = useMemo(
    () => procedures.reduce((sum, procedure) => sum + (procedure.valor || 0), 0),
    [procedures]
  );
  const averageTicket = procedures.length > 0 ? totalRevenue / procedures.length : undefined;

  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [formaPagamento, setFormaPagamento] = useState<"normal" | "avista" | "parcelado">("normal");
  const [parcelas, setParcelas] = useState(1);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const confirmBudgetPreset = async (preset: CapillaryTherapyBudgetPreset) => {
    try {
      setSaving(true);
      const isAvista = formaPagamento === "avista";
      const isParcelado = formaPagamento === "parcelado";
      const valorFinal = isAvista
        ? calcularPrecoComDesconto(preset.value, CAPILLARY_THERAPY_PAYMENT_POLICY.upfrontDiscountPercent)
        : preset.value;

      let paymentNote = "";
      if (isAvista) {
        paymentNote = `(À vista com ${CAPILLARY_THERAPY_PAYMENT_POLICY.upfrontDiscountPercent}% de desconto)`;
      } else if (isParcelado && parcelas > 1) {
        paymentNote = `(Parcelado em ${parcelas}x no cartão)`;
      } else {
        paymentNote = `(Pagamento normal)`;
      }

      const finalNotes = preset.notes ? `${preset.notes}\n${paymentNote}` : paymentNote;

      await onAddProcedimento(client.id, {
        tecnicaUtilizada: preset.tecnicaUtilizada,
        valor: Math.round(valorFinal * 100) / 100,
        anotacoes: finalNotes,
        alturaClareamento: null,
        fundoClareamentoObtido: undefined,
        volumagemOx: undefined,
      });
      setSelectedPresetId(null);
      setFormaPagamento("avista");
      setParcelas(1);
    } catch {
      alert("Não foi possível salvar o procedimento. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProcedure = async (procedureId: string) => {
    if (!confirm("Tem certeza que deseja excluir este procedimento? Esta ação não pode ser desfeita.")) {
      return;
    }
    try {
      setDeletingId(procedureId);
      await onDeleteProcedimento(client.id, procedureId);
    } catch {
      alert("Não foi possível excluir o procedimento. Tente novamente.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="relative space-y-5 p-4 sm:space-y-6 sm:p-6">
      <section className="rounded-[32px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.82)] p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Procedimentos</p>
            <h3 className="text-lg font-semibold text-[var(--color-text)]">Sessões registradas com visão financeira e técnica</h3>
            <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
              Organize o histórico de procedimentos e sessões de terapia capilar, mantenha visíveis os detalhes técnicos quando houver, e acompanhe o valor gerado por paciente sem abrir outra tela.
            </p>
          </div>


        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-[24px] border border-[var(--color-brand-line)] bg-white/70 px-4 py-4 shadow-[0_10px_24px_rgba(94,58,28,0.05)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Último registro</p>
            <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{latest?.tecnicaUtilizada || "Sem sessões"}</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {latest ? `Registrado em ${formatDate(latest.data)}` : "Adicione o primeiro procedimento desta paciente."}
            </p>
          </div>
          <div className="rounded-[24px] border border-[var(--color-brand-line)] bg-white/70 px-4 py-4 shadow-[0_10px_24px_rgba(94,58,28,0.05)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Faturamento</p>
            <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{formatBRL(totalRevenue)}</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Soma dos procedimentos lançados neste prontuário.</p>
          </div>
          <div className="rounded-[24px] border border-[var(--color-brand-line)] bg-white/70 px-4 py-4 shadow-[0_10px_24px_rgba(94,58,28,0.05)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Ticket médio</p>
            <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{formatBRL(averageTicket)}</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{procedures.length} procedimento{procedures.length !== 1 ? "s" : ""} registrado{procedures.length !== 1 ? "s" : ""}.</p>
          </div>
        </div>

        <div className="mt-5 rounded-[28px] border border-[var(--color-brand-line)] bg-white/75 p-4 shadow-[0_12px_30px_rgba(94,58,28,0.06)] sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Orçamento Terapia Capilar</p>
              <h4 className="text-base font-semibold text-[var(--color-text)]">Consulta, sessão avulsa e pacotes prontos para lançar</h4>
              <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                Os valores abaixo seguem o PDF de orçamento e já preenchem o formulário de procedimento com a descrição base do atendimento.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {CAPILLARY_THERAPY_PDFS.map((resource) => (
                <a
                  key={resource.id}
                  href={resource.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-brand-deep)] transition hover:bg-white"
                >
                  <FileText size={13} />
                  {resource.title}
                  <ExternalLink size={12} />
                </a>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {CAPILLARY_THERAPY_BUDGET_PRESETS.map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              
              if (isSelected) {
                const valorComDesconto = calcularPrecoComDesconto(preset.value, CAPILLARY_THERAPY_PAYMENT_POLICY.upfrontDiscountPercent);
                const parcelasCalculadas = parcelas > 1 ? calcularParcelas(preset.value, parcelas) : [];
                
                return (
                  <div key={preset.id} className="rounded-[24px] border border-emerald-300 bg-emerald-50/70 p-4 shadow-[0_14px_26px_rgba(94,58,28,0.08)] flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">{preset.title}</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">{preset.description}</p>
                    </div>
                    
                    <div className="mt-3 space-y-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setFormaPagamento("normal"); setParcelas(1); }}
                          className={`flex-1 rounded-xl border py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition ${
                            formaPagamento === "normal" ? "bg-blue-100 border-blue-400 text-blue-800" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          Normal
                        </button>
                        <button
                          type="button"
                          onClick={() => { setFormaPagamento("avista"); setParcelas(1); }}
                          className={`flex-1 rounded-xl border py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition ${
                            formaPagamento === "avista" ? "bg-emerald-100 border-emerald-400 text-emerald-800" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          À vista (-10%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormaPagamento("parcelado")}
                          className={`flex-1 rounded-xl border py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition ${
                            formaPagamento === "parcelado" ? "bg-[var(--color-brand-soft)] border-[var(--color-brand-line)] text-[var(--color-brand-deep)]" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          Parcelar
                        </button>
                      </div>
                      
                      {formaPagamento === "parcelado" && (
                        <div className="flex gap-2">
                          {Array.from({ length: CAPILLARY_THERAPY_PAYMENT_POLICY.maxInstallments - 1 }, (_, index) => index + 2).map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setParcelas(n)}
                              className={`flex-1 rounded-xl border py-1.5 text-xs font-bold transition ${
                                parcelas === n ? "bg-[var(--color-brand-soft)] border-[var(--color-brand-line)] text-[var(--color-brand-deep)]" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                              }`}
                            >
                              {n}x
                            </button>
                          ))}
                        </div>
                      )}
                      
                      <div className="rounded-xl bg-white/80 p-3 text-center border border-emerald-100">
                        {formaPagamento === "avista" ? (
                          <>
                            <p className="text-[10px] text-[var(--color-text-secondary)] line-through">R$ {preset.value.toFixed(2)}</p>
                            <p className="text-lg font-black text-emerald-700">R$ {valorComDesconto.toFixed(2)}</p>
                          </>
                        ) : formaPagamento === "parcelado" ? (
                          <>
                            <p className="text-[10px] text-[var(--color-text-secondary)]">{parcelas}x de R$ {parcelas > 1 ? parcelasCalculadas[0].toFixed(2) : preset.value.toFixed(2)}</p>
                            <p className="text-lg font-black text-[var(--color-brand-deep)]">R$ {preset.value.toFixed(2)}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-lg font-black text-[var(--color-brand-deep)]">R$ {preset.value.toFixed(2)}</p>
                          </>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPresetId(null)}
                          disabled={saving}
                          className="flex-1 rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmBudgetPreset(preset)}
                          disabled={saving}
                          className="flex-[2] rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-70 flex items-center justify-center gap-1.5"
                        >
                          {saving && <Loader2 size={12} className="animate-spin" />}
                          Confirmar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSelectedPresetId(preset.id);
                    setFormaPagamento("normal");
                    setParcelas(1);
                  }}
                  className="rounded-[24px] border border-[var(--color-brand-line)] bg-white/85 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_26px_rgba(94,58,28,0.08)] flex flex-col"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-brand-accent)]">{preset.title}</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">{preset.description}</p>
                  <div className="mt-auto pt-3">
                    <p className="text-lg font-black text-[var(--color-brand-deep)]">{formatBRL(preset.value)}</p>
                    <p className="mt-2 text-[11px] leading-5 text-[var(--color-text-secondary)]">Toque para selecionar a forma de pagamento.</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-brand-deep)]">
            <span className="rounded-full border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-3 py-2">
              {CAPILLARY_THERAPY_PAYMENT_POLICY.creditLabel}
            </span>
            <span className="rounded-full border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-3 py-2">
              {CAPILLARY_THERAPY_PAYMENT_POLICY.upfrontLabel}
            </span>
          </div>
        </div>
      </section>

      {procedures.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-[var(--color-brand-line)] bg-white/70 px-5 py-10 text-center text-sm text-[var(--color-text-secondary)]">
          Nenhum procedimento registrado para esta paciente ainda.
        </div>
      ) : (
        <div className="space-y-4">
          {procedures.map((col, index) => (
            <article
              key={col.id}
              className="rounded-[32px] border border-[var(--color-brand-line)] bg-white/85 p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Procedimento {String(index + 1).padStart(2, "0")}</p>
                  <h4 className="mt-1 text-lg font-semibold text-[var(--color-text)]">{col.tecnicaUtilizada || "Procedimento técnico"}</h4>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Registro de {formatDate(col.data)}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                    <Banknote size={14} /> {formatBRL(col.valor)}
                  </span>
                  {col.alturaClareamento > 0 ? (
                    <span className="rounded-full bg-[var(--color-brand-soft)] px-3 py-2 text-sm font-semibold text-[var(--color-brand-deep)]">
                      Altura {col.alturaClareamento}
                    </span>
                  ) : null}
                  {col.fundoClareamentoObtido ? (
                    <span className="rounded-full bg-[var(--color-brand-soft)] px-3 py-2 text-sm font-semibold text-[var(--color-brand-deep)]">
                      Fundo {col.fundoClareamentoObtido}
                    </span>
                  ) : null}
                  {col.volumagemOx ? (
                    <span className="rounded-full bg-[var(--color-brand-soft)] px-3 py-2 text-sm font-semibold text-[var(--color-brand-deep)]">
                      {col.volumagemOx}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleDeleteProcedure(col.id)}
                    disabled={deletingId === col.id}
                    className="ml-2 rounded-full p-2 text-rose-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Excluir procedimento"
                  >
                    {deletingId === col.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[24px] border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Anotações e mistura</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {col.misturaTonalizante || "Sem observação técnica registrada para esta sessão."}
                  </p>
                </div>

                <div className="rounded-[24px] border border-[var(--color-brand-line)] bg-white/70 px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Checklist rápido</p>
                  <div className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
                    <p>Altura de clareamento: <strong className="text-[var(--color-text)]">{col.alturaClareamento > 0 ? col.alturaClareamento : "—"}</strong></p>
                    <p>Fundo obtido: <strong className="text-[var(--color-text)]">{col.fundoClareamentoObtido || "—"}</strong></p>
                    <p>Volumagem OX: <strong className="text-[var(--color-text)]">{col.volumagemOx || "—"}</strong></p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}


    </div>
  );
}

// ---- ABA: PÓS-VENDA (HOMECARE & MANUTENÇÃO) ----
function HomecareTab({ client, onAddHomecare, onConfirmarPagamento }: {
  client: Client;
  onAddHomecare: AnamnesisWindowProps["onAddHomecare"];
  onConfirmarPagamento: AnamnesisWindowProps["onConfirmarPagamento"];
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const [produtosRecomendados, setProdutosRecomendados] = useState("");
  const [obsCuidados, setObsCuidados] = useState("");
  const [dataRetornoSugerida, setDataRetornoSugerida] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [formaPagamento, setFormaPagamento] = useState<"normal" | "avista" | "parcelado">("normal");
  const [parcelas, setParcelas] = useState(1);

  const toggleProduct = (name: string) => {
    setSelectedProducts((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  };

  const produtosSelecionados = HOME_CARE_PRODUCTS.filter((p) => selectedProducts.includes(p.name));
  const valorTotalHomecare = produtosSelecionados.reduce((s, p) => s + p.price, 0);
  const valorComDesconto = valorTotalHomecare > 0 ? calcularPrecoComDesconto(valorTotalHomecare, CAPILLARY_THERAPY_PAYMENT_POLICY.upfrontDiscountPercent) : 0;
  const valorFinalHomecare = valorTotalHomecare > 0
    ? Math.round((formaPagamento === "avista" ? valorComDesconto : valorTotalHomecare) * 100) / 100
    : 0;
  const parcelasCalculadas = parcelas > 1 ? calcularParcelas(valorTotalHomecare, parcelas) : [];

  const selectedText = produtosSelecionados.map((p) => `${p.name} (${p.priceLabel ?? `R$ ${p.price.toFixed(2)}`})`).join(", ");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = produtosRecomendados.trim() || selectedText;
    if (!text) return;

    setSaving(true);
    try {
      await onAddHomecare(client.id, {
        produtosRecomendados: text,
        obsCuidados: obsCuidados || undefined,
        dataRetornoSugerida: dataRetornoSugerida || undefined,
        valorTotal: valorFinalHomecare || undefined,
        formaPagamento: valorTotalHomecare > 0 ? formaPagamento : undefined,
        parcelas: formaPagamento === "parcelado" ? parcelas : undefined,
      });
      setIsAdding(false);
      setProdutosRecomendados("");
      setObsCuidados("");
      setDataRetornoSugerida("");
      setSelectedProducts([]);
      setFormaPagamento("avista");
      setParcelas(1);
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar recomendação.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
      {/* Catálogo de Produtos Home Care */}
      <section className="rounded-[32px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.82)] p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Catálogo Home Care</p>
        <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)]">Kit Home Care</h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Selecione o kit para incluir na prescrição. {CAPILLARY_THERAPY_PAYMENT_POLICY.creditLabel} ou {CAPILLARY_THERAPY_PAYMENT_POLICY.upfrontLabel.toLowerCase()}.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {HOME_CARE_PRODUCTS.map((product) => {
            const isSelected = selectedProducts.includes(product.name);
            return (
              <button
                key={product.name}
                type="button"
                onClick={() => toggleProduct(product.name)}
                className={`text-left rounded-2xl border p-4 transition-all ${
                  isSelected
                    ? "border-emerald-300 bg-emerald-50/70 shadow-[0_4px_12px_rgba(94,58,28,0.08)]"
                    : "border-[var(--color-brand-line)] bg-white/70 hover:bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text)]">{product.name}</p>
                    {product.description && (
                      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{product.description}</p>
                    )}
                  </div>
                  <span className="text-sm font-black text-[var(--color-brand-deep)] flex-shrink-0">
                    {product.priceLabel ?? `R$ ${product.price.toFixed(0)}`}
                  </span>
                </div>
                {isSelected && (
                  <div className="mt-2 flex items-center gap-1 text-emerald-600">
                    <Check size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Selecionado</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {selectedProducts.length > 0 && (
          <div className="mt-4 rounded-2xl border border-[var(--color-brand-line)] bg-white p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-[var(--color-text)]">Valor tabela</span>
              <span className="font-black text-[var(--color-brand-deep)]">R$ {valorTotalHomecare.toFixed(2)}</span>
            </div>
            {formaPagamento === "avista" && valorTotalHomecare > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-600 font-semibold">A vista com {CAPILLARY_THERAPY_PAYMENT_POLICY.upfrontDiscountPercent}% de desconto</span>
                <span className="font-bold text-emerald-600">R$ {valorComDesconto.toFixed(2)}</span>
              </div>
            )}
            {formaPagamento === "parcelado" && parcelasCalculadas.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-[var(--color-text-secondary)]">
                  {parcelas}x de R$ {parcelasCalculadas[0].toFixed(2)} sem juros
                </p>
                <p className="text-[10px] text-[var(--color-text-secondary)]">Total: R$ {valorTotalHomecare.toFixed(2)}</p>
              </div>
            )}
            {valorFinalHomecare > 0 && (
              <div className="flex items-center justify-between border-t border-[var(--color-brand-line)] pt-3 text-xs">
                <span className="font-semibold text-[var(--color-text-secondary)]">Valor final do lancamento</span>
                <span className="font-bold text-[var(--color-text)]">R$ {valorFinalHomecare.toFixed(2)}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setFormaPagamento("normal"); setParcelas(1); }}
                className={`flex-1 rounded-xl border py-2 text-xs font-bold uppercase tracking-wider transition ${
                  formaPagamento === "normal" ? "bg-blue-100 border-blue-400 text-blue-800" : "bg-white border-gray-200 text-gray-500"
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => { setFormaPagamento("avista"); setParcelas(1); }}
                className={`flex-1 rounded-xl border py-2 text-xs font-bold uppercase tracking-wider transition ${
                  formaPagamento === "avista" ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-gray-200 text-gray-500"
                }`}
              >
                À vista (-10%)
              </button>
              <button
                type="button"
                onClick={() => setFormaPagamento("parcelado")}
                className={`flex-1 rounded-xl border py-2 text-xs font-bold uppercase tracking-wider transition ${
                  formaPagamento === "parcelado" ? "bg-[var(--color-brand-soft)] border-[var(--color-brand-line)] text-[var(--color-brand-deep)]" : "bg-white border-gray-200 text-gray-500"
                }`}
              >
                Parcelar
              </button>
            </div>
            {formaPagamento === "parcelado" && (
              <div className="flex gap-2">
                {Array.from({ length: CAPILLARY_THERAPY_PAYMENT_POLICY.maxInstallments - 1 }, (_, index) => index + 2).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setParcelas(n)}
                    className={`flex-1 rounded-xl border py-2 text-xs font-bold transition ${
                      parcelas === n ? "bg-[var(--color-brand-soft)] border-[var(--color-brand-line)] text-[var(--color-brand-deep)]" : "bg-white border-gray-200 text-gray-500"
                    }`}
                  >
                    {n}x
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-[32px] border border-[var(--color-brand-line)] bg-white/80 p-5 shadow-[0_18px_45px_rgba(94,58,28,0.05)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Materiais de apoio</p>
            <h3 className="text-lg font-semibold text-[var(--color-text)]">Manual e orçamento sempre acessiveis</h3>
            <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
              Mantenha o PDF do manual e o PDF do orçamento por perto durante a orientação da paciente e a prescrição do homecare.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {CAPILLARY_THERAPY_PDFS.map((resource) => (
            <a
              key={resource.id}
              href={resource.href}
              target="_blank"
              rel="noreferrer"
              className="group rounded-[24px] border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] p-4 transition hover:bg-white"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-2xl bg-white/80 p-3 text-[var(--color-brand-deep)] shadow-[0_8px_20px_rgba(94,58,28,0.05)]">
                  <FileText size={18} />
                </div>
                <ExternalLink size={14} className="mt-1 text-[var(--color-brand-accent)] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">{resource.title}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{resource.description}</p>
            </a>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-[24px] border border-[var(--color-brand-line)] bg-white/80 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Consulta observa</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {CAPILLARY_THERAPY_MANUAL_TOPICS.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-3 py-2 text-[11px] font-semibold text-[var(--color-brand-deep)]"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--color-brand-line)] bg-white/80 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Sessao terapeutica inclui</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {CAPILLARY_THERAPY_SESSION_STEPS.map((step) => (
                <span
                  key={step}
                  className="rounded-full border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-3 py-2 text-[11px] font-semibold text-[var(--color-brand-deep)]"
                >
                  {step}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.82)] p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Pós-Venda</p>
            <h3 className="text-lg font-semibold text-[var(--color-text)]">Plano de Manutenção (Homecare)</h3>
            <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
              Prescreva os cuidados que a paciente deve ter em casa e os produtos ideais para manter a saúde e beleza dos fios após o procedimento.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#7a4921] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#623915]"
          >
            + Nova prescrição
          </button>
        </div>

        {client.homecare.length === 0 ? (
          <div className="mt-5 rounded-[28px] border border-dashed border-[var(--color-brand-line)] bg-white/60 px-5 py-8 text-center text-sm text-[var(--color-text-secondary)]">
            Nenhuma prescrição homecare registrada para esta paciente ainda.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {client.homecare.map((h) => (
              <div key={h.id} className="rounded-[24px] border border-[var(--color-brand-line)] bg-white/70 p-5 shadow-[0_10px_24px_rgba(94,58,28,0.05)]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Prescrição Técnica</span>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--color-text-secondary)]">
                    <Calendar size={10} /> {formatDate(h.data)}
                  </div>
                </div>
                <p className="mt-3 text-sm font-medium text-[var(--color-text)]">{h.produtosRecomendados}</p>
                {h.valorTotal && (
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <span className="font-bold text-[var(--color-brand-deep)]">R$ {h.valorTotal.toFixed(2)}</span>
                    {h.formaPagamento === "parcelado" && h.parcelas && (
                      <span className="text-[var(--color-text-secondary)]">{h.parcelas}x no cartão</span>
                    )}
                    {h.formaPagamento === "avista" && (
                      <span className="text-emerald-600 font-semibold">A vista (-{CAPILLARY_THERAPY_PAYMENT_POLICY.upfrontDiscountPercent}%)</span>
                    )}
                  </div>
                )}
                {h.obsCuidados && (
                  <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)] italic">&ldquo;{h.obsCuidados}&rdquo;</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {h.dataRetornoSugerida && (
                    <div className="flex items-center gap-2 rounded-[16px] border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-4 py-2">
                      <Zap size={12} className="text-[var(--color-brand-deep)]" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-brand-deep)]">
                        Retorno: {formatDate(h.dataRetornoSugerida)}
                      </span>
                    </div>
                  )}
                  {h.valorTotal && (
                    h.pago ? (
                      <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5">
                        <CheckCircle size={13} className="text-emerald-600" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                          Pago {h.confirmadoEm ? formatDate(h.confirmadoEm) : ""}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void onConfirmarPagamento(client.id, h.id)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 transition hover:bg-emerald-100"
                      >
                        <CheckCircle size={13} />
                        Confirmar pagamento
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal / Sheet for Add */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isAdding && (
              <motion.div
                className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/20 p-0 sm:p-4 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => !saving && setIsAdding(false)}
              >
                <motion.form
                  onSubmit={handleSubmit}
                  className="flex max-h-[calc(var(--app-dvh)-0.5rem)] w-full flex-col overflow-hidden rounded-t-[32px] border border-[var(--color-brand-line)] bg-[rgba(255,251,247,0.96)] shadow-[0_30px_90px_rgba(0,0,0,0.16)] sm:max-h-[calc(var(--app-dvh)-2rem)] sm:max-w-md sm:rounded-[32px]"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-black/5 bg-white/70 px-4 py-4 sm:px-6">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7a4921] text-white">
                        <ShoppingBag size={14} />
                      </div>
                      <h3 className="text-base font-bold text-[var(--color-text)]">Nova Prescrição</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      disabled={saving}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-brand-line)] bg-white text-[var(--color-text)] transition hover:bg-[var(--color-brand-soft)] disabled:opacity-50"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-accent)]">Produtos Recomendados *</label>
                      <textarea
                        required
                        value={produtosRecomendados}
                        onChange={(e) => setProdutosRecomendados(e.target.value)}
                        placeholder="Ex: Kit Home Care"
                        rows={3}
                        className="input-light min-h-24"
                      />
                      {selectedProducts.length > 0 && (
                        <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                          Item do catálogo: {selectedText}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-accent)]">Observações / Rotina de Uso</label>
                      <textarea
                        value={obsCuidados}
                        onChange={(e) => setObsCuidados(e.target.value)}
                        placeholder="Ex: Usar máscara 1x na semana. Evitar água muito quente..."
                        rows={3}
                        className="input-light min-h-24"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-accent)]">Data de Retorno Sugerida</label>
                      <input
                        type="date"
                        value={dataRetornoSugerida}
                        onChange={(e) => setDataRetornoSugerida(e.target.value)}
                        className="input-light"
                      />
                    </div>
                  </div>

                  <div className="border-t border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.96)] p-4 sm:p-6 flex flex-col-reverse sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      disabled={saving}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--color-brand-line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)] disabled:cursor-not-allowed sm:w-auto sm:py-2"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#7a4921] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#623915] disabled:cursor-not-allowed disabled:opacity-70 sm:ml-auto sm:w-auto sm:py-2"
                    >
                      {saving && <Loader2 size={14} className="animate-spin" />}
                      {saving ? "Salvando..." : "Salvar prescrição"}
                    </button>
                  </div>
                </motion.form>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}

type PhotoUploadCategory = "antes" | "depois" | "referencia";

const PHOTO_CATEGORY_LABELS: Record<PhotoUploadCategory, string> = {
  antes: "Antes do protocolo",
  depois: "Resultado parcial/final",
  referencia: "Tricoscopia / comparativo",
};

const GALLERY_FILE_ACCEPT = "image/jpeg,image/png,image/webp";
const GALLERY_FALLBACK_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="#f5ede1"/><rect x="88" y="88" width="624" height="624" rx="32" fill="#eadcc8"/><path d="M220 560l110-130 85 95 70-64 95 99H220z" fill="#c49a6c"/><circle cx="320" cy="300" r="42" fill="#b07a45"/><text x="400" y="660" text-anchor="middle" fill="#7a4921" font-family="Arial, sans-serif" font-size="30">Imagem indisponivel</text></svg>`
)}`;

// ---- ABA: GALERIA ----
function GalleryTab({
  client,
  onUpdate,
  onDeletePhoto,
}: {
  client: Client;
  onUpdate: (c: Client, files?: {file: File, type: string}[]) => Promise<void> | void;
  onDeletePhoto: (clientId: string, photoId: string) => Promise<void>;
}) {
  const [activeFilter, setActiveFilter] = useState<"todos" | PhotoUploadCategory>("todos");
  const [captureType, setCaptureType] = useState<PhotoUploadCategory>("antes");
  const [galleryFeedback, setGalleryFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [removingPhotoId, setRemovingPhotoId] = useState<string | null>(null);
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<string[]>([]);
  const {
    videoRef,
    isActive,
    error,
    isBusy,
    activeFacingMode,
    hasMultipleCameras,
    startCapture,
    stopCapture,
    switchCamera,
    captureFrame,
  } = useMediaCapture();

  const activeCameraLabel = activeFacingMode === "environment" ? "Traseira" : "Frontal";

  const filteredPhotos = useMemo(() => {
    if (activeFilter === "todos") return client.gallery;
    return client.gallery.filter((photo) => normalizePhotoCategory(photo.type) === activeFilter);
  }, [activeFilter, client.gallery]);

  const totals = useMemo(() => {
    return client.gallery.reduce(
      (acc, photo) => {
        const key = normalizePhotoCategory(photo.type);
        acc[key] += 1;
        return acc;
      },
      { antes: 0, depois: 0, referencia: 0 }
    );
  }, [client.gallery]);

  useEffect(() => {
    setBrokenPhotoIds((current) => current.filter((photoId) => client.gallery.some((photo) => photo.id === photoId)));
  }, [client.gallery]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: PhotoUploadCategory) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (isUploading) {
      setGalleryFeedback({ tone: "error", message: "Aguarde o envio atual terminar antes de iniciar outro upload." });
      return;
    }

    try {
      setIsUploading(true);
      setGalleryFeedback(null);
      await onUpdate({ ...client, updatedAt: new Date().toISOString() }, files.map((file) => ({ file, type })));
      setGalleryFeedback({
        tone: "success",
        message: `${files.length} foto${files.length > 1 ? "s enviadas" : " enviada"} com sucesso para a galeria.`,
      });
      e.target.value = "";
    } catch (uploadError) {
      setGalleryFeedback({
        tone: "error",
        message: uploadError instanceof Error ? uploadError.message : "Nao foi possivel enviar as fotos agora.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCapture = async () => {
    if (isUploading) {
      setGalleryFeedback({ tone: "error", message: "Aguarde o envio atual terminar antes de capturar uma nova foto." });
      return;
    }

    try {
      setIsUploading(true);
      setGalleryFeedback(null);
      const file = await captureFrame(`captura-${captureType}-${Date.now()}.jpg`);
      if (!file) return;

      await onUpdate(
        { ...client, updatedAt: new Date().toISOString() },
        [{ file, type: captureType }]
      );
      setGalleryFeedback({ tone: "success", message: `Foto ${PHOTO_CATEGORY_LABELS[captureType].toLowerCase()} capturada e salva com sucesso.` });
    } catch (captureError) {
      setGalleryFeedback({
        tone: "error",
        message: captureError instanceof Error ? captureError.message : "Nao foi possivel capturar a foto agora.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const renderCategoryBadge = (type: string) => {
    return getPhotoCategoryLabel(type);
  };

  const renderPhotoTitle = (type: string) => {
    const category = normalizePhotoCategory(type);
    if (category === "antes") return "Registro antes do protocolo";
    if (category === "depois") return "Registro de evolucao";
    return "Registro de tricoscopia ou comparativo";
  };

  const handleRemovePhoto = async (photo: Client["gallery"][number]) => {
    const confirmed = window.confirm(`Arquivar ${renderPhotoTitle(photo.type).toLowerCase()} da galeria desta paciente e mover para quarentena privada?`);
    if (!confirmed) return;

    try {
      setGalleryFeedback(null);
      setRemovingPhotoId(photo.id);
      await onDeletePhoto(client.id, photo.id);
      setGalleryFeedback({ tone: "success", message: "Foto arquivada com sucesso." });
    } catch (removeError) {
      setGalleryFeedback({
        tone: "error",
        message: removeError instanceof Error ? removeError.message : "Nao foi possivel arquivar a foto agora.",
      });
    } finally {
      setRemovingPhotoId(null);
    }
  };

  return (
     <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
       <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
         <div className="order-last rounded-[28px] border border-[var(--color-brand-line)] bg-white/70 p-4 shadow-[0_18px_45px_rgba(94,58,28,0.08)] sm:p-5 xl:order-first">
           <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
             <div>
               <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Galeria de evolucao</p>
               <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)]">Antes, tricoscopia e comparativos do protocolo</h3>
             </div>
             <div className="grid grid-cols-3 gap-2 text-center text-xs">
               <div className="rounded-2xl bg-[var(--color-brand-soft)] px-3 py-2 text-[var(--color-brand-deep)]">
                 <strong className="block text-base">{totals.antes}</strong>
                 Antes
               </div>
               <div className="rounded-2xl bg-[var(--color-brand-soft)] px-3 py-2 text-[var(--color-brand-deep)]">
                 <strong className="block text-base">{totals.depois}</strong>
                 Evolucao
               </div>
               <div className="rounded-2xl bg-[var(--color-brand-soft)] px-3 py-2 text-[var(--color-brand-deep)]">
                 <strong className="block text-base">{totals.referencia}</strong>
                 Tricoscopia
               </div>
             </div>
           </div>

           <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
             {(["antes", "depois", "referencia"] as PhotoUploadCategory[]).map((type) => (
               <label key={type} className={`rounded-2xl border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-deep)] transition-all sm:text-left sm:py-2.5 ${isUploading ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-white"}`}>
                 + {PHOTO_CATEGORY_LABELS[type]}
                 <input
                   type="file"
                   accept={GALLERY_FILE_ACCEPT}
                   multiple
                   disabled={isUploading}
                   className="hidden"
                   onChange={(e) => void handleUpload(e, type)}
                 />
               </label>
             ))}
           </div>

           <div className="mt-4 flex flex-wrap gap-2">
             {([
               ["todos", "Tudo"],
               ["antes", "Antes do protocolo"],
               ["depois", "Durante/resultado"],
               ["referencia", "Tricoscopia"],
             ] as const).map(([value, label]) => (
               <button
                 key={value}
                 type="button"
                 onClick={() => setActiveFilter(value)}
                 className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                   activeFilter === value
                     ? "bg-[#7a4921] text-white"
                     : "bg-[var(--color-brand-soft)] text-[var(--color-brand-deep)] hover:bg-white"
                 }`}
               >
                 {label}
               </button>
             ))}
           </div>

           {galleryFeedback && (
             <p className={`mt-4 text-sm ${galleryFeedback.tone === "success" ? "text-emerald-700" : "text-rose-700"}`}>
               {galleryFeedback.message}
             </p>
           )}
           {isUploading && <p className="mt-2 text-xs font-medium text-[var(--color-brand-deep)]">Enviando imagens e atualizando a galeria...</p>}

           <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
             {filteredPhotos.length === 0 ? (
               <div className="col-span-full rounded-[24px] border border-dashed border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] p-6 text-sm text-[var(--color-text-secondary)]">
                 Nenhuma foto nesta categoria ainda. Use &ldquo;Adicionar registro de evolucao&rdquo; quando quiser comparar o protocolo.
               </div>
             ) : (
               filteredPhotos.map((photo) => (
                 <div key={photo.id} className="group overflow-hidden rounded-[24px] border border-[var(--color-brand-line)] bg-white shadow-[0_10px_24px_rgba(94,58,28,0.06)]">
                   <div className="relative aspect-square bg-[#eadcc8]">
                       <button
                         type="button"
                         onClick={() => void handleRemovePhoto(photo)}
                         disabled={removingPhotoId === photo.id}
                         className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(52,28,12,0.72)] text-white shadow-sm transition hover:bg-[rgba(52,28,12,0.88)] disabled:cursor-not-allowed disabled:opacity-60"
                         aria-label="Arquivar foto"
                       >
                         {removingPhotoId === photo.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                       </button>
                        <Image
                          src={brokenPhotoIds.includes(photo.id) || !photo.url ? GALLERY_FALLBACK_IMAGE : photo.url}
                          alt={renderPhotoTitle(photo.type)}
                          fill
                          unoptimized
                          sizes="(min-width: 640px) 33vw, 50vw"
                          className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                          onError={() =>
                            setBrokenPhotoIds((current) => (current.includes(photo.id) ? current : [...current, photo.id]))
                          }
                        />
                     <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-[rgba(52,28,12,0.78)] to-transparent px-3 py-3 text-white">
                       <span className="rounded-full bg-white/18 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em]">{renderCategoryBadge(photo.type)}</span>
                       <span className="text-[11px] text-white/85">{formatDate(photo.date)}</span>
                     </div>
                   </div>
                   <div className="space-y-1 px-3 py-3 text-xs text-[var(--color-text-secondary)]">
                     <p className="font-semibold text-[var(--color-text)]">{renderPhotoTitle(photo.type)}</p>
                     {photo.technicalNote ? <p>{photo.technicalNote}</p> : <p>Sem anotação técnica registrada.</p>}
                   </div>
                 </div>
               ))
             )}
           </div>
         </div>

         <div
           className={
             isActive
               ? "fixed inset-0 z-[100] flex flex-col bg-black p-4 sm:p-8"
               : "order-first flex flex-col rounded-[28px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.8)] p-4 shadow-[0_18px_45px_rgba(94,58,28,0.08)] sm:p-5 xl:order-last"
           }
         >
           {!isActive && (
             <>
               <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Webcam</p>
               <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)]">Captura direta no prontuário</h3>
               <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Use a camera para registrar couro cabeludo, tricoscopia ou evolucao sem sair da ficha.</p>
             </>
           )}

           <div
             className={`relative overflow-hidden bg-[#2d1b10] shadow-inner ${
               isActive
                 ? "flex-1 rounded-3xl border border-white/20 bg-black"
                 : "mt-4 rounded-[24px] border border-[var(--color-brand-line)]"
             }`}
           >
             <video
               ref={videoRef}
               autoPlay
               muted
               playsInline
               className={`w-full transition-opacity ${
                 isActive
                   ? "h-full object-contain opacity-100"
                   : "h-[min(44dvh,26rem)] object-cover opacity-0 sm:aspect-[4/3] sm:h-auto"
               }`}
             />
             {!isActive && (
               <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/75">
                 {isBusy ? "Abrindo a câmera frontal..." : "Inicie a câmera para capturar uma nova imagem clínica."}
               </div>
             )}
             {isActive && (
               <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/90 sm:px-6">
                 <span>Câmera {activeCameraLabel}</span>
                 <span className="rounded-full bg-white/20 px-3 py-1">{PHOTO_CATEGORY_LABELS[captureType]}</span>
               </div>
             )}
           </div>

           {!isActive && (
             <div className="mt-3 flex items-center justify-between gap-3 rounded-[20px] bg-[var(--color-brand-soft)] px-3 py-3 text-xs text-[var(--color-brand-deep)]">
               <span>{isBusy ? "Preparando câmera..." : "Abertura padrão: câmera frontal."}</span>
               <span className="shrink-0 rounded-full bg-white/70 px-2.5 py-1 font-semibold">
                 {hasMultipleCameras === false ? "Sem segunda câmera" : "Troca disponível"}
               </span>
             </div>
           )}

           <div
             className={`${
               isActive
                 ? "mt-6 shrink-0"
                 : "app-sticky-footer -mx-4 mt-4 border-t border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.96)] px-4 pt-4 shadow-[0_-18px_35px_rgba(94,58,28,0.06)] sm:static sm:mx-0 sm:border-t-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:shadow-none"
             }`}
           >
             <div className="space-y-4">
               {/* Destination Dropdown */}
               <label className={`block text-xs font-semibold uppercase tracking-[0.22em] ${isActive ? "text-white/70" : "text-[var(--color-brand-accent)]"}`}>
                 Destino da captura
                 <select
                   value={captureType}
                   onChange={(event) => setCaptureType(event.target.value as PhotoUploadCategory)}
                   className={`mt-2 block w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors ${
                     isActive
                       ? "border-white/20 bg-white/10 text-white focus:border-white focus:bg-white/20"
                       : "input-light"
                   }`}
                 >
                   {(["antes", "depois", "referencia"] as PhotoUploadCategory[]).map((type) => (
                     <option key={type} value={type} className={isActive ? "text-black" : ""}>
                       {PHOTO_CATEGORY_LABELS[type]}
                     </option>
                   ))}
                 </select>
               </label>

               {error && <p className={`text-sm ${isActive ? "text-rose-400" : "text-rose-700"}`}>{error}</p>}

               <div className={`grid gap-2 ${isActive ? "grid-cols-3" : "grid-cols-1"}`}>
                 {!isActive && (
                   <button
                     type="button"
                     onClick={() => void startCapture()}
                     disabled={isBusy}
                     className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#7a4921] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#623915] disabled:cursor-not-allowed disabled:opacity-60"
                   >
                     {isBusy ? "Abrindo Câmera..." : "Iniciar Câmera"}
                   </button>
                 )}

                 {isActive && (
                   <button
                     type="button"
                     onClick={stopCapture}
                     disabled={isBusy}
                     className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 bg-transparent px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                   >
                     Cancelar
                   </button>
                 )}

                 {isActive && (
                   <button
                     type="button"
                     onClick={() => void switchCamera()}
                     disabled={isBusy || hasMultipleCameras === false}
                     className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-2 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                   >
                     <RefreshCcw size={18} />
                     <span className="hidden sm:inline">{activeFacingMode === "user" ? "Usar traseira" : "Usar frontal"}</span>
                   </button>
                 )}

                 {isActive && (
                   <button
                     type="button"
                     onClick={handleCapture}
                     disabled={isBusy || isUploading}
                     className="inline-flex min-h-12 items-center justify-center rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(249,115,22,0.4)] transition hover:bg-orange-600 hover:shadow-[0_0_25px_rgba(249,115,22,0.6)] disabled:cursor-not-allowed disabled:opacity-45"
                   >
                     {isUploading ? "Salvando..." : "Capturar"}
                   </button>
                 )}
               </div>
             </div>
           </div>
         </div>
       </section>

       <PhotoEvolutionComparison photos={client.gallery} />
    </div>
  );
}

// ---- MAIN WINDOW ----
export default function AnamnesisWindow({
  client,
  portalLink,
  onClose,
  onUpdate,
  onAddDiagnostico,
  onAddProcedimento,
  onDeleteProcedimento,
  onAddHomecare,
  onConfirmarPagamento,
  onAddAppointment,
  onLinkAppointmentToGoogle,
  onSaveFichaAnamnese,
  onDeletePhoto,
  onDeleteClient,
  onTogglePreConsulta,
  initialTab = "perfil",
}: AnamnesisWindowProps) {
  const [activeTab, setActiveTab] = useState<WorkflowStageId>(initialTab);
  const [workflowStages, setWorkflowStages] = useState<WorkflowStageDefinition[]>(() => createDefaultWorkflowStages());
  const [workflowLoaded, setWorkflowLoaded] = useState(false);
  const [workflowSyncState, setWorkflowSyncState] = useState<"loading" | "syncing" | "synced" | "error">("loading");
  const [draggedStageId, setDraggedStageId] = useState<WorkflowStageId | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<WorkflowStageId | null>(null);
  const [showStageEditor, setShowStageEditor] = useState(false);
  const [showMobileStagePicker, setShowMobileStagePicker] = useState(false);
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [customStageDraft, setCustomStageDraft] = useState<{
    label: string;
    template: WorkflowStageTemplate;
    description: string;
  }>({
    label: "",
    template: "livre",
    description: "",
  });
  const journey = client.journey ?? {
    stageLabel: "Cadastro",
    nextActionLabel: "Revisar prontuario",
    nextTab: "perfil" as WindowTab,
    tone: "neutral" as const,
  };
  const journeyToneClass = {
    neutral: "bg-white/70 text-[#6e6e73]",
    warning: "bg-amber-100 text-amber-700",
    accent: "bg-[rgba(122,73,33,0.10)] text-[var(--color-brand-deep)]",
    success: "bg-emerald-100 text-emerald-700",
  }[journey.tone];

  const visibleStages = useMemo(() => workflowStages.filter((stage) => stage.visible), [workflowStages]);
  const activeStage = useMemo(
    () => workflowStages.find((stage) => stage.id === activeTab) ?? null,
    [activeTab, workflowStages]
  );
  const activeDisplayStage = activeStage ?? visibleStages[0] ?? null;
  const activeCustomStage = activeStage?.source === "custom" ? activeStage : null;
  const activeVisibleStageIndex = visibleStages.findIndex((stage) => stage.id === activeTab);
  const previousVisibleStage = activeVisibleStageIndex > 0 ? visibleStages[activeVisibleStageIndex - 1] : null;
  const nextVisibleStage =
    activeVisibleStageIndex >= 0 && activeVisibleStageIndex < visibleStages.length - 1
      ? visibleStages[activeVisibleStageIndex + 1]
      : null;
  const journeyTargetTab = visibleStages.some((stage) => stage.id === journey.nextTab)
    ? journey.nextTab
    : visibleStages[0]?.id ?? journey.nextTab;
  const activeStageLabel = activeDisplayStage?.label.trim() || (activeDisplayStage ? "Etapa extra" : "Escolher etapa");

  const workflowSyncMessage = {
    loading: "Carregando etapas salvas na nuvem.",
    syncing: "Sincronizando fluxo na nuvem.",
    synced: "Fluxo salvo com segurança para uso em qualquer dispositivo.",
    error: "Nao foi possivel sincronizar agora. O cache local continua preservado neste navegador.",
  }[workflowSyncState];

  const workflowSyncToneClass = {
    loading: "text-[#6e6e73]",
    syncing: "text-[var(--color-brand-deep)]",
    synced: "text-emerald-700",
    error: "text-rose-700",
  }[workflowSyncState];

  useEffect(() => {
    let active = true;
    setWorkflowLoaded(false);
    setWorkflowSyncState("loading");

    const cachedStages = readWorkflowStagesCache();
    setWorkflowStages(cachedStages);

    void (async () => {
      try {
        const remoteStages = await fetchWorkflowStagesFromSupabase();
        if (!active) return;

        if (remoteStages) {
          setWorkflowStages(remoteStages);
          writeWorkflowStagesCache(remoteStages);
        }

        setWorkflowSyncState("synced");
      } catch (error) {
        console.error(error);
        if (active) {
          setWorkflowSyncState("error");
        }
      } finally {
        if (active) {
          setWorkflowLoaded(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!workflowLoaded) return;

    writeWorkflowStagesCache(workflowStages);
    setWorkflowSyncState("syncing");

    let active = true;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          await saveWorkflowStagesToSupabase(workflowStages);
          if (active) {
            setWorkflowSyncState("synced");
          }
        } catch (error) {
          console.error(error);
          if (active) {
            setWorkflowSyncState("error");
          }
        }
      })();
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [workflowLoaded, workflowStages]);

  useEffect(() => {
    if (!visibleStages.length) return;

    const hasActiveVisibleStage = visibleStages.some((stage) => stage.id === activeTab);
    if (!hasActiveVisibleStage) {
      setActiveTab(visibleStages[0].id);
    }
  }, [activeTab, visibleStages]);

  const updateWorkflowStage = (stageId: WorkflowStageId, updater: (stage: WorkflowStageDefinition) => WorkflowStageDefinition) => {
    setWorkflowStages((current) => current.map((stage) => (stage.id === stageId ? updater(stage) : stage)));
  };

  const clearWorkflowStageDrag = useCallback(() => {
    setDraggedStageId(null);
    setDragOverStageId(null);
  }, []);

  const moveWorkflowStageToIndex = useCallback((stageId: WorkflowStageId, targetIndex: number) => {
    setWorkflowStages((current) => {
      const index = current.findIndex((stage) => stage.id === stageId);

      if (index < 0 || targetIndex < 0 || targetIndex >= current.length || index === targetIndex) {
        return current;
      }

      const reordered = [...current];
      const [target] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, target);
      return reordered;
    });
  }, []);

  const moveWorkflowStage = (stageId: WorkflowStageId, direction: -1 | 1) => {
    const index = workflowStages.findIndex((stage) => stage.id === stageId);
    const nextIndex = index + direction;

    if (index < 0 || nextIndex < 0 || nextIndex >= workflowStages.length) {
      return;
    }

    moveWorkflowStageToIndex(stageId, nextIndex);
  };

  const handleStageDrop = useCallback(
    (targetStageId: WorkflowStageId) => {
      if (!draggedStageId || draggedStageId === targetStageId) {
        clearWorkflowStageDrag();
        return;
      }

      const targetIndex = workflowStages.findIndex((stage) => stage.id === targetStageId);
      if (targetIndex >= 0) {
        moveWorkflowStageToIndex(draggedStageId, targetIndex);
      }

      clearWorkflowStageDrag();
    },
    [clearWorkflowStageDrag, draggedStageId, moveWorkflowStageToIndex, workflowStages]
  );

  const toggleWorkflowStageVisibility = (stageId: WorkflowStageId) => {
    setWorkflowStages((current) => {
      const visibleCount = current.filter((stage) => stage.visible).length;
      return current.map((stage) => {
        if (stage.id !== stageId) return stage;
        if (stage.visible && visibleCount === 1) return stage;
        return { ...stage, visible: !stage.visible };
      });
    });
  };

  const handleDeleteCustomStage = (stageId: WorkflowStageId) => {
    setWorkflowStages((current) => current.filter((stage) => stage.id !== stageId));
    setActiveTab((current) => (current === stageId ? "perfil" : current));
  };

  const handleAddCustomStage = () => {
    const label = customStageDraft.label.trim();
    if (!label) return;

    const nextStage = createCustomWorkflowStage(customStageDraft);
    setWorkflowStages((current) => [...current, nextStage]);
    setActiveTab(nextStage.id);
    setCustomStageDraft({ label: "", template: "livre", description: "" });
  };

  const handleResetWorkflow = () => {
    const defaultStages = createDefaultWorkflowStages();
    setWorkflowStages(defaultStages);
    setActiveTab(initialTab);
  };

  useEffect(() => {
    const previousOverlayState = document.body.dataset.overlayOpen;
    document.body.dataset.overlayOpen = "true";
    return () => {
      if (previousOverlayState) {
        document.body.dataset.overlayOpen = previousOverlayState;
      } else {
        delete document.body.dataset.overlayOpen;
      }
    };
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        className="premium-overlay fixed inset-0 z-50 flex items-stretch justify-center p-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="premium-window relative flex min-h-[var(--app-dvh)] w-full max-w-none flex-col overflow-hidden rounded-none border-none shadow-none"
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="premium-window-header app-sticky-header flex shrink-0 flex-col" style={{ zIndex: 30 }}>
            {/* Top row: close + name + actions */}
            <div className="flex items-center gap-2 px-3 py-3 sm:px-5 sm:py-2.5">
              <button
                onClick={onClose}
                className="ios-touch-target inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#ff5f57] text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#e34940] sm:h-8 sm:w-8 sm:text-[10px]"
                aria-label="Fechar janela"
              >
                <X size={14} />
              </button>

              <div className="min-w-0 flex-1 px-1">
                <p className="truncate text-sm font-semibold text-[#1d1d1f]">{client.profile.nome}</p>
              </div>

              <button
                type="button"
                onClick={() => setHeaderExpanded((prev) => !prev)}
                className={`ios-touch-target inline-flex min-h-11 items-center gap-1 rounded-full px-3.5 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors sm:h-8 sm:min-h-0 sm:px-2.5 ${journeyToneClass}`}
                aria-label="Detalhes da jornada"
                title="Ver informações da jornada"
              >
                <Info size={12} />
                <span className="hidden sm:inline">{journey.stageLabel}</span>
                <ChevronUp size={12} className={`transition-transform duration-200 ${headerExpanded ? "" : "rotate-180"}`} />
              </button>

              <button
                type="button"
                onClick={() => setShowStageEditor(true)}
                className="hidden h-11 w-11 items-center justify-center rounded-full border border-black/5 bg-white/60 text-[#6e6e73] transition hover:bg-white hover:text-[#1d1d1f] sm:inline-flex sm:h-8 sm:w-8"
                aria-label="Personalizar etapas"
                title="Personalizar etapas"
              >
                <Settings size={14} />
              </button>
            </div>

            {/* Expandable journey banner */}
            <AnimatePresence>
              {headerExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-2 border-t border-black/5 bg-white/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-[#6e6e73]">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${journeyToneClass}`}>
                        {journey.stageLabel}
                      </span>
                      <span>
                        Proxima acao: <strong className="text-[#1d1d1f]">{journey.nextActionLabel}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setActiveTab(journeyTargetTab); setHeaderExpanded(false); }}
                      disabled={activeTab === journeyTargetTab}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-brand-deep)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Abrir proxima acao
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="border-t border-black/5 px-3 py-3 md:hidden">
              <div className="premium-card rounded-[1.35rem] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Atendimento em curso</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${journeyToneClass}`}>
                        {journey.stageLabel}
                      </span>
                      <span className="rounded-full bg-black/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6e6e73]">
                        {activeStageLabel}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                      Proxima acao: <strong className="text-[var(--color-text)]">{journey.nextActionLabel}</strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowMobileStagePicker(true)}
                    className="premium-button-secondary ios-touch-target shrink-0 rounded-[1rem] px-3.5 py-2 text-xs font-semibold"
                  >
                    <span className="relative z-10">Etapas</span>
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab(journeyTargetTab);
                      setHeaderExpanded(false);
                      setShowMobileStagePicker(false);
                    }}
                    disabled={activeTab === journeyTargetTab}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-3 py-2.5 text-xs font-semibold text-[var(--color-brand-deep)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Proxima acao
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileStagePicker(false);
                      setShowStageEditor(true);
                    }}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-brand-line)] bg-white px-3 py-2.5 text-xs font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)]"
                  >
                    Organizar fluxo
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop tab bar (hidden on mobile — bottom bar is used instead) */}
            <div className="hidden md:block">
              <div className="app-scroll-area overflow-x-auto px-3 pb-2 sm:px-5">
                <nav className="flex min-w-max gap-1 rounded-xl bg-black/[0.04] p-0.5 backdrop-blur-md">
                  {visibleStages.map((stage) => (
                    <button
                      key={stage.id}
                      onClick={() => setActiveTab(stage.id)}
                      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase transition-all ${
                        activeTab === stage.id ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#6e6e73] hover:bg-black/5"
                      }`}
                    >
                      {renderWorkflowStageIcon(stage)}
                      <span>{stage.label.trim() || (stage.source === "builtin" ? "Etapa" : "Etapa extra")}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>

          {/* ── Content Area ── */}
          <div key={`tab-${activeTab}`} className="app-scroll-area custom-scrollbar flex-1 overflow-y-auto overflow-x-hidden pb-[calc(6rem+max(0.75rem,env(safe-area-inset-bottom)))] md:pb-0 md:safe-pb">
            {activeTab === "perfil" && (
              <ClientProfileTab
                client={client}
                onUpdate={onUpdate}
                onDeleteClient={onDeleteClient}
              />
            )}
            {activeTab === "evolucao" && (
              <ClientEvolutionTab
                key={client.id}
                client={client}
                onUpdate={onUpdate}
              />
            )}
            {activeTab === "financeiro" && (
              <ClientFinanceiroTab client={client} />
            )}
            {activeTab === "assinaturas" && (
              <ClientAssinaturasTab client={client} onUpdate={onUpdate} />
            )}
            {activeTab === "agenda" && (
              <ClientAgendaTab
                client={client}
                onAddAppointment={onAddAppointment}
                onLinkAppointmentToGoogle={onLinkAppointmentToGoogle}
              />
            )}
            {activeTab === "pre-consulta" && (
              <ClientLinksTab
                client={client}
                portalLink={portalLink}
                onTogglePreConsulta={onTogglePreConsulta}
              />
            )}
            {activeTab === "anamnese" && (
              <AnamneseCapilarTab client={client} onSave={(dados) => onSaveFichaAnamnese(client.id, dados)} />
            )}
            {activeTab === "diagnostico" && <DiagnosisTab client={client} onAddDiagnostico={onAddDiagnostico} />}
            {activeTab === "colorimetria" && (
              <ColorimetyTab client={client} onAddProcedimento={onAddProcedimento} onDeleteProcedimento={onDeleteProcedimento} />
            )}
            {activeTab === "pos-venda" && <HomecareTab client={client} onAddHomecare={onAddHomecare} onConfirmarPagamento={onConfirmarPagamento} />}
            {activeTab === "galeria" && <GalleryTab client={client} onUpdate={onUpdate} onDeletePhoto={onDeletePhoto} />}
            {activeCustomStage && (
              <section className="space-y-5 p-4 sm:p-6">
                <div className="rounded-[32px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.82)] p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">
                    {WORKFLOW_STAGE_TEMPLATE_LABELS[activeCustomStage.template]}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-[var(--color-text)]">
                    {activeCustomStage.label.trim() || "Etapa extra"}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {activeCustomStage.description?.trim() || CUSTOM_STAGE_TEMPLATE_HELP[activeCustomStage.template]}
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[28px] border border-[var(--color-brand-line)] bg-white/80 p-5 text-sm leading-6 text-[var(--color-text-secondary)] shadow-[0_18px_45px_rgba(94,58,28,0.06)]">
                    <strong className="text-[var(--color-text)]">Fluxo adaptável</strong>
                    <p className="mt-2">
                      Esta etapa foi adicionada para refletir o jeito real da clínica trabalhar. Você pode renomear, ocultar, mover ou excluir esse bloco no editor de etapas.
                    </p>
                  </div>
                  <div className="rounded-[28px] border border-[var(--color-brand-line)] bg-white/80 p-5 text-sm leading-6 text-[var(--color-text-secondary)] shadow-[0_18px_45px_rgba(94,58,28,0.06)]">
                    <strong className="text-[var(--color-text)]">Navegação rápida</strong>
                    <p className="mt-2">
                      Use a barra superior para saltar entre blocos ou reorganize a ordem para frente e para trás conforme o atendimento pedir.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  {previousVisibleStage && (
                    <button
                      type="button"
                      onClick={() => setActiveTab(previousVisibleStage.id)}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-brand-line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)]"
                    >
                      Etapa anterior
                    </button>
                  )}
                  {nextVisibleStage && (
                    <button
                      type="button"
                      onClick={() => setActiveTab(nextVisibleStage.id)}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-white"
                    >
                      Proxima etapa
                    </button>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* ── Mobile Bottom Navigation Bar ── */}
          {!showStageEditor && !showMobileStagePicker && (
            <nav
              className="fixed inset-x-0 bottom-0 z-[35] px-3 pt-3 md:hidden"
              style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
            >
              <div className="ios-bottom-dock grid grid-cols-[auto_1fr_auto] gap-2 rounded-[1.8rem] p-2.5">
                <button
                  type="button"
                  onClick={() => previousVisibleStage && setActiveTab(previousVisibleStage.id)}
                  disabled={!previousVisibleStage}
                  className="premium-button-secondary ios-touch-target inline-flex h-11 w-11 items-center justify-center rounded-[1.1rem] disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Etapa anterior"
                >
                  <span className="relative z-10">
                    <ChevronLeft size={18} />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowMobileStagePicker(true)}
                  className="premium-button-primary ios-touch-target rounded-[1.2rem] px-4 py-3 text-left"
                  aria-expanded={showMobileStagePicker}
                  aria-label="Abrir seletor de etapas"
                >
                  <span className="relative z-10 flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/18 text-white/95">
                      {activeDisplayStage ? renderWorkflowStageIcon(activeDisplayStage) : <ClipboardList size={16} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/72">Etapa atual</span>
                      <span className="block truncate text-sm font-semibold text-white">{activeStageLabel}</span>
                    </span>
                    <ChevronDown size={16} className="shrink-0 text-white/82" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => nextVisibleStage && setActiveTab(nextVisibleStage.id)}
                  disabled={!nextVisibleStage}
                  className="premium-button-secondary ios-touch-target inline-flex h-11 w-11 items-center justify-center rounded-[1.1rem] disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Próxima etapa"
                >
                  <span className="relative z-10">
                    <ChevronRight size={18} />
                  </span>
                </button>
              </div>
            </nav>
          )}

          <AnimatePresence>
            {showMobileStagePicker && (
              <motion.div
                className="absolute inset-0 z-[36] flex items-end justify-center bg-[rgba(17,17,17,0.22)] backdrop-blur-sm md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowMobileStagePicker(false)}
              >
                <motion.div
                  className="ios-bottom-sheet flex max-h-[calc(var(--app-dvh)-0.75rem)] w-full flex-col overflow-hidden rounded-t-[2rem]"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 24 }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mx-auto mt-2 h-1.5 w-14 rounded-full bg-black/10" />

                  <div className="flex items-start justify-between gap-4 border-b border-black/5 px-4 py-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Etapas do atendimento</p>
                      <h3 className="mt-2 text-xl font-semibold text-[var(--color-text)]">Troque de etapa sem apertar abas pequenas</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMobileStagePicker(false)}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-brand-line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)]"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="app-scroll-area hide-scrollbar flex-1 overflow-y-auto px-4 py-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
                    <div className="space-y-3">
                      {visibleStages.map((stage) => {
                        const isActiveStage = activeTab === stage.id;
                        const stageDescription =
                          stage.source === "builtin"
                            ? "Parte do fluxo clinico principal desta paciente."
                            : stage.description?.trim() || CUSTOM_STAGE_TEMPLATE_HELP[stage.template];

                        return (
                          <button
                            key={stage.id}
                            type="button"
                            onClick={() => {
                              setActiveTab(stage.id);
                              setShowMobileStagePicker(false);
                            }}
                            className={`premium-card w-full rounded-[1.35rem] px-4 py-4 text-left transition ${
                              isActiveStage
                                ? "border-[var(--color-brand-accent)] bg-[rgba(244,230,211,0.92)] shadow-[0_20px_44px_rgba(94,58,28,0.12)]"
                                : "hover:bg-white"
                            }`}
                            aria-current={isActiveStage ? "page" : undefined}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                                  isActiveStage
                                    ? "bg-[var(--color-brand-deep)] text-white"
                                    : "bg-[rgba(122,73,33,0.08)] text-[var(--color-brand-deep)]"
                                }`}
                              >
                                {renderWorkflowStageIcon(stage)}
                              </span>

                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-[var(--color-text)]">
                                    {stage.label.trim() || (stage.source === "builtin" ? "Etapa" : "Etapa extra")}
                                  </span>
                                  {stage.id === journeyTargetTab && (
                                    <span className="rounded-full bg-[var(--color-brand-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-deep)]">
                                      Sugerida
                                    </span>
                                  )}
                                </span>

                                <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                                  {stage.source === "builtin" ? "Etapa base" : WORKFLOW_STAGE_TEMPLATE_LABELS[stage.template]}
                                </span>

                                <span className="mt-2 block text-sm leading-6 text-[var(--color-text-secondary)]">
                                  {stageDescription}
                                </span>
                              </span>

                              {isActiveStage && <Check size={16} className="mt-1 shrink-0 text-[var(--color-brand-deep)]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowMobileStagePicker(false);
                        setShowStageEditor(true);
                      }}
                      className="premium-button-secondary ios-touch-target mt-4 w-full rounded-[1.15rem] px-4 py-3 text-sm"
                    >
                      <span className="relative z-10">Personalizar ordem das etapas</span>
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showStageEditor && (
              <motion.div
                className="absolute inset-0 z-20 flex items-end justify-center bg-[rgba(17,17,17,0.22)] p-2 backdrop-blur-sm sm:items-center sm:p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowStageEditor(false)}
              >
                <motion.div
                  className="flex max-h-[calc(var(--app-dvh)-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-white/70 bg-[rgba(255,251,247,0.96)] shadow-[0_30px_90px_rgba(0,0,0,0.16)] sm:max-h-[calc(var(--app-dvh)-2rem)] sm:rounded-[32px]"
                  initial={{ opacity: 0, y: 18, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 18, scale: 0.98 }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-4 border-b border-black/5 bg-white/70 px-4 py-4 sm:px-6">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Editor do fluxo</p>
                      <h3 className="mt-2 text-xl font-semibold text-[var(--color-text)]">Personalizar etapas da paciente</h3>
                      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                        Reordene, oculte, renomeie e acrescente etapas extras sem mexer nas abas clínicas originais.
                      </p>
                      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                        Arraste pela alça lateral para reorganizar mais rápido ou use os botões quando estiver no celular.
                      </p>
                      <p className={`mt-2 text-xs ${workflowSyncToneClass}`}>{workflowSyncMessage}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowStageEditor(false)}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-brand-line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)]"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="app-scroll-area flex-1 overflow-y-auto p-5 sm:p-6">
                    <div className="space-y-4">
                      {workflowStages.map((stage, index) => (
                        <div
                          key={stage.id}
                          onDragOver={(event) => event.preventDefault()}
                          onDragEnter={() => {
                            if (draggedStageId && draggedStageId !== stage.id) {
                              setDragOverStageId(stage.id);
                            }
                          }}
                          onDrop={() => handleStageDrop(stage.id)}
                          className={`rounded-[28px] border bg-white/80 p-4 shadow-[0_14px_35px_rgba(94,58,28,0.06)] transition-all ${
                            dragOverStageId === stage.id && draggedStageId !== stage.id
                              ? "border-dashed border-[var(--color-brand-accent)] ring-2 ring-[rgba(122,73,33,0.14)]"
                              : "border-[var(--color-brand-line)]"
                          } ${draggedStageId === stage.id ? "opacity-70" : "opacity-100"}`}
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex items-start gap-3">
                              <div
                                draggable
                                onDragStart={(event) => {
                                  event.dataTransfer.effectAllowed = "move";
                                  event.dataTransfer.setData("text/plain", stage.id);
                                  setDraggedStageId(stage.id);
                                  setDragOverStageId(stage.id);
                                }}
                                onDragEnd={clearWorkflowStageDrag}
                                className="inline-flex h-11 w-11 shrink-0 cursor-grab items-center justify-center rounded-xl border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] text-[var(--color-brand-deep)] transition hover:bg-white active:cursor-grabbing"
                                aria-label={`Arrastar etapa ${stage.label}`}
                                title="Arrastar etapa"
                              >
                                <GripVertical size={16} />
                              </div>

                            <div className="flex-1 space-y-3">
                              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">
                                <span>{stage.source === "builtin" ? "Etapa base" : WORKFLOW_STAGE_TEMPLATE_LABELS[stage.template]}</span>
                                <span className="rounded-full bg-black/5 px-2 py-1 text-[#6e6e73]">
                                  {stage.visible ? "Visivel" : "Oculta"}
                                </span>
                              </div>

                              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                                Nome da etapa
                                <input
                                  className="input-light mt-2"
                                  value={stage.label}
                                  onChange={(event) => updateWorkflowStage(stage.id, (current) => ({ ...current, label: event.target.value }))}
                                  placeholder={stage.source === "builtin" ? "Etapa" : "Etapa extra"}
                                />
                              </label>

                              {stage.source === "custom" && (
                                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                                  Resumo da etapa
                                  <textarea
                                    className="input-light mt-2 min-h-24"
                                    value={stage.description || ""}
                                    onChange={(event) => updateWorkflowStage(stage.id, (current) => ({ ...current, description: event.target.value }))}
                                    placeholder={CUSTOM_STAGE_TEMPLATE_HELP[stage.template]}
                                  />
                                </label>
                              )}
                            </div>
                            </div>

                            <div className="flex flex-wrap gap-2 lg:w-[280px] lg:justify-end">
                              <button
                                type="button"
                                onClick={() => moveWorkflowStage(stage.id, -1)}
                                disabled={index === 0}
                                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-brand-line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Mover para tras
                              </button>
                              <button
                                type="button"
                                onClick={() => moveWorkflowStage(stage.id, 1)}
                                disabled={index === workflowStages.length - 1}
                                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-brand-line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Mover para frente
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleWorkflowStageVisibility(stage.id)}
                                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-3 py-2 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-white"
                              >
                                {stage.visible ? "Ocultar" : "Mostrar"}
                              </button>
                              {stage.source === "custom" && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCustomStage(stage.id)}
                                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                                >
                                  <Trash2 size={14} /> Excluir
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 rounded-[28px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.86)] p-5 shadow-[0_14px_35px_rgba(94,58,28,0.06)]">
                      <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Adicionar etapa extra</p>
                      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.5fr]">
                        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                          Nome da nova etapa
                          <input
                            className="input-light mt-2"
                            value={customStageDraft.label}
                            onChange={(event) => setCustomStageDraft((current) => ({ ...current, label: event.target.value }))}
                            placeholder="Ex.: Retorno pós-procedimento"
                          />
                        </label>
                        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                          Tipo da etapa
                          <select
                            className="input-light mt-2"
                            value={customStageDraft.template}
                            onChange={(event) =>
                              setCustomStageDraft((current) => ({
                                ...current,
                                template: event.target.value as WorkflowStageTemplate,
                              }))
                            }
                          >
                            {Object.entries(WORKFLOW_STAGE_TEMPLATE_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                        Resumo opcional
                        <textarea
                          className="input-light mt-2 min-h-24"
                          value={customStageDraft.description}
                          onChange={(event) => setCustomStageDraft((current) => ({ ...current, description: event.target.value }))}
                          placeholder={CUSTOM_STAGE_TEMPLATE_HELP[customStageDraft.template]}
                        />
                      </label>

                      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
                        <button
                          type="button"
                          onClick={handleResetWorkflow}
                          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-brand-line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)]"
                        >
                          Restaurar fluxo padrao
                        </button>
                        <button
                          type="button"
                          onClick={handleAddCustomStage}
                          disabled={!customStageDraft.label.trim()}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#7a4921] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#623915] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus size={15} /> Adicionar etapa
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
