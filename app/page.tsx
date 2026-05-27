"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Sparkles, FolderOpen, Activity, RefreshCw, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { useBrandingConfig } from "@/components/BrandingConfigProvider";
import { useClients, SyncStatus } from "@/hooks/useClients";
import AppIcon from "@/components/AppIcon";
import GenericFolderIcon from "@/components/GenericFolderIcon";
import BrandLogo from "@/components/BrandLogo";
import { getBrandDisplayTitle } from "@/lib/brandingConfig";
import { AnimatePresence, motion } from "framer-motion";

const DashboardWindow = dynamic(() => import("@/components/DashboardWindow"), { ssr: false });
const DocumentsWindow = dynamic(() => import("@/components/DocumentsWindow"), { ssr: false });
const BrandingSettingsWindow = dynamic(() => import("@/components/BrandingSettingsWindow"), { ssr: false });
const GuideWindow = dynamic(() => import("@/components/GuideWindow"), { ssr: false });

type PageFeedback = {
  tone: "error" | "success";
  message: string;
};

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

  const priorityPatientsCount = useMemo(
    () =>
      clients.filter((client) => {
        const stage = client.journey?.stage;
        return stage === "pre-consulta-pendente" || stage === "avaliacao-pendente" || stage === "retorno-pendente";
      }).length,
    [clients]
  );

  const onboardingPatientsCount = useMemo(
    () => clients.filter((client) => client.journey?.stage === "cadastro-inicial").length,
    [clients]
  );

  const trackingPatientsCount = useMemo(
    () => clients.filter((client) => client.journey?.stage === "em-acompanhamento").length,
    [clients]
  );

  const upcomingAppointmentsCount = useMemo(() => {
    const now = Date.now();
    return clients.filter((client) =>
      client.appointments.some((appointment) =>
        ["agendado", "confirmado"].includes(appointment.status) && new Date(appointment.inicioEm).getTime() >= now
      )
    ).length;
  }, [clients]);

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
    if (showBrandingSettings) sections.push("Personalização");
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

  const formattedLastSyncedAt =
    lastSyncedAt ? new Date(lastSyncedAt).toLocaleString("pt-BR") : null;
  const syncLabelMap: Record<SyncStatus, string> = {
    idle: "Online",
    syncing: "Sincronizando",
    synced: formattedLastSyncedAt ? `Sincronizado ${formattedLastSyncedAt}` : "Online",
    error: "Offline",
  };
  const snapshotStatusLabel = syncLabelMap[syncStatus];

  const rootWorkspaceStats = useMemo(
    () => [
      { label: "Prontuários ativos", value: clients.length, description: "ativos" },
      { label: "Demandam atenção", value: priorityPatientsCount, description: "prioridade" },
      { label: "Agenda viva", value: upcomingAppointmentsCount, description: "agendados" },
    ],
    [clients.length, priorityPatientsCount, upcomingAppointmentsCount]
  );

  const rootFlowHighlights = useMemo(
    () => [
      { label: "Triagem", value: onboardingPatientsCount, description: "entrada" },
      { label: "Acompanhamento", value: trackingPatientsCount, description: "andamento" },
      { label: "Sincronia", value: syncStatus === "error" ? "offline" : "ok", description: snapshotStatusLabel },
    ],
    [onboardingPatientsCount, snapshotStatusLabel, syncStatus, trackingPatientsCount]
  );

  const handleManualSync = async () => {
    if (syncStatus === "syncing") return;
    await refreshClients();
  };
  const hasOverlayOpen = Boolean(showDashboard || showDocuments || showBrandingSettings || showGuide);

  return (
    <div className="relative min-h-[var(--app-dvh)] pb-4">
      <header className="app-sticky-header px-3 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4">
        <div
          className="mx-auto flex h-16 max-w-7xl items-center rounded-b-2xl px-5"
          style={{ backgroundColor: "rgba(244, 236, 223, 0.85)" }}
        >
          <div className="flex items-center gap-3">
            <BrandLogo compact subtitle={false} priority />
            <div className="hidden items-start gap-1 sm:flex sm:flex-col">
              <span
                className="text-[1.12rem] font-semibold leading-none tracking-[0.22em] text-[var(--color-brand-deep)] uppercase"
                style={{ fontFamily: "var(--font-brand), serif" }}
              >
                Al&apos;maré
              </span>
              <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.48em] text-[var(--color-brand-accent)]">
                <span className="h-px w-6 bg-[rgba(122,73,33,0.45)]" />
                Saúde Capilar
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
                    Operação
                  </p>
                  <h1 className="premium-heading mt-4 max-w-4xl text-[clamp(2.8rem,5vw,4.9rem)]">
                    {baseTitle}
                  </h1>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {rootWorkspaceStats.map((item) => (
                    <div key={item.label} className="workspace-metric-card p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--color-brand-accent)]">{item.label}</p>
                      <strong className="mt-3 block text-[2rem] font-semibold leading-none text-[var(--color-ink)]">{item.value}</strong>
                      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{item.description}</p>
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
                </div>
              </div>

              <div className="workspace-aside-card p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--color-brand-accent)]">Situação</p>
                  <span className={`premium-chip px-3 py-2 text-[11px] ${syncStatus === "error" ? "" : "is-active"}`}>
                    {snapshotStatusLabel}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  {rootFlowHighlights.map((item) => (
                    <div key={item.label} className="workspace-metric-card p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">{item.label}</p>
                      <strong className="mt-3 block text-[1.7rem] font-semibold leading-none text-[var(--color-ink)]">{item.value}</strong>
                      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

        <section className="premium-panel mb-4 rounded-[1.8rem] p-4 sm:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="premium-kicker">Operação</p>
              <h1 className="premium-title mt-3 text-[2.35rem] font-semibold leading-none text-[var(--color-ink)]">
                {baseTitle}
              </h1>
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
            <button
              type="button"
              onClick={handleOpenBrandingSettings}
              className="premium-button-secondary ios-touch-target shrink-0 px-4 py-3 text-sm"
            >
              <span className="relative z-10">Personalizar</span>
            </button>
            <button
              type="button"
              onClick={handleOpenGuide}
              className="premium-button-secondary ios-touch-target shrink-0 px-4 py-3 text-sm"
            >
              <span className="relative z-10">Guia</span>
            </button>
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
                  Módulos
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)] sm:text-2xl">Acesso rápido</h2>
              </div>

              <span className={`premium-chip px-4 py-2 text-xs ${syncStatus === "error" ? "" : "is-active"}`}>{snapshotStatusLabel}</span>
            </div>

            <div className="premium-grid-board p-3 sm:p-4" onClick={(e) => e.stopPropagation()}>
              <div className="relative z-10 grid grid-cols-2 gap-2 min-[430px]:grid-cols-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
                <GenericFolderIcon
                  label="Pacientes"
                  caption={`${clients.length} ativos`}
                  selected={selectedId === "patients"}
                  onClick={() => setSelectedId("patients")}
                  onDoubleClick={handleOpenPatientsFolder}
                />
                <GenericFolderIcon
                  label={branding.documentsLabel}
                  caption="Acervo interno"
                  selected={selectedId === "documents"}
                  onClick={() => setSelectedId("documents")}
                  onDoubleClick={handleOpenDocuments}
                />
                <AppIcon
                  label={branding.dashboardLabel}
                  caption="Indicadores"
                  selected={selectedId === "dashboard"}
                  onClick={() => setSelectedId("dashboard")}
                  onDoubleClick={() => setShowDashboard(true)}
                />
              </div>
            </div>
          </section>
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

      {/* ---- Modals ---- */}
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
