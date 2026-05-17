"use client";

import { useState, useEffect } from "react";
import { Plus, Save, Loader2, Trash2 } from "lucide-react";
import { EvolutionPlanWeek } from "@/types";

interface EvolutionPlanModuleProps {
  initialTherapeuticPlan?: string;
  initialEvolutionWeeks?: readonly EvolutionPlanWeek[];
  onSave: (plan: string, weeks: EvolutionPlanWeek[]) => Promise<void>;
}

export default function EvolutionPlanModule({
  initialTherapeuticPlan = "",
  initialEvolutionWeeks = [],
  onSave,
}: EvolutionPlanModuleProps) {
  const [therapeuticPlan, setTherapeuticPlan] = useState(initialTherapeuticPlan);
  const [weeks, setWeeks] = useState<EvolutionPlanWeek[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setTherapeuticPlan(initialTherapeuticPlan || "");
    if (initialEvolutionWeeks && initialEvolutionWeeks.length > 0) {
      setWeeks([...initialEvolutionWeeks]);
    } else {
      setWeeks([
        { id: crypto.randomUUID(), weekLabel: "1ª Semana", notes: "" },
        { id: crypto.randomUUID(), weekLabel: "2ª Semana", notes: "" },
      ]);
    }
  }, [initialTherapeuticPlan, initialEvolutionWeeks]);

  const addWeek = () => {
    setWeeks((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        weekLabel: `${prev.length + 1}ª Semana`,
        notes: "",
      },
    ]);
  };

  const updateWeekNotes = (id: string, notes: string) => {
    setWeeks((prev) => prev.map((w) => (w.id === id ? { ...w, notes } : w)));
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
