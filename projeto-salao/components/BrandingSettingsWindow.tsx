"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Building2, FileText, Loader2 } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { useBrandingConfig } from "@/components/BrandingConfigProvider";
import { BrandingConfig, DEFAULT_BRANDING_CONFIG, mergeBrandingConfig } from "@/lib/brandingConfig";

interface BrandingSettingsWindowProps {
  onClose: () => void;
}

export default function BrandingSettingsWindow({ onClose }: BrandingSettingsWindowProps) {
  const { config, loading, saving, saveConfig } = useBrandingConfig();
  const [draft, setDraft] = useState<BrandingConfig>(config);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const isDirty = useMemo(
    () => JSON.stringify(mergeBrandingConfig(draft)) !== JSON.stringify(config),
    [config, draft]
  );

  const updateDraft = <K extends keyof BrandingConfig>(key: K, value: BrandingConfig[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setFeedback(null);
      await saveConfig(draft);
      setFeedbackTone("success");
      setFeedback("Personalização salva com sucesso.");
    } catch (error) {
      console.error(error);
      setFeedbackTone("error");
      setFeedback("Não foi possível salvar a personalização agora.");
    }
  };

  return (
    <motion.div
      className="premium-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="premium-window relative flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px]"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="premium-window-header flex items-center gap-3 px-4 py-4 sm:px-6">
          <button onClick={onClose} className="h-5 w-5 rounded-full bg-[#ff5f57] sm:h-3 sm:w-3" aria-label="Fechar janela" />
          <div className="flex flex-1 items-center justify-center gap-3">
            <Building2 size={16} className="text-[var(--color-brand-accent)]" />
            <BrandLogo compact />
          </div>
          <div className="w-8" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="rounded-[30px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.82)] p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Personalização</p>
                <h3 className="mt-1 text-xl font-semibold text-[var(--color-text)]">Marca e textos principais da plataforma</h3>
                <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-secondary)]">
                  Ajuste o nome da clínica, os atalhos principais e os textos que aparecem na home, em Arquivos, na pré-consulta e no prontuário impresso.
                </p>
              </div>

              <div className="rounded-[24px] border border-[var(--color-brand-line)] bg-white/75 px-5 py-4 text-center shadow-[0_12px_34px_rgba(94,58,28,0.06)]">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--color-brand-accent)]">Prévia da marca</p>
                <BrandLogo align="center" className="mt-3 items-center" />
              </div>
            </div>
          </div>

          {feedback && (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                feedbackTone === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {feedback}
            </div>
          )}

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-[30px] border border-[var(--color-brand-line)] bg-white/75 p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">
                <Building2 size={14} /> Marca principal
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)] md:col-span-2">
                  URL da Logo (Opcional)
                  <input className="input-light mt-2" placeholder="https://seu-site.com/logo.png" value={draft.logoUrl || ""} onChange={(event) => updateDraft("logoUrl", event.target.value)} />
                </label>

                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                  Nome da clínica
                  <input className="input-light mt-2" value={draft.clinicName} onChange={(event) => updateDraft("clinicName", event.target.value)} />
                </label>

                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                  Subtítulo da marca
                  <input className="input-light mt-2" value={draft.clinicSubtitle} onChange={(event) => updateDraft("clinicSubtitle", event.target.value)} />
                </label>

                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)] md:col-span-2">
                  Rótulo do prontuário
                  <input
                    className="input-light mt-2"
                    value={draft.clinicalRecordLabel}
                    onChange={(event) => updateDraft("clinicalRecordLabel", event.target.value)}
                  />
                </label>
              </div>
            </section>

            <section className="rounded-[30px] border border-[var(--color-brand-line)] bg-white/75 p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">
                <FileText size={14} /> HUD Visual & UI
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                  Cor Principal (Acentos)
                  <div className="mt-2 flex gap-2">
                    <input type="color" className="h-11 w-12 cursor-pointer rounded-xl border border-black/10 bg-white p-1" value={draft.themeColorPrimary || "#8c5a2d"} onChange={(event) => updateDraft("themeColorPrimary", event.target.value)} />
                    <input className="input-light flex-1" value={draft.themeColorPrimary || ""} placeholder="#8c5a2d" onChange={(event) => updateDraft("themeColorPrimary", event.target.value)} />
                  </div>
                </label>

                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                  Cor do Texto Base
                  <div className="mt-2 flex gap-2">
                    <input type="color" className="h-11 w-12 cursor-pointer rounded-xl border border-black/10 bg-white p-1" value={draft.themeColorText || "#4f2f19"} onChange={(event) => updateDraft("themeColorText", event.target.value)} />
                    <input className="input-light flex-1" value={draft.themeColorText || ""} placeholder="#4f2f19" onChange={(event) => updateDraft("themeColorText", event.target.value)} />
                  </div>
                </label>

                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                  Formato dos Botões e Inputs
                  <select className="input-light mt-2" value={draft.themeBorderRadius || "rounded"} onChange={(event) => updateDraft("themeBorderRadius", event.target.value as BrandingConfig["themeBorderRadius"])}>
                    <option value="rounded">Arredondado (Padrão)</option>
                    <option value="pill">Pílula (Oval)</option>
                    <option value="sharp">Reto (Afiado)</option>
                  </select>
                </label>

                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                  Opacidade do Vidro (Glassmorphism)
                  <div className="mt-2 flex items-center gap-3 bg-white/70 border border-black/10 rounded-xl px-3 h-11">
                    <input type="range" min="0" max="1" step="0.05" className="flex-1 accent-[var(--color-brand-accent)]" value={draft.themeGlassOpacity ?? 0.62} onChange={(event) => updateDraft("themeGlassOpacity", parseFloat(event.target.value))} />
                    <span className="w-8 text-center text-sm font-medium">{Math.round((draft.themeGlassOpacity ?? 0.62) * 100)}%</span>
                  </div>
                </label>

                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)] md:col-span-2">
                  Fundo Global (CSS)
                  <input className="input-light mt-2" value={draft.themeColorBackground || ""} placeholder="linear-gradient(...) ou #ffffff" onChange={(event) => updateDraft("themeColorBackground", event.target.value)} />
                  <span className="mt-1 block text-[10px] normal-case tracking-normal text-[var(--color-text-secondary)]">
                    Pode ser uma cor sólida (ex: #f4e6d3) ou um CSS genérico de background.
                  </span>
                </label>
              </div>
            </section>

            <section className="rounded-[30px] border border-[var(--color-brand-line)] bg-white/75 p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)] xl:col-span-2">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">
                <FileText size={14} /> Pré-consulta
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                  Título da pré-consulta
                  <input
                    className="input-light mt-2"
                    value={draft.preConsultationTitle}
                    onChange={(event) => updateDraft("preConsultationTitle", event.target.value)}
                  />
                </label>

                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                  Texto introdutório da pré-consulta
                  <textarea
                    className="input-light mt-2 min-h-[112px] resize-y"
                    value={draft.preConsultationIntro}
                    onChange={(event) => updateDraft("preConsultationIntro", event.target.value)}
                  />
                </label>
              </div>
            </section>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-black/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button
            type="button"
            onClick={() => setDraft({ ...DEFAULT_BRANDING_CONFIG })}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-brand-line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)]"
          >
            Usar textos padrão
          </button>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-brand-line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)]"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={loading || saving || !isDirty}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#7a4921] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#623915] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
              Salvar personalização
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}