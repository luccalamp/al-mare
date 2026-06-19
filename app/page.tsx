"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Sparkles,
  FolderOpen,
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Settings,
  BookOpen,
  CalendarDays,
  ClipboardList,
  CircleDollarSign,
  ArrowRight,
  Clock3,
} from "lucide-react";
import { useBrandingConfig } from "@/components/BrandingConfigProvider";
import { useClients, SyncStatus } from "@/hooks/useClients";
import type { WindowTab } from "@/types";
import AppIcon from "@/components/AppIcon";
import GenericFolderIcon from "@/components/GenericFolderIcon";
import BrandLogo from "@/components/BrandLogo";
import { getBrandDisplayTitle } from "@/lib/brandingConfig";
import { buildHomeDashboardSnapshot, type HomeCardAccent, type HomeActionTone } from "@/lib/homeDashboard";
import { AnimatePresence, motion } from "framer-motion";

const DashboardWindow = dynamic(() => import("@/components/DashboardWindow"), { ssr: false });
const DocumentsWindow = dynamic(() => import("@/components/DocumentsWindow"), { ssr: false });
const BrandingSettingsWindow = dynamic(() => import("@/components/BrandingSettingsWindow"), { ssr: false });
const GuideWindow = dynamic(() => import("@/components/GuideWindow"), { ssr: false });

type PageFeedback = {
  tone: "error" | "success";
  message: string;
};

function getAccentClasses(accent: HomeCardAccent) {
  if (accent === "warning") {
    return {
      badge: "bg-amber-100 text-amber-800",
      card: "border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,252,245,0.94),rgba(255,245,224,0.74))]",
    };
  }

  if (accent === "success") {
    return {
      badge: "bg-emerald-100 text-emerald-800",
      card: "border-emerald-200/70 bg-[linear-gradient(180deg,rgba(247,255,250,0.94),rgba(232,247,239,0.76))]",
    };
  }

  return {
    badge: "bg-white/80 text-[var(--color-brand-deep)]",
    card: "border-white/70 bg-white/70",
  };
}

function getAttentionToneClasses(tone: HomeActionTone) {
  if (tone === "warning") {
    return "border-amber-200/70 bg-amber-50/80 text-amber-900";
  }

  if (tone === "accent") {
    return "border-[var(--color-brand-line)] bg-[rgba(122,73,33,0.08)] text-[var(--color-brand-deep)]";
  }

  if (tone === "success") {
    return "border-emerald-200/70 bg-emerald-50/80 text-emerald-900";
  }

  return "border-white/70 bg-white/70 text-[var(--color-ink)]";
}

export default function HomePage() {
  const router = useRouter();
  const { config: branding } = useBrandingConfig();
  const baseTitle = getBrandDisplayTitle(branding);
  const {
    clients,
    syncStatus,
    lastSyncedAt,
    refreshClients,
  } = useClients();
  const [showDashboard, setShowDashboard] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showBrandingSettings, setShowBrandingSettings] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pageFeedback, setPageFeedback] = useState<PageFeedback | null>(null);

  const dashboardSnapshot = useMemo(() => buildHomeDashboardSnapshot(clients), [clients]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowDashboard(false);
        setShowDocuments(false);
        setShowBrandingSettings(false);
        setShowGuide(false);
        setPageFeedback(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const hasOverlay = Boolean(showDashboard || showDocuments || showBrandingSettings || showGuide);

    if (hasOverlay) {
      document.body.dataset.overlayOpen = "true";
    } else {
      delete document.body.dataset.overlayOpen;
    }

    return () => {
      delete document.body.dataset.overlayOpen;
    };
  }, [showDashboard, showDocuments, showBrandingSettings, showGuide]);

  useEffect(() => {
    const sections: string[] = [];
    if (showDashboard) sections.push(branding.dashboardLabel);
    if (showDocuments) sections.push(branding.documentsTitle);
    if (showBrandingSettings) sections.push("Personalizacao");
    if (showGuide) sections.push("Guia de uso");
    sections.push(baseTitle);
    document.title = sections.join(" | ");
  }, [baseTitle, branding.dashboardLabel, branding.documentsTitle, showDashboard, showDocuments, showBrandingSettings, showGuide]);

  const handleOpenDocuments = () => {
    setSelectedId("documents");
    setShowDocuments(true);
  };

  const handleOpenBrandingSettings = () => {
    setSelectedId(null);
    setShowBrandingSettings(true);
  };

  const handleOpenGuide = () => {
    setSelectedId(null);
    setShowGuide(true);
  };

  const handleOpenPatientsFolder = () => {
    router.push("/pacientes");
  };

  const handleOpenPatientFromHome = (clientId: string, tab: WindowTab) => {
    const params = new URLSearchParams({ clientId, tab });
    router.push(`/pacientes?${params.toString()}`);
  };

  const formattedLastSyncedAt =
    lastSyncedAt ? new Date(lastSyncedAt).toLocaleString("pt-BR") : null;
  const syncLabelMap: Record<SyncStatus, string> = {
    idle: "Online",
    syncing: "Sincronizando",
    synced: formattedLastSyncedAt ? `Sincronizado ${formattedLastSyncedAt}` : "Online",
    error: "Offline",
  };
  const snapshotStatusLabel = syncLabelMap[syncStatus];

  const handleManualSync = async () => {
    if (syncStatus === "syncing") return;
    await refreshClients();
  };

  const hasOverlayOpen = Boolean(showDashboard || showDocuments || showBrandingSettings || showGuide);

  return (
    <div className="relative min-h-[var(--app-dvh)] pb-4">
      <header className="app-sticky-header px-3 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4">
        <div
          className="mx-auto flex h-16 max-w-7xl items-center rounded-b-2xl border border-white/70 px-5 shadow-[0_18px_48px_rgba(32,54,43,0.08)]"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.78)", backdropFilter: "blur(18px)" }}
        >
          <div className="flex items-center gap-3">
            <BrandLogo compact subtitle={false} priority />
            <div className="hidden items-start gap-1 sm:flex sm:flex-col">
              <span
                className="text-[1.12rem] font-semibold leading-none tracking-[0.22em] text-[var(--color-brand-deep)] uppercase"
                style={{ fontFamily: "var(--font-brand), serif" }}
              >
                Al&apos;mare
              </span>
              <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.48em] text-[var(--color-brand-accent)]">
                <span className="h-px w-6 bg-[rgba(122,73,33,0.45)]" />
                Saude Capilar
              </span>
            </div>
          </div>
        </div>
      </header>

      <main
        className="relative px-3 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-4 sm:px-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:pt-5"
        onClick={() => setSelectedId(null)}
      >
        <div className="workspace-shell space-y-4">
          <section className="premium-panel hidden rounded-[2.1rem] p-6 sm:block xl:p-7">
            <div className="workspace-hero-grid items-start">
              <div className="space-y-5">
                <div>
                  <p className="premium-kicker">
                    <Sparkles size={14} />
                    Operacao
                  </p>
                  <h1 className="premium-heading mt-4 max-w-4xl text-5xl lg:text-6xl xl:text-7xl">
                    {baseTitle}
                  </h1>
                  <p className="mt-4 max-w-3xl text-base leading-relaxed text-[var(--color-text-secondary)]">
                    {dashboardSnapshot.heroDescription}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {dashboardSnapshot.stats.map((item) => (
                    <div
                      key={item.label}
                      className={`workspace-metric-card rounded-[2rem] border p-4 ${getAccentClasses(item.accent).card}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--color-brand-accent)]">{item.label}</p>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getAccentClasses(item.accent).badge}`}>
                          {item.badge}
                        </span>
                      </div>
                      <strong className="mt-3 block text-[2rem] font-semibold leading-none text-[var(--color-ink)]">{item.value}</strong>
                      <p className="mt-3 text-sm font-medium text-[var(--color-ink)]">{item.description}</p>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">{item.supporting}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleOpenPatientsFolder}
                    className="premium-button-primary inline-flex items-center gap-2 px-5 py-3 text-sm"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <FolderOpen size={16} />
                      Pacientes
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDashboard(true)}
                    className="premium-button-secondary inline-flex items-center gap-2 px-5 py-3 text-sm"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <Activity size={16} />
                      Financeiro
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenDocuments}
                    className="premium-button-secondary inline-flex items-center gap-2 px-5 py-3 text-sm"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <FolderOpen size={16} />
                      Arquivos internos
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenBrandingSettings}
                    className="premium-button-secondary inline-flex items-center gap-2 px-5 py-3 text-sm"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <Settings size={16} />
                      Personalizar
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenGuide}
                    className="premium-button-secondary inline-flex items-center gap-2 px-5 py-3 text-sm"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <BookOpen size={16} />
                      Guia
                    </span>
                  </button>
                </div>
              </div>

              <div className="workspace-aside-card p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--color-brand-accent)]">Painel de acao</p>
                  <div className="flex items-center gap-2">
                    <span className={`premium-chip px-3 py-2 text-[11px] ${syncStatus === "error" ? "" : "is-active"}`}>
                      {snapshotStatusLabel}
                    </span>
                    <button
                      type="button"
                      onClick={handleManualSync}
                      disabled={syncStatus === "syncing"}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-brand-line)] bg-white/80 text-[var(--color-brand-deep)] shadow-[0_10px_24px_rgba(32,54,43,0.08)] transition hover:bg-white disabled:opacity-50"
                      title="Sincronizar agora"
                    >
                      <RefreshCw size={15} className={syncStatus === "syncing" ? "animate-spin" : ""} />
                    </button>
                  </div>
                </div>

                <div className="mt-4 rounded-[1.8rem] border border-white/70 bg-white/70 p-4 shadow-[0_16px_32px_rgba(32,54,43,0.08)]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Leitura do momento</p>
                  <h2 className="mt-2 text-[1.35rem] font-semibold leading-tight text-[var(--color-ink)]">
                    {dashboardSnapshot.heroHeadline}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                    {dashboardSnapshot.heroDescription}
                  </p>
                </div>

                <div className="mt-4 rounded-[1.8rem] border border-white/70 bg-white/72 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Hoje na clinica</p>
                    <CalendarDays size={14} className="text-[var(--color-brand-accent)]" />
                  </div>

                  {dashboardSnapshot.todayAgenda.length > 0 ? (
                    <div className="mt-3 space-y-3">
                      {dashboardSnapshot.todayAgenda.map((appointment) => (
                        <button
                          key={appointment.id}
                          type="button"
                          onClick={() => handleOpenPatientFromHome(appointment.clientId, appointment.tab)}
                          className="flex w-full items-start justify-between gap-3 rounded-[1.3rem] border border-white/70 bg-white/80 px-3 py-3 text-left transition hover:border-[var(--color-brand-line)] hover:bg-white"
                        >
                          <div>
                            <strong className="text-sm font-semibold text-[var(--color-ink)]">{appointment.clientName}</strong>
                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{appointment.startsLabel}</p>
                          </div>
                          <span className="rounded-full bg-[rgba(122,73,33,0.08)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                            {appointment.statusLabel}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                      Nenhum atendimento marcado para hoje. Bom momento para revisar fichas, cobrar homecare ou abrir novas triagens.
                    </p>
                  )}
                </div>

                <div className="mt-4 rounded-[1.8rem] border border-white/70 bg-white/72 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">O que fazer agora</p>
                    {dashboardSnapshot.attentionItems.length > 0 && (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                        {dashboardSnapshot.attentionItems.length} em foco
                      </span>
                    )}
                  </div>

                  {dashboardSnapshot.attentionItems.length > 0 ? (
                    <div className="mt-3 space-y-3">
                      {dashboardSnapshot.attentionItems.map((patient) => (
                        <button
                          key={patient.id}
                          type="button"
                          onClick={() => handleOpenPatientFromHome(patient.clientId, patient.tab)}
                          className={`w-full rounded-[1.3rem] border px-3 py-3 text-left transition hover:shadow-[0_12px_24px_rgba(32,54,43,0.08)] ${getAttentionToneClasses(patient.tone)}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <strong className="text-sm font-semibold">{patient.clientName}</strong>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-75">
                              {patient.stageLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-sm opacity-90">{patient.nextActionLabel}</p>
                          <p className="mt-1 text-xs opacity-75">{patient.supporting}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                      Sem pendencias criticas no momento. Use esse espaco para manter a base organizada e preparar a proxima semana.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="premium-panel mb-4 rounded-[1.8rem] p-4 sm:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="premium-kicker">Operacao</p>
                <h1 className="premium-title mt-3 text-[2.35rem] font-semibold leading-none text-[var(--color-ink)]">
                  {baseTitle}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {dashboardSnapshot.heroDescription}
                </p>
              </div>

              <div className="premium-chip shrink-0 flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold">
                  {syncStatus === "syncing" && <RefreshCw size={12} className="animate-spin" />}
                  {syncStatus === "synced" && <CheckCircle2 size={12} className="text-emerald-600" />}
                  {syncStatus === "error" && <AlertTriangle size={12} className="text-amber-600" />}
                  {snapshotStatusLabel}
                </span>
                <button
                  onClick={handleManualSync}
                  disabled={syncStatus === "syncing"}
                  className="rounded-full p-1.5 transition-colors hover:bg-black/5 disabled:opacity-50"
                  title="Sincronizar agora"
                >
                  <RefreshCw size={14} className={syncStatus === "syncing" ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            <div className="hide-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1">
              <button
                type="button"
                onClick={handleOpenPatientsFolder}
                className="premium-button-primary ios-touch-target shrink-0 px-4 py-3 text-sm"
              >
                <span className="relative z-10">Pacientes</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDashboard(true)}
                className="premium-button-secondary ios-touch-target shrink-0 px-4 py-3 text-sm"
              >
                <span className="relative z-10">Financeiro</span>
              </button>
              <button
                type="button"
                onClick={handleOpenDocuments}
                className="premium-button-secondary ios-touch-target shrink-0 px-4 py-3 text-sm"
              >
                <span className="relative z-10">Arquivos</span>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {dashboardSnapshot.stats.slice(0, 3).map((item) => (
                <div
                  key={item.label}
                  className={`rounded-[1.2rem] border px-3 py-3 ${getAccentClasses(item.accent).card}`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">{item.label}</p>
                  <strong className="mt-2 block text-lg font-semibold leading-none text-[var(--color-ink)]">{item.value}</strong>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[1.6rem] border border-white/70 bg-white/72 p-4 shadow-[0_16px_30px_rgba(32,54,43,0.08)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Foco imediato</p>
              <h2 className="mt-2 text-lg font-semibold leading-tight text-[var(--color-ink)]">
                {dashboardSnapshot.heroHeadline}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {dashboardSnapshot.attentionItems[0]?.nextActionLabel || "A home fica mais util quando existem pacientes e agendamentos cadastrados."}
              </p>
            </div>
          </section>

          {pageFeedback && (
            <div
              className={`premium-card mb-4 flex items-start justify-between gap-3 rounded-[1.6rem] px-4 py-4 text-sm ${
                pageFeedback.tone === "error"
                  ? "border-rose-200 bg-rose-50/85 text-rose-900"
                  : "border-emerald-200 bg-emerald-50/85 text-emerald-900"
              }`}
              style={{ minHeight: "3.5rem" }}
            >
              <div className="flex items-start gap-2">
                {pageFeedback.tone === "error" ? <AlertTriangle size={16} className="mt-0.5" /> : <CheckCircle2 size={16} className="mt-0.5" />}
                <p>{pageFeedback.message}</p>
              </div>
              <button type="button" onClick={() => setPageFeedback(null)} className="rounded-full p-1 opacity-70 transition hover:opacity-100" aria-label="Fechar aviso">
                <X size={14} />
              </button>
            </div>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="premium-kicker">
                  <Sparkles size={14} />
                  Modulos
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)] sm:text-2xl">Acesso rapido</h2>
              </div>

              <span className={`premium-chip px-4 py-2 text-xs ${syncStatus === "error" ? "" : "is-active"}`}>{snapshotStatusLabel}</span>
            </div>

            <div className="premium-grid-board p-3 sm:p-4" onClick={(e) => e.stopPropagation()}>
              <div className="relative z-10 grid grid-cols-2 gap-2 min-[430px]:grid-cols-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
                <GenericFolderIcon
                  label="Pacientes"
                  caption="cadastro e evolucao"
                  selected={selectedId === "patients"}
                  onClick={() => setSelectedId("patients")}
                  onDoubleClick={handleOpenPatientsFolder}
                />
                <GenericFolderIcon
                  label={branding.documentsLabel}
                  caption="termos e acervo"
                  selected={selectedId === "documents"}
                  onClick={() => setSelectedId("documents")}
                  onDoubleClick={handleOpenDocuments}
                />
                <AppIcon
                  label={branding.dashboardLabel}
                  caption="caixa e desempenho"
                  selected={selectedId === "dashboard"}
                  onClick={() => setSelectedId("dashboard")}
                  onDoubleClick={() => setShowDashboard(true)}
                />
                <AppIcon
                  label="Personalizar"
                  caption="marca e interface"
                  selected={selectedId === "settings"}
                  onClick={() => setSelectedId("settings")}
                  onDoubleClick={handleOpenBrandingSettings}
                />
                <AppIcon
                  label="Guia"
                  caption="treinar a equipe"
                  selected={selectedId === "guide"}
                  onClick={() => setSelectedId("guide")}
                  onDoubleClick={handleOpenGuide}
                />
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <div className="premium-panel rounded-[1.9rem] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="premium-kicker">
                    <CalendarDays size={14} />
                    Agenda viva
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-[var(--color-ink)]">Proximos atendimentos</h2>
                </div>
                <span className="rounded-full bg-[rgba(122,73,33,0.08)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                  {dashboardSnapshot.upcomingAppointmentsCount}
                </span>
              </div>

              {dashboardSnapshot.nextAppointments.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {dashboardSnapshot.nextAppointments.map((appointment) => (
                    <button
                      key={appointment.id}
                      type="button"
                      onClick={() => handleOpenPatientFromHome(appointment.clientId, appointment.tab)}
                      className="flex w-full items-center justify-between gap-3 rounded-[1.4rem] border border-white/70 bg-white/78 px-3 py-3 text-left transition hover:border-[var(--color-brand-line)] hover:bg-white"
                    >
                      <div>
                        <strong className="text-sm font-semibold text-[var(--color-ink)]">{appointment.clientName}</strong>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{appointment.startsLabel}</p>
                      </div>
                      <ArrowRight size={16} className="shrink-0 text-[var(--color-brand-accent)]" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-[1.4rem] border border-dashed border-[var(--color-brand-line)] bg-white/60 px-4 py-5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  Sem agenda futura por enquanto. Assim que um retorno for marcado, ele aparece aqui para acesso rapido.
                </div>
              )}
            </div>

            <div className="premium-panel rounded-[1.9rem] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="premium-kicker">
                    <CircleDollarSign size={14} />
                    Pos-venda
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-[var(--color-ink)]">Pendencias financeiras</h2>
                </div>
                <span className="rounded-full bg-[rgba(122,73,33,0.08)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                  {dashboardSnapshot.pendingHomecareCount}
                </span>
              </div>

              {dashboardSnapshot.financeItems.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {dashboardSnapshot.financeItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleOpenPatientFromHome(item.clientId, item.tab)}
                      className="w-full rounded-[1.4rem] border border-white/70 bg-white/78 px-3 py-3 text-left transition hover:border-[var(--color-brand-line)] hover:bg-white"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm font-semibold text-[var(--color-ink)]">{item.clientName}</strong>
                        <span className="text-sm font-semibold text-[var(--color-brand-deep)]">{item.amountLabel}</span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.description}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{item.supporting}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-[1.4rem] border border-dashed border-emerald-200 bg-emerald-50/55 px-4 py-5 text-sm leading-relaxed text-emerald-900">
                  Sem pendencias de homecare no momento. O pos-venda esta financeiramente em dia.
                </div>
              )}
            </div>

            <div className="premium-panel rounded-[1.9rem] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="premium-kicker">
                    <ClipboardList size={14} />
                    Prontuarios
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-[var(--color-ink)]">Fichas recentes</h2>
                </div>
                <span className="rounded-full bg-[rgba(122,73,33,0.08)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                  {dashboardSnapshot.recentFichaUpdatesCount}
                </span>
              </div>

              {dashboardSnapshot.recentFichaItems.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {dashboardSnapshot.recentFichaItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleOpenPatientFromHome(item.clientId, item.tab)}
                      className="w-full rounded-[1.4rem] border border-white/70 bg-white/78 px-3 py-3 text-left transition hover:border-[var(--color-brand-line)] hover:bg-white"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm font-semibold text-[var(--color-ink)]">{item.clientName}</strong>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                          {item.updatedLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.description}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-[1.4rem] border border-dashed border-[var(--color-brand-line)] bg-white/60 px-4 py-5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  Ainda nao existem fichas recentes para revisar. Quando a equipe atualizar prontuarios, eles passam a aparecer aqui.
                </div>
              )}
            </div>
          </section>

          {clients.length === 0 && (
            <section className="premium-panel rounded-[1.9rem] p-5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              <div className="flex items-start gap-3">
                <Clock3 size={18} className="mt-0.5 text-[var(--color-brand-accent)]" />
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">Home pronta para ganhar contexto</p>
                  <p className="mt-1">
                    Assim que voce cadastrar pacientes, lancar agenda e registrar homecare, a tela inicial passa a mostrar prioridades reais em vez de blocos vazios.
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      <AnimatePresence>
        {!hasOverlayOpen && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            className="fixed inset-x-0 bottom-0 z-20 px-3 pt-3 sm:hidden"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <div className="ios-bottom-dock grid grid-cols-2 gap-2 rounded-[1.8rem] p-2.5">
              <button
                type="button"
                onClick={handleOpenPatientsFolder}
                className="premium-button-primary ios-touch-target px-4 py-3 text-sm"
              >
                <span className="relative z-10">Pacientes</span>
              </button>

              <button
                type="button"
                onClick={handleOpenDocuments}
                className="premium-button-secondary ios-touch-target px-4 py-3 text-sm"
              >
                <span className="relative z-10">Arquivos</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGuide && (
          <GuideWindow
            key="guide-window"
            onClose={() => setShowGuide(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDashboard && (
          <DashboardWindow
            key="dashboard-window"
            clients={clients}
            onClose={() => setShowDashboard(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDocuments && (
          <DocumentsWindow
            key="documents-window"
            onClose={() => setShowDocuments(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBrandingSettings && (
          <BrandingSettingsWindow
            key="branding-settings-window"
            onClose={() => setShowBrandingSettings(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
