"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Save, Loader2, Trash2, Check, Sparkles } from "lucide-react";
import type { EvolutionPlanWeek, SessionStage } from "@/types";

interface EvolutionPlanModuleProps {
  initialTherapeuticPlan?: string;
  initialEvolutionWeeks?: readonly EvolutionPlanWeek[];
  onSave: (plan: string, weeks: EvolutionPlanWeek[]) => Promise<void>;
}

const STAGE_LABELS: { key: keyof SessionStage; label: string; icon: string }[] = [
  { key: "higienizacao", label: "Higienização", icon: "💧" },
  { key: "aplicacaoAtivos", label: "Aplicação de ativos", icon: "✨" },
  { key: "massagemEstimulante", label: "Massagens estimulantes", icon: "🤲" },
  { key: "usoTecnologias", label: "Uso de tecnologias", icon: "⚡" },
];

function computeConstancia(weeks: EvolutionPlanWeek[]): { concluidas: number; total: number; percentual: number } {
  const total = weeks.length;
  const concluidas = weeks.filter((w) => {
    if (!w.stages) return false;
    return w.stages.higienizacao || w.stages.aplicacaoAtivos || w.stages.massagemEstimulante || w.stages.usoTecnologias;
  }).length;
  return { concluidas, total, percentual: total > 0 ? Math.round((concluidas / total) * 100) : 0 };
}

function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  className = "",
  minHeight = 80,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = `${minHeight}px`;
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = `${scrollHeight}px`;
  }, [minHeight]);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  return (
    <div className={`relative group ${className}`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          autoResize();
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[var(--color-brand-line)] bg-white/70 px-4 py-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] resize-none transition-all duration-300 focus:border-[var(--color-brand-accent)] focus:ring-2 focus:ring-[var(--color-brand-accent)]/20 focus:outline-none"
        style={{ minHeight: `${minHeight}px` }}
      />
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[var(--color-brand-accent)] to-[#D2A679] rounded-b-xl"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: isFocused ? 1 : 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      />
    </div>
  );
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
  const [justAddedWeekId, setJustAddedWeekId] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const newWeekRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setTherapeuticPlan(initialTherapeuticPlan || "");
    if (initialEvolutionWeeks && initialEvolutionWeeks.length > 0) {
      setWeeks(initialEvolutionWeeks.map((w) => ({ ...w, stages: w.stages ?? { higienizacao: false, aplicacaoAtivos: false, massagemEstimulante: false, usoTecnologias: false } })));
    }
  }, [initialTherapeuticPlan, initialEvolutionWeeks]);

  useEffect(() => {
    if (justAddedWeekId && newWeekRef.current) {
      newWeekRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      const timer = setTimeout(() => setJustAddedWeekId(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [justAddedWeekId]);

  const constancia = computeConstancia(weeks);
  const todasComAlgumaEtapa = weeks.length > 0 && weeks.every((w) => w.stages && (w.stages.higienizacao || w.stages.aplicacaoAtivos || w.stages.massagemEstimulante || w.stages.usoTecnologias));

  const progressGradient = constancia.percentual === 0
    ? "linear-gradient(90deg, #E5E7EB, #D1D5DB)"
    : constancia.percentual < 50
    ? "linear-gradient(90deg, #D2A679, #C4956A)"
    : constancia.percentual < 100
    ? "linear-gradient(90deg, #C4956A, #A56D3A)"
    : "linear-gradient(90deg, #5D7A63, #7A4921)";

  const addWeek = () => {
    const newId = crypto.randomUUID();
    setWeeks((prev) => [
      ...prev,
      {
        id: newId,
        weekLabel: `${prev.length + 1}ª Semana`,
        notes: "",
        stages: { higienizacao: false, aplicacaoAtivos: false, massagemEstimulante: false, usoTecnologias: false },
      },
    ]);
    setJustAddedWeekId(newId);
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
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[var(--color-brand-accent)] to-[#D2A679] flex items-center justify-center shadow-lg">
          <Sparkles size={20} className="text-white" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">
            Planejamento
          </p>
          <h3 className="text-lg font-semibold text-[var(--color-text)]">
            Módulo de Evolução Semanal
          </h3>
        </div>
      </motion.div>

      {/* Constância Progress Bar */}
      <AnimatePresence>
        {weeks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl border border-[var(--color-brand-line)] bg-white/80 p-4 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-brand-accent)]">
                  Constância
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {constancia.concluidas}/{constancia.total} semanas ativas
                </span>
              </div>
              <motion.span
                key={constancia.percentual}
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-sm font-black text-[var(--color-brand-accent)]"
              >
                {constancia.percentual}%
              </motion.span>
            </div>

            <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${constancia.percentual}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                style={{ background: progressGradient }}
              />
            </div>

            <motion.p
              className="mt-2 text-[11px] text-[var(--color-text-secondary)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {todasComAlgumaEtapa
                ? "Todas as semanas registram etapas — o tratamento está progredindo conforme planejado."
                : "O tratamento é progressivo e depende da frequência das sessões. Registre as etapas abaixo."}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plano Terapêutico */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="space-y-2"
      >
        <label className="text-[10px] font-semibold text-[#6e6e73] uppercase tracking-wider">
          Plano Terapêutico
        </label>
        <AutoResizeTextarea
          value={therapeuticPlan}
          onChange={setTherapeuticPlan}
          placeholder="Descreva o planejamento das sessões, objetivos e observações gerais..."
          minHeight={120}
        />
      </motion.div>

      {/* Acompanhamento Semanal Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      >
        <h4 className="text-sm font-semibold text-[var(--color-text)]">Acompanhamento Semanal</h4>
        <motion.button
          type="button"
          onClick={addWeek}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--color-brand-soft)] to-white border border-[var(--color-brand-line)] px-4 py-2.5 text-xs font-semibold text-[var(--color-brand-deep)] shadow-sm transition hover:shadow-md"
        >
          <Plus size={14} /> Adicionar Semana
        </motion.button>
      </motion.div>

      {/* Weeks Grid */}
      <motion.div
        className="grid gap-4 sm:grid-cols-1 md:grid-cols-2"
        layout
      >
        <AnimatePresence mode="popLayout">
          {weeks.map((week, index) => {
            const isNew = week.id === justAddedWeekId;
            const completedStages = week.stages
              ? Object.values(week.stages).filter(Boolean).length
              : 0;
            const totalStages = STAGE_LABELS.length;
            const isFullyComplete = completedStages === totalStages;

            return (
              <motion.div
                key={week.id}
                ref={isNew ? newWeekRef : null}
                layout
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                  delay: isNew ? 0 : index * 0.05,
                }}
                className={`relative rounded-2xl border p-4 transition-all duration-300 ${
                  isNew
                    ? "border-[var(--color-brand-accent)] ring-2 ring-[var(--color-brand-accent)]/30 shadow-lg"
                    : isFullyComplete
                    ? "border-emerald-200 bg-emerald-50/50 shadow-sm"
                    : "border-[var(--color-brand-line)] bg-white/80 shadow-sm hover:shadow-md"
                }`}
              >
                {/* Week Header */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <motion.div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                        isFullyComplete
                          ? "bg-emerald-500 text-white"
                          : completedStages > 0
                          ? "bg-[var(--color-brand-accent)] text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                      animate={isFullyComplete ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 0.4 }}
                    >
                      {isFullyComplete ? <Check size={14} /> : index + 1}
                    </motion.div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-brand-accent)]">
                      {week.weekLabel}
                    </span>
                  </div>
                  {weeks.length > 1 && (
                    <motion.button
                      onClick={() => removeWeek(week.id)}
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      className="text-red-400 hover:text-red-600 transition-colors"
                      title="Remover semana"
                    >
                      <Trash2 size={14} />
                    </motion.button>
                  )}
                </div>

                {/* Stage Pills */}
                <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STAGE_LABELS.map((stage) => {
                    const ativo = week.stages?.[stage.key] ?? false;
                    return (
                      <motion.button
                        key={stage.key}
                        type="button"
                        onClick={() => toggleStage(week.id, stage.key)}
                        whileHover={{ y: -2, scale: 1.02 }}
                        whileTap={{ scale: 0.95 }}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[11px] font-semibold transition-all duration-200 ${
                          ativo
                            ? "border-emerald-300 bg-gradient-to-r from-emerald-50 to-emerald-100/80 text-emerald-700 shadow-sm"
                            : "border-gray-200 bg-gray-50/80 text-gray-500 hover:bg-gray-100 hover:border-gray-300"
                        }`}
                      >
                        <motion.span
                          className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all duration-200 ${
                            ativo ? "bg-emerald-500 text-white shadow-sm" : "bg-gray-200"
                          }`}
                          animate={ativo ? { scale: [0.8, 1.1, 1] } : {}}
                          transition={{ duration: 0.3 }}
                        >
                          {ativo && <Check size={12} strokeWidth={3} />}
                        </motion.span>
                        <span className={ativo ? "line-through opacity-80" : ""}>
                          {stage.label}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Week Notes */}
                <AutoResizeTextarea
                  value={week.notes}
                  onChange={(value) => updateWeekNotes(week.id, value)}
                  placeholder={`Observações da ${week.weekLabel.toLowerCase()}...`}
                  minHeight={70}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* Save Button & Feedback */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-[var(--color-brand-line)]"
      >
        <AnimatePresence>
          {feedback && (
            <motion.p
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className={`text-sm font-medium ${feedback.includes("Erro") ? "text-rose-700" : "text-emerald-700"}`}
            >
              {feedback}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7a4921] to-[#8c5a2d] px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {isSaving ? "Salvando..." : "Salvar Plano e Evolução"}
        </motion.button>
      </motion.div>
    </div>
  );
}
