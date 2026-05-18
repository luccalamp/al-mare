"use client";

import { motion } from "framer-motion";
import BrandLogo from "@/components/BrandLogo";
import {
  HELP_GUIDE_PRINCIPLES,
  HELP_GUIDE_SCENARIOS,
  HELP_GUIDE_SECTIONS,
} from "@/lib/helpGuide";
import {
  BookOpen,
  CircleHelp,
  ClipboardList,
  Compass,
  LayoutGrid,
  Route,
} from "lucide-react";

interface GuideWindowProps {
  onClose: () => void;
}

const SECTION_ICONS = {
  workspace: LayoutGrid,
  prontuario: ClipboardList,
  scenarios: Route,
} as const;

function scrollToSection(id: string) {
  const element = document.getElementById(id);
  element?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function GuideWindow({ onClose }: GuideWindowProps) {
  return (
    <motion.div
      className="fixed inset-0 z-50 bg-[rgba(34,24,16,0.34)] px-3 py-3 backdrop-blur-md sm:px-6 sm:py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 22, scale: 0.98 }}
        transition={{ type: "spring", duration: 0.42, bounce: 0.12 }}
        className="premium-panel mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-[2.25rem]"
      >
        <div className="premium-window-header flex items-center gap-3 px-4 py-4 sm:px-6">
          <button onClick={onClose} className="h-5 w-5 rounded-full bg-[#ff5f57] sm:h-3 sm:w-3" aria-label="Fechar guia" />
          <div className="flex flex-1 items-center justify-center gap-3">
            <CircleHelp size={16} className="text-[var(--color-brand-accent)]" />
            <BrandLogo compact />
          </div>
          <div className="w-8" />
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden min-h-0 border-r border-black/5 bg-[rgba(255,252,248,0.7)] lg:flex lg:flex-col lg:overflow-y-auto lg:p-5">
            <div className="rounded-[1.8rem] border border-[var(--color-brand-line)] bg-white/75 p-5 shadow-[0_18px_42px_rgba(62,44,28,0.08)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Central de ajuda</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--color-text)]">Guia de uso da plataforma</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                Use este manual quando surgir dúvida sobre a função de uma área, o momento ideal de usar cada módulo ou a ordem mais segura do fluxo clínico.
              </p>
            </div>

            <div className="mt-5 rounded-[1.6rem] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.86)] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Navegação</p>
              <div className="mt-3 space-y-2">
                {HELP_GUIDE_SECTIONS.map((section) => {
                  const Icon = SECTION_ICONS[section.id as keyof typeof SECTION_ICONS] ?? BookOpen;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => scrollToSection(section.id)}
                      className="flex w-full items-center gap-3 rounded-[1.1rem] border border-transparent bg-white/70 px-3 py-3 text-left text-sm font-semibold text-[var(--color-brand-deep)] transition hover:border-[var(--color-brand-line)] hover:bg-white"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(122,73,33,0.08)] text-[var(--color-brand-accent)]">
                        <Icon size={16} />
                      </span>
                      {section.title}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => scrollToSection("scenarios")}
                  className="flex w-full items-center gap-3 rounded-[1.1rem] border border-transparent bg-white/70 px-3 py-3 text-left text-sm font-semibold text-[var(--color-brand-deep)] transition hover:border-[var(--color-brand-line)] hover:bg-white"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(93,122,99,0.10)] text-[var(--color-sage)]">
                    <Route size={16} />
                  </span>
                  Casos de uso
                </button>
              </div>
            </div>
          </aside>

          <div className="min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <section className="rounded-[2rem] border border-[var(--color-brand-line)] bg-[linear-gradient(135deg,rgba(255,248,241,0.95),rgba(247,239,229,0.9))] p-5 shadow-[0_22px_56px_rgba(62,44,28,0.1)] sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Leitura rápida</p>
                  <h1 className="mt-3 text-3xl font-semibold text-[var(--color-text)] sm:text-[2.5rem]">Para que serve cada área e quando usar</h1>
                  <p className="mt-4 text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                    O sistema foi pensado para acompanhar a jornada completa da paciente: entrada, avaliação, procedimento, retorno e pós-venda. A ajuda abaixo explica a função real de cada módulo e traz exemplos práticos para a equipe que ainda está se ambientando.
                  </p>
                </div>

                <div className="rounded-[1.6rem] border border-[var(--color-brand-line)] bg-white/75 px-5 py-4 text-sm text-[var(--color-text-secondary)] shadow-[0_12px_32px_rgba(62,44,28,0.08)] lg:max-w-xs">
                  <div className="flex items-center gap-2 text-[var(--color-brand-accent)]">
                    <Compass size={15} />
                    <strong className="text-[11px] uppercase tracking-[0.24em]">Como usar este guia</strong>
                  </div>
                  <p className="mt-3 leading-6">
                    Abra esta janela pelo ícone de interrogação no topo sempre que surgir dúvida operacional, principalmente durante treinamento ou padronização de rotina.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {HELP_GUIDE_PRINCIPLES.map((principle) => (
                  <div key={principle.title} className="rounded-[1.5rem] border border-white/70 bg-white/72 p-4 shadow-[0_12px_28px_rgba(62,44,28,0.06)]">
                    <p className="text-sm font-semibold text-[var(--color-text)]">{principle.title}</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{principle.description}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-6 space-y-6">
              {HELP_GUIDE_SECTIONS.map((section) => {
                const Icon = SECTION_ICONS[section.id as keyof typeof SECTION_ICONS] ?? BookOpen;
                return (
                  <section id={section.id} key={section.id} className="scroll-mt-24 rounded-[2rem] border border-[var(--color-brand-line)] bg-white/80 p-5 shadow-[0_18px_46px_rgba(62,44,28,0.08)] sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-3xl">
                        <div className="flex items-center gap-3">
                          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(122,73,33,0.08)] text-[var(--color-brand-accent)]">
                            <Icon size={18} />
                          </span>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">{section.kicker}</p>
                            <h2 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">{section.title}</h2>
                          </div>
                        </div>
                        <p className="mt-4 text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">{section.description}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => scrollToSection("scenarios")}
                        className="inline-flex items-center justify-center rounded-full border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-deep)] transition hover:bg-white"
                      >
                        Ver casos de uso
                      </button>
                    </div>

                    <div className="mt-6 grid gap-4 xl:grid-cols-2">
                      {section.items.map((item) => (
                        <article key={item.id} className="rounded-[1.6rem] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.76)] p-4 shadow-[0_12px_28px_rgba(62,44,28,0.05)]">
                          <h3 className="text-lg font-semibold text-[var(--color-text)]">{item.title}</h3>
                          <div className="mt-3 space-y-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                            <p>
                              <strong className="text-[var(--color-text)]">Para que serve:</strong> {item.purpose}
                            </p>
                            <p>
                              <strong className="text-[var(--color-text)]">Quando usar:</strong> {item.whenToUse}
                            </p>
                            <p>
                              <strong className="text-[var(--color-text)]">Caso de uso:</strong> {item.example}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}

              <section id="scenarios" className="scroll-mt-24 rounded-[2rem] border border-[var(--color-brand-line)] bg-[linear-gradient(180deg,rgba(255,251,247,0.96),rgba(247,239,229,0.92))] p-5 shadow-[0_18px_48px_rgba(62,44,28,0.08)] sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(93,122,99,0.10)] text-[var(--color-sage)]">
                    <Route size={18} />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Aplicação prática</p>
                    <h2 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Casos de uso recomendados</h2>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-3">
                  {HELP_GUIDE_SCENARIOS.map((scenario) => (
                    <article key={scenario.id} className="rounded-[1.6rem] border border-[var(--color-brand-line)] bg-white/76 p-4 shadow-[0_12px_28px_rgba(62,44,28,0.05)]">
                      <h3 className="text-lg font-semibold text-[var(--color-text)]">{scenario.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{scenario.summary}</p>
                      <div className="mt-4 space-y-2">
                        {scenario.steps.map((step, index) => (
                          <div key={step} className="flex items-start gap-3 rounded-[1rem] bg-[rgba(255,248,241,0.82)] px-3 py-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[11px] font-bold text-[var(--color-brand-deep)]">
                              {index + 1}
                            </span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}