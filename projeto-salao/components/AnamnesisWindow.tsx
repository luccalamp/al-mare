/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { AppointmentDraft, Client, FichaAnamneseCapilarDados, PortalLink, WindowTab, HOME_CARE_PRODUCTS, calcularPrecoComDesconto, calcularParcelas } from "@/types";
import PhotoEvolutionComparison from "@/components/PhotoEvolutionComparison";

const AnamneseCapilarTab = dynamic(() => import("@/components/AnamneseCapilarTab"), { ssr: false });
import ClientProfileTab from "@/components/ClientProfileTab";
import ClientEvolutionTab from "@/components/ClientEvolutionTab";
import ClientAgendaTab from "@/components/ClientAgendaTab";
import ClientPreConsultationTab from "@/components/ClientPreConsultationTab";
import ClientFinanceiroTab from "@/components/ClientFinanceiroTab";
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
} from "lucide-react";

interface AnamnesisWindowProps {
  client: Client;
  portalLink?: PortalLink;
  onClose: () => void;
  onUpdate: (client: Client, photoFiles?: { file: File; type: string }[]) => void;
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
  onAddHomecare: (
    clientId: string,
    input: {
      produtosRecomendados: string;
      obsCuidados?: string;
      dataRetornoSugerida?: string;
      valorTotal?: number;
      formaPagamento?: "avista" | "parcelado";
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
  onGeneratePreConsultationLink: (clientId: string) => Promise<string>;
  onDeactivatePreConsultationLink: (clientId: string) => Promise<void>;
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
    default:
      return <ClipboardList size={14} />;
  }
}

type GlassSelectOption<T extends string | number> = { value: T; label: string };

/** Seletor estilo Liquid Glass — lista em portal + fixed para não ser cortada por overflow dos modais. */
function GlassSelect<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: readonly GlassSelectOption<T>[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [panel, setPanel] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const updatePanelPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 10;
    const gap = 4;
    const maxList = 280;
    const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;
    /** Abre para cima se couber melhor em cima (evita lista cortada no fim da viewport). */
    const openUp = spaceBelow < 140 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(maxList, Math.max(80, openUp ? spaceAbove : spaceBelow));
    const top = openUp
      ? Math.max(margin, rect.top - gap - maxHeight)
      : rect.bottom + gap;
    setPanel({
      top,
      left: Math.max(margin, Math.min(rect.left, window.innerWidth - rect.width - margin)),
      width: rect.width,
      maxHeight,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanel(null);
      return;
    }
    updatePanelPosition();
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => updatePanelPosition();
    const onResize = () => updatePanelPosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("[data-glass-select-portal]")) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  const selected = options.find((o) => o.value === value) ?? options[0];

  const listPortal =
    open &&
    panel &&
    typeof document !== "undefined" &&
    createPortal(
      <ul
        ref={listRef}
        data-glass-select-portal
        role="listbox"
        style={{
          position: "fixed",
          top: panel.top,
          left: panel.left,
          width: panel.width,
          maxHeight: panel.maxHeight,
          zIndex: 2147483647,
          WebkitBackdropFilter: "blur(20px) saturate(1.5)",
          backdropFilter: "blur(20px) saturate(1.5)",
        }}
        className="overflow-y-auto overscroll-contain rounded-2xl border border-white/60 bg-white/40 p-1 shadow-[0_20px_60px_rgba(0,0,0,0.12)] ring-1 ring-white/30"
      >
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <li key={String(opt.value)} role="option" aria-selected={isActive}>
              <button
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#0071e3]/18 text-[#1d1d1f]"
                    : "text-[#3a3a3c] hover:bg-white/45"
                }`}
              >
                {opt.label}
              </button>
            </li>
          );
        })}
      </ul>,
      document.body
    );

  return (
    <div ref={rootRef} className="relative space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#6e6e73]">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => !disabled && setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-white/50 bg-white/40 px-3.5 py-2.5 text-left text-sm font-medium text-[#3a3a3c] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-md transition hover:bg-white/55 focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25 disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65), 0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <span className="truncate">{selected.label}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#86868b] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {listPortal}
    </div>
  );
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [porosidade, setPorosidade] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [elasticidade, setElasticidade] = useState<1 | 2 | 3>(1);
  const [historiaQuimicaPrevia, setHistoriaQuimicaPrevia] = useState("");
  const [resultadoTesteMecha, setResultadoTesteMecha] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [portalReady, setPortalReady] = useState(false);
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

  useEffect(() => {
    setPortalReady(true);
  }, []);

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
        setIsModalOpen(false);
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
            onClick={() => setIsModalOpen(true)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#7a4921] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#623915]"
          >
            + Novo diagnóstico
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

      {portalReady &&
        createPortal(
          <AnimatePresence>
            {isModalOpen && (
              <motion.div
                key="diagnostico-modal"
                className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-black/20 p-2 backdrop-blur-md sm:items-center sm:p-6"
                style={{ WebkitBackdropFilter: "blur(12px)", backdropFilter: "blur(12px)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  if (!isSubmitting) {
                    setIsModalOpen(false);
                    setFeedback(null);
                  }
                }}
              >
                <motion.form
                onSubmit={handleSubmit}
                className="w-full max-w-xl space-y-4 rounded-[28px] border border-white/60 bg-white/45 p-4 text-[#3a3a3c] shadow-2xl backdrop-blur-xl max-h-[calc(var(--app-dvh)-1rem)] overflow-y-auto sm:my-6 sm:rounded-3xl sm:p-6 sm:max-h-[min(90dvh,calc(var(--app-dvh)-2rem))]"
                style={{
                  WebkitBackdropFilter: "blur(24px) saturate(1.6)",
                  backdropFilter: "blur(24px) saturate(1.6)",
                  boxShadow: "0 30px 80px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.7)",
                }}
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                onClick={(e) => e.stopPropagation()}
              >
              <div className="flex items-center justify-between">
                <h4 className="text-base font-semibold text-[#1d1d1f]">Novo Diagnóstico Capilar</h4>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setFeedback(null);
                  }}
                  disabled={isSubmitting}
                  className="text-xs text-[#6e6e73] hover:text-[#1d1d1f] disabled:opacity-50"
                >
                  Fechar
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <GlassSelect<1 | 2 | 3 | 4 | 5>
                  label="Porosidade (1-5)"
                  value={porosidade}
                  onChange={setPorosidade}
                  disabled={isSubmitting}
                  options={[
                    { value: 1, label: "1 — muito baixa" },
                    { value: 2, label: "2 — baixa" },
                    { value: 3, label: "3 — média" },
                    { value: 4, label: "4 — alta" },
                    { value: 5, label: "5 — muito alta" },
                  ]}
                />
                <GlassSelect<1 | 2 | 3>
                  label="Elasticidade"
                  value={elasticidade}
                  onChange={setElasticidade}
                  disabled={isSubmitting}
                  options={[
                    { value: 1, label: "Saudável" },
                    { value: 2, label: "Sensibilizado" },
                    { value: 3, label: "Crítico" },
                  ]}
                />
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#6e6e73]">Histórico Químico</span>
                <textarea
                  value={historiaQuimicaPrevia}
                  onChange={(e) => setHistoriaQuimicaPrevia(e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-white/50 bg-white/40 px-3.5 py-2.5 text-sm text-[#3a3a3c] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-md outline-none placeholder:text-[#aeaeb2] focus:ring-2 focus:ring-[#0071e3]/25"
                  placeholder="Descreva os processos químicos anteriores..."
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#6e6e73]">Teste de Mecha</span>
                <textarea
                  value={resultadoTesteMecha}
                  onChange={(e) => setResultadoTesteMecha(e.target.value)}
                  rows={2}
                  required
                  className="w-full rounded-2xl border border-white/50 bg-white/40 px-3.5 py-2.5 text-sm text-[#3a3a3c] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-md outline-none placeholder:text-[#aeaeb2] focus:ring-2 focus:ring-[#0071e3]/25"
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
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#0071e3]/20 bg-[#0071e3]/10 px-4 py-3 text-sm font-semibold text-[#0071e3] transition-colors hover:bg-[#0071e3]/15 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:py-2"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  {isSubmitting ? "Salvando..." : "Salvar"}
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

// ---- ABA: PROCEDIMENTOS (historico_procedimentos) ----
function ColorimetyTab({
  client,
  onAddProcedimento,
}: {
  client: Client;
  onAddProcedimento: AnamnesisWindowProps["onAddProcedimento"];
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
  const [portalReady, setPortalReady] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [tecnica, setTecnica] = useState("");
  const [valorStr, setValorStr] = useState("");
  const [anotacoes, setAnotacoes] = useState("");
  const [altura, setAltura] = useState("");
  const [fundo, setFundo] = useState("");
  const [ox, setOx] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const reset = () => {
    setTecnica("");
    setValorStr("");
    setAnotacoes("");
    setAltura("");
    setFundo("");
    setOx("");
    setErr(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tecnica.trim()) {
      setErr("Informe o nome do procedimento.");
      return;
    }
    const valorNum = valorStr.trim() === "" ? null : Number(valorStr.replace(",", "."));
    if (valorStr.trim() !== "" && Number.isNaN(valorNum as number)) {
      setErr("Valor inválido.");
      return;
    }
    const alturaNum = altura.trim() === "" ? null : Number(altura);
    if (altura.trim() !== "" && (Number.isNaN(alturaNum as number) || alturaNum! < 1 || alturaNum! > 10)) {
      setErr("Altura de tom deve ser entre 1 e 10.");
      return;
    }
    try {
      setSaving(true);
      setErr(null);
      await onAddProcedimento(client.id, {
        tecnicaUtilizada: tecnica.trim(),
        valor: valorNum,
        anotacoes: anotacoes.trim() || undefined,
        alturaClareamento: alturaNum,
        fundoClareamentoObtido: fundo.trim() || undefined,
        volumagemOx: ox.trim() || undefined,
      });
      reset();
      setModalOpen(false);
    } catch {
      setErr("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
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
              Organize o histórico de procedimentos, deixe visíveis os detalhes de fundo, OX e altura de clareamento, e acompanhe o valor gerado por paciente sem abrir outra tela.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#7a4921] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#623915]"
          >
            + Novo procedimento
          </button>
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

                <div className="flex flex-wrap gap-2">
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

      {portalReady &&
        createPortal(
          <AnimatePresence>
            {modalOpen && (
              <motion.div
                key="procedimento-modal"
                className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-black/20 p-2 backdrop-blur-md sm:items-center sm:p-6"
                style={{ WebkitBackdropFilter: "blur(12px)", backdropFilter: "blur(12px)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  if (!saving) {
                    setModalOpen(false);
                    reset();
                  }
                }}
              >
                <motion.form
                  onSubmit={handleSubmit}
                  className="w-full max-w-lg space-y-4 rounded-[28px] border border-white/60 bg-white/45 p-4 text-[#3a3a3c] shadow-2xl backdrop-blur-xl max-h-[calc(var(--app-dvh)-1rem)] overflow-y-auto sm:my-6 sm:rounded-3xl sm:p-6 sm:max-h-[min(90dvh,calc(var(--app-dvh)-2rem))]"
                  style={{
                    WebkitBackdropFilter: "blur(24px) saturate(1.6)",
                    backdropFilter: "blur(24px) saturate(1.6)",
                    boxShadow: "0 30px 80px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.7)",
                  }}
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-base font-semibold text-[#1d1d1f]">Novo procedimento</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setModalOpen(false);
                        reset();
                      }}
                      disabled={saving}
                      className="text-xs text-[#6e6e73] hover:text-[#1d1d1f] disabled:opacity-50"
                    >
                      Fechar
                    </button>
                  </div>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#6e6e73]">Procedimento / técnica</span>
                    <input
                      value={tecnica}
                      onChange={(e) => setTecnica(e.target.value)}
                      className="w-full rounded-2xl border border-white/50 bg-white/40 px-3.5 py-2.5 text-sm text-[#1d1d1f] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-md outline-none placeholder:text-[#aeaeb2] focus:ring-2 focus:ring-[#0071e3]/25"
                      placeholder="Ex.: Mechas, tonalização, corte..."
                      required
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#6e6e73]">Valor (R$)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={valorStr}
                      onChange={(e) => setValorStr(e.target.value)}
                      className="w-full rounded-2xl border border-white/50 bg-white/40 px-3.5 py-2.5 text-sm tabular-nums text-[#1d1d1f] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-md outline-none placeholder:text-[#aeaeb2] focus:ring-2 focus:ring-[#0071e3]/25"
                      placeholder="0,00"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#6e6e73]">Anotações</span>
                    <textarea
                      value={anotacoes}
                      onChange={(e) => setAnotacoes(e.target.value)}
                      rows={3}
                      className="w-full rounded-2xl border border-white/50 bg-white/40 px-3.5 py-2.5 text-sm text-[#3a3a3c] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-md outline-none placeholder:text-[#aeaeb2] focus:ring-2 focus:ring-[#0071e3]/25"
                      placeholder="Observações, produtos, detalhes do atendimento..."
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block space-y-1.5 sm:col-span-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#6e6e73]">Alt. tom (1–10)</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={altura}
                        onChange={(e) => setAltura(e.target.value)}
                        className="w-full rounded-2xl border border-white/50 bg-white/40 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0071e3]/25"
                        placeholder="—"
                      />
                    </label>
                    <label className="block space-y-1.5 sm:col-span-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#6e6e73]">Fundo</span>
                      <input
                        value={fundo}
                        onChange={(e) => setFundo(e.target.value)}
                        className="w-full rounded-2xl border border-white/50 bg-white/40 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0071e3]/25"
                        placeholder="ex. 9.3"
                      />
                    </label>
                    <label className="block space-y-1.5 sm:col-span-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#6e6e73]">Vol. OX</span>
                      <input
                        value={ox}
                        onChange={(e) => setOx(e.target.value)}
                        className="w-full rounded-2xl border border-white/50 bg-white/40 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0071e3]/25"
                        placeholder="ex. 20 vol"
                      />
                    </label>
                  </div>

                  {err && <p className="text-xs font-medium text-red-600">{err}</p>}

                  <div className="flex pt-1">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#0071e3]/20 bg-[#0071e3]/10 px-4 py-3 text-sm font-semibold text-[#0071e3] transition-colors hover:bg-[#0071e3]/15 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:py-2"
                    >
                      {saving && <Loader2 size={14} className="animate-spin" />}
                      {saving ? "Salvando..." : "Salvar procedimento"}
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
  const [formaPagamento, setFormaPagamento] = useState<"avista" | "parcelado">("avista");
  const [parcelas, setParcelas] = useState(1);

  const toggleProduct = (name: string) => {
    setSelectedProducts((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  };

  const produtosSelecionados = HOME_CARE_PRODUCTS.filter((p) => selectedProducts.includes(p.name));
  const valorTotalHomecare = produtosSelecionados.reduce((s, p) => s + p.price, 0);
  const valorComDesconto = valorTotalHomecare > 0 ? calcularPrecoComDesconto(valorTotalHomecare, 10) : 0;
  const parcelasCalculadas = parcelas > 1 ? calcularParcelas(valorTotalHomecare, parcelas) : [];

  const selectedText = produtosSelecionados.map((p) => `${p.name} (R$ ${p.price.toFixed(2)})`).join(", ");

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
        valorTotal: valorTotalHomecare || undefined,
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
        <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)]">Produtos Profissionais</h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Selecione os produtos para incluir na prescrição. Parcelamento em até 4x ou 10% de desconto à vista.
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
                    R$ {product.price.toFixed(0)}
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
              <span className="font-semibold text-[var(--color-text)]">Total</span>
              <span className="font-black text-[var(--color-brand-deep)]">R$ {valorTotalHomecare.toFixed(2)}</span>
            </div>
            {formaPagamento === "avista" && valorTotalHomecare > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-600 font-semibold">À vista com 10% desconto</span>
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
            <div className="flex gap-2">
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
                {[2, 3, 4].map((n) => (
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
                      <span className="text-emerald-600 font-semibold">10% desconto à vista</span>
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
                        placeholder="Ex: Shampoo hidratante, Máscara reconstrutora..."
                        rows={3}
                        className="input-light min-h-24"
                      />
                      {selectedProducts.length > 0 && (
                        <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                          Itens do catálogo: {selectedText}
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
  antes: "Antes",
  depois: "Depois",
  referencia: "Referência",
};

// ---- ABA: GALERIA ----
function GalleryTab({
  client,
  onUpdate,
  onDeletePhoto,
}: {
  client: Client;
  onUpdate: (c: Client, files?: {file: File, type: string}[]) => void;
  onDeletePhoto: (clientId: string, photoId: string) => Promise<void>;
}) {
  const [activeFilter, setActiveFilter] = useState<"todos" | PhotoUploadCategory>("todos");
  const [captureType, setCaptureType] = useState<PhotoUploadCategory>("antes");
  const [galleryMessage, setGalleryMessage] = useState<string | null>(null);
  const [removingPhotoId, setRemovingPhotoId] = useState<string | null>(null);
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

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>, type: PhotoUploadCategory) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setGalleryMessage(null);
    onUpdate({ ...client, updatedAt: new Date().toISOString() }, files.map(file => ({ file, type })));
    e.target.value = "";
  };

  const handleCapture = async () => {
    setGalleryMessage(null);
    const file = await captureFrame(`captura-${captureType}-${Date.now()}.jpg`);
    if (!file) return;

    onUpdate(
      { ...client, updatedAt: new Date().toISOString() },
      [{ file, type: captureType }]
    );
  };

  const renderCategoryBadge = (type: string) => {
    return getPhotoCategoryLabel(type);
  };

  const renderPhotoTitle = (type: string) => {
    const label = getPhotoCategoryLabel(type).toLowerCase();
    return label === "referência" ? "Foto de referência" : `Foto ${label}`;
  };

  const handleRemovePhoto = async (photo: Client["gallery"][number]) => {
    const confirmed = window.confirm(`Arquivar ${renderPhotoTitle(photo.type).toLowerCase()} da galeria desta paciente e mover para quarentena privada?`);
    if (!confirmed) return;

    try {
      setGalleryMessage(null);
      setRemovingPhotoId(photo.id);
      await onDeletePhoto(client.id, photo.id);
    } catch (removeError) {
      console.error(removeError);
      setGalleryMessage(removeError instanceof Error ? removeError.message : "Nao foi possivel arquivar a foto agora.");
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
               <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Acervo clínico</p>
               <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)]">Fotos de perfil, couro cabeludo e referências</h3>
             </div>
             <div className="grid grid-cols-3 gap-2 text-center text-xs">
               <div className="rounded-2xl bg-[var(--color-brand-soft)] px-3 py-2 text-[var(--color-brand-deep)]">
                 <strong className="block text-base">{totals.antes}</strong>
                 Antes
               </div>
               <div className="rounded-2xl bg-[var(--color-brand-soft)] px-3 py-2 text-[var(--color-brand-deep)]">
                 <strong className="block text-base">{totals.depois}</strong>
                 Depois
               </div>
               <div className="rounded-2xl bg-[var(--color-brand-soft)] px-3 py-2 text-[var(--color-brand-deep)]">
                 <strong className="block text-base">{totals.referencia}</strong>
                 Referência
               </div>
             </div>
           </div>

           <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
             {(["antes", "depois", "referencia"] as PhotoUploadCategory[]).map((type) => (
               <label key={type} className="cursor-pointer rounded-2xl border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-deep)] transition-all hover:bg-white sm:text-left sm:py-2.5">
                 + {PHOTO_CATEGORY_LABELS[type]}
                 <input type="file" multiple className="hidden" onChange={(e) => handleUpload(e, type)} />
               </label>
             ))}
           </div>

           <div className="mt-4 flex flex-wrap gap-2">
             {([
               ["todos", "Tudo"],
               ["antes", "Antes"],
               ["depois", "Depois"],
               ["referencia", "Referência"],
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

           {galleryMessage && <p className="mt-4 text-sm text-rose-700">{galleryMessage}</p>}

           <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
             {filteredPhotos.length === 0 ? (
               <div className="col-span-full rounded-[24px] border border-dashed border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] p-6 text-sm text-[var(--color-text-secondary)]">
                 Nenhuma foto nesta categoria ainda.
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
                        src={photo.url}
                          alt={renderPhotoTitle(photo.type)}
                        fill
                        sizes="(min-width: 640px) 33vw, 50vw"
                        className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
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
               <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Use a câmera para registrar foto de perfil, couro cabeludo ou evolução sem sair da ficha.</p>
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
                     disabled={isBusy}
                     className="inline-flex min-h-12 items-center justify-center rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(249,115,22,0.4)] transition hover:bg-orange-600 hover:shadow-[0_0_25px_rgba(249,115,22,0.6)] disabled:cursor-not-allowed disabled:opacity-45"
                   >
                     Capturar
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
  onAddHomecare,
  onConfirmarPagamento,
  onAddAppointment,
  onLinkAppointmentToGoogle,
  onSaveFichaAnamnese,
  onDeletePhoto,
  onDeleteClient,
  onGeneratePreConsultationLink,
  onDeactivatePreConsultationLink,
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

    const cachedStages = readWorkflowStagesCache(null);
    setWorkflowStages(cachedStages);

    void (async () => {
      try {
        const remoteStages = await fetchWorkflowStagesFromSupabase(null);
        if (!active) return;

        if (remoteStages) {
          setWorkflowStages(remoteStages);
          writeWorkflowStagesCache(remoteStages, null);
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

    writeWorkflowStagesCache(workflowStages, null);
    setWorkflowSyncState("syncing");

    let active = true;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          await saveWorkflowStagesToSupabase(workflowStages, null);
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
                client={client}
                onUpdate={onUpdate}
              />
            )}
            {activeTab === "financeiro" && (
              <ClientFinanceiroTab client={client} />
            )}
            {activeTab === "agenda" && (
              <ClientAgendaTab
                client={client}
                onAddAppointment={onAddAppointment}
                onLinkAppointmentToGoogle={onLinkAppointmentToGoogle}
              />
            )}
            {activeTab === "pre-consulta" && (
              <ClientPreConsultationTab
                client={client}
                portalLink={portalLink}
                onGeneratePreConsultationLink={onGeneratePreConsultationLink}
                onDeactivatePreConsultationLink={onDeactivatePreConsultationLink}
              />
            )}
            {activeTab === "anamnese" && (
              <AnamneseCapilarTab client={client} onSave={(dados) => onSaveFichaAnamnese(client.id, dados)} />
            )}
            {activeTab === "diagnostico" && <DiagnosisTab client={client} onAddDiagnostico={onAddDiagnostico} />}
            {activeTab === "colorimetria" && (
              <ColorimetyTab client={client} onAddProcedimento={onAddProcedimento} />
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
                      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                        Seletor pensado para iPhone, com leitura clara da etapa atual e navegação mais precisa no polegar.
                      </p>
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
