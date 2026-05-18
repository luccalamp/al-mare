"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Save, Loader2, Trash2, Check } from "lucide-react";
import type { EvolutionPlanWeek, SessionStage } from "@/types";

interface EvolutionPlanModuleProps {
  initialTherapeuticPlan?: string;
  initialEvolutionWeeks?: readonly EvolutionPlanWeek[];
  onSave: (plan: string, weeks: EvolutionPlanWeek[]) => Promise<void>;
}

const STAGE_LABELS: { key: keyof SessionStage; label: string }[] = [
  { key: "higienizacao", label: "Higienização" },
  { key: "aplicacaoAtivos", label: "Aplicação de ativos" },
  { key: "massagemEstimulante", label: "Massagens estimulantes" },
  { key: "usoTecnologias", label: "Uso de tecnologias" },
];

function computeConstancia(weeks: EvolutionPlanWeek[]): { concluidas: number; total: number; percentual: number } {
  const total = weeks.length;
  const concluidas = weeks.filter((w) => {
    if (!w.stages) return false;
    return w.stages.higienizacao || w.stages.aplicacaoAtivos || w.stages.massagemEstimulante || w.stages.usoTecnologias;
  }).length;
  return { concluidas, total, percentual: total > 0 ? Math.round((concluidas / total) * 100) : 0 };
}

export default function EvolutionPlanModule({
  initialTherapeuticPlan = "",
  initialEvolutionWeeks = [],
  onSave,
}: EvolutionPlanModuleProps) {
  const [therapeuticPlan, setTherapeuticPlan] = useState(initialTherapeuticPlan);
  const [weeks, setWeeks] = useState<EvolutionPlanWeek[]>(() => {
    if (initialEvolutionWeeks && initialEvolutionWeeks.length > 0) {
      return initialEvolutionWeeks.map((w) => ({ ...w, stages: w.stages ?? { higienizacao: false, aplicacaoAtivos: false, massagemEstimulante: false, usoTecnologias: false } }));
    }
    return [
      { id: crypto.randomUUID(), weekLabel: "1ª Semana", notes: "", stages: { higienizacao: false, aplicacaoAtivos: false, massagemEstimulante: false, usoTecnologias: false } },
      { id: crypto.randomUUID(), weekLabel: "2ª Semana", notes: "", stages: { higienizacao: false, aplicacaoAtivos: false, massagemEstimulante: false, usoTecnologias: false } },
    ];
  });
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setTherapeuticPlan(initialTherapeuticPlan || "");
    if (initialEvolutionWeeks && initialEvolutionWeeks.length > 0) {
      setWeeks(initialEvolutionWeeks.map((w) => ({ ...w, stages: w.stages ?? { higienizacao: false, aplicacaoAtivos: false, massagemEstimulante: false, usoTecnologias: false } })));
    }
  }, [initialTherapeuticPlan, initialEvolutionWeeks]);

  const constancia = computeConstancia(weeks);
  const todasComAlgumaEtapa = weeks.length > 0 && weeks.every((w) => w.stages && (w.stages.higienizacao || w.stages.aplicacaoAtivos || w.stages.massagemEstimulante || w.stages.usoTecnologias));

  const addWeek = () => {
    setWeeks((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        weekLabel: `${prev.length + 1}ª Semana`,
        notes: "",
        stages: { higienizacao: false, aplicacaoAtivos: false, massagemEstimulante: false, usoTecnologias: false },
      },
    ]);
  };

  const updateWeekNotes = (id: string, notes: string) => {
    setWeeks((prev) => prev.map((w) => (w.id === id ? { ...w, notes } : w)));
  };

  const toggleStage = (weekId: string, stageKey: keyof SessionStage) => {
    setWeeks((prev) =>
      prev.map((w) =>
        w.id === weekId && w.stages
          ? { ...w, stages: { ...w.stages, [stageKey]: !w.stages[stageKey] } }
          : w
      )
    );
  };

  const removeWeek = (id: string) => {
    setWeeks((prev) => prev.filter((w) => w.id !== id).map((w, i) => ({ ...w, weekLabel: `${i + 1}ª Semana` })));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setFeedback(null);
      await onSave(therapeuticPlan, weeks);
      setFeedback("Plano de evolução salvo com sucesso.");
    } catch (err) {
      console.error(err);
      setFeedback("Erro ao salvar o plano.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 rounded-[32px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.8)] p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)] sm:p-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">
          Planejamento
        </p>
        <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)]">
          Módulo de Evolução Semanal e Plano Terapêutico
        </h3>
      </div>

      {/* Constância */}
      {weeks.length > 0 && (
        <div className="rounded-2xl border border-[var(--color-brand-line)] bg-white p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-brand-accent)]">
                Constância
              </span>
              <span className="text-xs text-[var(--color-text-secondary)]">
                {constancia.concluidas}/{constancia.total} semanas com sessão
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-32 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${constancia.percentual}%`,
                    background: todasComAlgumaEtapa
                      ? "linear-gradient(90deg, #5D7A63, #7A4921)"
                      : "linear-gradient(90deg, #D2A679, #A56D3A)",
                  }}
                />
              </div>
              <span className="text-[11px] font-bold text-[var(--color-text)]">{constancia.percentual}%</span>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]">
            {todasComAlgumaEtapa
              ? "Todas as semanas registram etapas — o tratamento está progredindo conforme planejado."
              : "O tratamento é progressivo e depende da frequência das sessões. Registre as etapas abaixo."}
          </p>
        </div>
      )}

      <div className="space-y-4">
        <label className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold text-[#6e6e73] uppercase tracking-wider">
            Plano Terapêutico
          </span>
          <textarea
            value={therapeuticPlan}
            onChange={(e) => setTherapeuticPlan(e.target.value)}
            placeholder="Descreva o planejamento das sessões, objetivos e observações gerais..."
            className="input-light min-h-[120px] resize-y"
          />
        </label>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-[var(--color-text)]">Acompanhamento Semanal</h4>
          <button
            type="button"
            onClick={addWeek}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-line)]"
          >
            <Plus size={14} /> Adicionar Semana
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {weeks.map((week) => (
            <div key={week.id} className="relative rounded-[20px] border border-[var(--color-brand-line)] bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-brand-accent)]">
                  {week.weekLabel}
                </span>
                {weeks.length > 1 && (
                  <button
                    onClick={() => removeWeek(week.id)}
                    className="text-red-400 hover:text-red-600"
                    title="Remover semana"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Etapas da sessão */}
              <div className="mb-3 grid grid-cols-2 gap-1.5">
                {STAGE_LABELS.map((stage) => {
                  const ativo = week.stages?.[stage.key] ?? false;
                  return (
                    <button
                      key={stage.key}
                      type="button"
                      onClick={() => toggleStage(week.id, stage.key)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition ${
                        ativo
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100"
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded flex items-center justify-center transition ${ativo ? "bg-emerald-500 text-white" : "bg-gray-200"}`}>
                        {ativo && <Check size={10} strokeWidth={3} />}
                      </span>
                      {stage.label}
                    </button>
                  );
                })}
              </div>

              <textarea
                value={week.notes}
                onChange={(e) => updateWeekNotes(week.id, e.target.value)}
                placeholder={`Observações da ${week.weekLabel.toLowerCase()}...`}
                className="input-light min-h-[80px] w-full text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-[var(--color-brand-line)]">
        <p className={`text-sm ${feedback?.includes("Erro") ? "text-rose-700" : "text-emerald-700"}`}>
          {feedback}
        </p>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#7a4921] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#623915] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {isSaving ? "Salvando..." : "Salvar Plano e Evolução"}
        </button>
      </div>
    </div>
  );
}
