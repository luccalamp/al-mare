"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { Search, X, FolderPlus, Users, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { AppointmentDraft, Client, ClientAppointment, ClientJourneyStage, FichaAnamneseCapilarDados, WindowTab } from "@/types";
import { useBrandingConfig } from "@/components/BrandingConfigProvider";
import { useClients, SyncStatus } from "@/hooks/useClients";
import FolderIcon from "@/components/FolderIcon";
import AppIcon from "@/components/AppIcon";
import GenericFolderIcon from "@/components/GenericFolderIcon";
import BrandLogo from "@/components/BrandLogo";
import { getBrandDisplayTitle } from "@/lib/brandingConfig";
import { AnimatePresence, motion } from "framer-motion";

const AnamnesisWindow = dynamic(() => import("@/components/AnamnesisWindow"), { ssr: false });
const DashboardWindow = dynamic(() => import("@/components/DashboardWindow"), { ssr: false });
const DocumentsWindow = dynamic(() => import("@/components/DocumentsWindow"), { ssr: false });
const BrandingSettingsWindow = dynamic(() => import("@/components/BrandingSettingsWindow"), { ssr: false });
const GuideWindow = dynamic(() => import("@/components/GuideWindow"), { ssr: false });
const NewClientForm = dynamic(() => import("@/components/NewClientForm"), { ssr: false });

const JOURNEY_FILTERS: Array<{ id: "todos" | ClientJourneyStage; label: string }> = [
  { id: "todos", label: "Tudo" },
  { id: "cadastro-inicial", label: "Triagem" },
  { id: "pre-consulta-pendente", label: "Aguardando resposta" },
  { id: "avaliacao-pendente", label: "Avaliacao" },
  { id: "retorno-pendente", label: "Sem retorno" },
  { id: "em-acompanhamento", label: "Acompanhamento" },
];

type PageFeedback = {
  tone: "error" | "success";
  message: string;
};

export default function HomePage() {
  const { config: branding } = useBrandingConfig();
  const baseTitle = getBrandDisplayTitle(branding);
  const {
    clients,
    filteredClients,
    searchQuery,
    setSearchQuery,
    addClient,
    updateClient,
    addDiagnostico,
    addProcedimento,
    deleteProcedimento,
    addHomecare,
    confirmarPagamentoHomecare,
    addAppointment,
    linkAppointmentToGoogle,
    saveFichaAnamnese,
    deletePhoto,
    deleteClient,
    togglePreConsultationToken,
    syncStatus,
    lastSyncedAt,
    refreshClients,
  } = useClients();
  const [openClientModal, setOpenClientModal] = useState<{ client: Client, initialTab: WindowTab } | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showBrandingSettings, setShowBrandingSettings] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [journeyFilter, setJourneyFilter] = useState<"todos" | ClientJourneyStage>("todos");
  const [pageFeedback, setPageFeedback] = useState<PageFeedback | null>(null);

  const journeyCounts = useMemo(() => {
    const initialCounts: Record<ClientJourneyStage, number> = {
      "cadastro-inicial": 0,
      "pre-consulta-pendente": 0,
      "avaliacao-pendente": 0,
      "retorno-pendente": 0,
      "em-acompanhamento": 0,
    };

    return filteredClients.reduce((accumulator, client) => {
      const stage = client.journey?.stage;
      if (!stage) return accumulator;
      accumulator[stage] += 1;
      return accumulator;
    }, initialCounts);
  }, [filteredClients]);

  const visibleClients = useMemo(() => {
    if (journeyFilter === "todos") return filteredClients;
    return filteredClients.filter((client) => client.journey?.stage === journeyFilter);
  }, [filteredClients, journeyFilter]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenClientModal(null);
        setShowDashboard(false);
        setShowDocuments(false);
        setShowBrandingSettings(false);
        setShowGuide(false);
        setShowNewForm(false);
        setJourneyFilter("todos");
        setPageFeedback(null);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSearchQuery]);

  useEffect(() => {
    setOpenClientModal((prev) => {
      if (!prev) return prev;
      const freshClient = clients.find((client) => client.id === prev.client.id);
      return freshClient ? { ...prev, client: freshClient } : null;
    });
  }, [clients]);

  useEffect(() => {
    const hasOverlay = Boolean(openClientModal || showDashboard || showDocuments || showBrandingSettings || showGuide || showNewForm);

    if (hasOverlay) {
      document.body.dataset.overlayOpen = "true";
    } else {
      delete document.body.dataset.overlayOpen;
    }

    return () => {
      delete document.body.dataset.overlayOpen;
    };
  }, [openClientModal, showDashboard, showDocuments, showBrandingSettings, showGuide, showNewForm]);

  useEffect(() => {
    const sections: string[] = [];
    if (showDashboard) sections.push(branding.dashboardLabel);
    if (showDocuments) sections.push(branding.documentsTitle);
    if (showBrandingSettings) sections.push("Personalização");
    if (showGuide) sections.push("Guia de uso");
    if (showNewForm) sections.push("Novo Paciente");
    if (openClientModal?.client.profile.nome) sections.push(openClientModal.client.profile.nome);
    sections.push(baseTitle);
    document.title = sections.join(" | ");
  }, [baseTitle, branding.dashboardLabel, branding.documentsTitle, openClientModal?.client.profile.nome, showDashboard, showDocuments, showBrandingSettings, showGuide, showNewForm]);

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

  const handleOpenClient = (client: Client, initialTab: WindowTab = "perfil") => {
    setOpenClientModal({ client, initialTab });
    setSelectedId(null);
  };

  const handleDeleteClient = async (clientId: string) => {
    await deleteClient(clientId);
    setSelectedId((prev) => (prev === clientId ? null : prev));
    setOpenClientModal((prev) => (prev?.client.id === clientId ? null : prev));
    setPageFeedback({
      tone: "success",
      message: "Paciente arquivada com sucesso. A restauração fica disponível no painel administrativo de proteção.",
    });
  };

  const handleDeletePhoto = async (clientId: string, photoId: string) => {
    await deletePhoto(clientId, photoId);
    setPageFeedback({
      tone: "success",
      message: "Foto arquivada com sucesso e enviada para quarentena privada.",
    });
  };

  const handleTogglePreConsulta = async (clientId: string, active: boolean) => {
    await togglePreConsultationToken(clientId, active);
  };

  const mergeOpenClientAppointment = (clientId: string, appointment: ClientAppointment) => {
    setOpenClientModal((prev) => {
      if (!prev || prev.client.id !== clientId) return prev;
      const appointments = [appointment, ...prev.client.appointments.filter((item) => item.id !== appointment.id)].sort(
        (left, right) => new Date(right.inicioEm).getTime() - new Date(left.inicioEm).getTime()
      );
      return {
        ...prev,
        client: {
          ...prev.client,
          appointments,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const handleClientUpdate = async (updated: Client, photoFiles?: { file: File; type: string }[]) => {
    try {
      await updateClient(updated, photoFiles);
      setPageFeedback({
        tone: "success",
        message: "Paciente atualizado e sincronizado com sucesso.",
      });
    } catch (error) {
      console.error(error);
      setPageFeedback({
        tone: "error",
        message: error instanceof Error && error.message ? error.message : "Nao foi possivel salvar essa atualizacao no banco.",
      });
    }
  };

  const handleNewClient = async (client: Client) => {
    try {
      await addClient(client);
      setShowNewForm(false);
      setPageFeedback({
        tone: "success",
        message: "Paciente cadastrado com sucesso.",
      });
      setTimeout(() => handleOpenClient(client), 80);
    } catch (error) {
      console.error(error);
      setPageFeedback({
        tone: "error",
        message: error instanceof Error && error.message ? error.message : "Nao foi possivel cadastrar o paciente no banco.",
      });
    }
  };

  const handleAddDiagnostico = async (
    clientId: string,
    diagnostico: {
      porosidade: 1 | 2 | 3 | 4 | 5;
      elasticidade: 1 | 2 | 3;
      historiaQuimicaPrevia?: string;
      resultadoTesteMecha: string;
    }
  ) => {
    const novoDiagnostico = await addDiagnostico(clientId, diagnostico);

    if (openClientModal?.client.id === clientId) {
      const updatedClient = {
        ...openClientModal.client,
        diagnosticos: [novoDiagnostico, ...openClientModal.client.diagnosticos],
        updatedAt: new Date().toISOString(),
      };
      setOpenClientModal({ ...openClientModal, client: updatedClient });
    }
  };

  const handleAddProcedimento = async (
    clientId: string,
    procedimento: {
      tecnicaUtilizada: string;
      valor?: number | null;
      anotacoes?: string;
      alturaClareamento?: number | null;
      fundoClareamentoObtido?: string;
      volumagemOx?: string;
    }
  ) => {
    const novo = await addProcedimento(clientId, procedimento);

    if (openClientModal?.client.id === clientId) {
      setOpenClientModal({
        ...openClientModal,
        client: {
          ...openClientModal.client,
          colorimetrias: [novo, ...openClientModal.client.colorimetrias],
          updatedAt: new Date().toISOString(),
        },
      });
    }
  };

  const handleDeleteProcedimento = async (clientId: string, procedureId: string) => {
    await deleteProcedimento(clientId, procedureId);

    if (openClientModal?.client.id === clientId) {
      setOpenClientModal({
        ...openClientModal,
        client: {
          ...openClientModal.client,
          colorimetrias: openClientModal.client.colorimetrias.filter((c) => c.id !== procedureId),
          updatedAt: new Date().toISOString(),
        },
      });
    }
  };

  const handleAddHomecare = async (
    clientId: string,
    input: {
      produtosRecomendados: string;
      obsCuidados?: string;
      dataRetornoSugerida?: string;
      valorTotal?: number;
      formaPagamento?: "normal" | "avista" | "parcelado";
      parcelas?: number;
    }
  ) => {
    const novo = await addHomecare(clientId, input);

    if (openClientModal?.client.id === clientId) {
      setOpenClientModal({
        ...openClientModal,
        client: {
          ...openClientModal.client,
          homecare: [novo, ...openClientModal.client.homecare],
          updatedAt: new Date().toISOString(),
        },
      });
    }
  };
  const handleConfirmarPagamento = async (clientId: string, homecareId: string) => {
    await confirmarPagamentoHomecare(clientId, homecareId);
    if (openClientModal?.client.id === clientId) {
      setOpenClientModal({
        ...openClientModal,
        client: {
          ...openClientModal.client,
          homecare: openClientModal.client.homecare.map((h) =>
            h.id === homecareId ? { ...h, pago: true, confirmadoEm: new Date().toISOString() } : h
          ),
          updatedAt: new Date().toISOString(),
        },
      });
    }
  };
  const handleSaveFichaAnamnese = async (clientId: string, dados: FichaAnamneseCapilarDados) => {
    const next = await saveFichaAnamnese(clientId, dados);
    if (openClientModal?.client.id === clientId) {
      setOpenClientModal({
        ...openClientModal,
        client: {
          ...openClientModal.client,
          fichaAnamnese: next,
          updatedAt: new Date().toISOString(),
        },
      });
    }
  };

  const handleAddAppointment = async (clientId: string, input: AppointmentDraft) => {
    const appointment = await addAppointment(clientId, input);
    mergeOpenClientAppointment(clientId, appointment);
    return appointment;
  };

  const handleLinkAppointmentToGoogle = async (
    clientId: string,
    appointmentId: string,
    input: Pick<AppointmentDraft, "googleEventId" | "googleCalendarId" | "metadata">
  ) => {
    const appointment = await linkAppointmentToGoogle(clientId, appointmentId, input);
    mergeOpenClientAppointment(clientId, appointment);
    return appointment;
  };

  const formattedLastSyncedAt =
    lastSyncedAt ? new Date(lastSyncedAt).toLocaleString("pt-BR") : null;
  const activeJourneyLabel = JOURNEY_FILTERS.find((filter) => filter.id === journeyFilter)?.label ?? "Tudo";
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
  const hasOverlayOpen = Boolean(openClientModal || showDashboard || showDocuments || showBrandingSettings || showGuide || showNewForm);

  return (
    <div className="relative min-h-[var(--app-dvh)] pb-4">
      <header className="app-sticky-header px-3 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4">
        <div
          className="mx-auto flex h-16 max-w-7xl items-center rounded-b-2xl px-5"
          style={{ backgroundColor: "rgba(244, 236, 223, 0.85)" }}
        >
          <BrandLogo compact subtitle={false} priority />
        </div>
      </header>

      <main
        className="relative px-3 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-4 sm:px-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:pt-5"
        onClick={() => setSelectedId(null)}
      >
        <section className="premium-panel mb-4 rounded-[1.8rem] p-4 sm:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="premium-kicker">Workspace mobile</p>
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

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="premium-stat rounded-[1.3rem] p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Pacientes</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">{visibleClients.length}</p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Na tela agora</p>
            </div>
            <div className="premium-stat rounded-[1.3rem] p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Filtro</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-ink)]">{activeJourneyLabel}</p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Jornada ativa</p>
            </div>
          </div>

          <div className="hide-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1">
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

        {searchQuery && (
          <div className="spotlight-appear mb-4 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <Search size={13} />
            <span>
              {visibleClients.length} resultado{visibleClients.length !== 1 ? "s" : ""} para &quot;{searchQuery}&quot;
            </span>
          </div>
        )}

        {filteredClients.length > 0 && (
          <div className="hide-scrollbar -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {JOURNEY_FILTERS.map((filter) => {
              const count = filter.id === "todos" ? filteredClients.length : journeyCounts[filter.id];
              const active = journeyFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setJourneyFilter(filter.id)}
                  className={`premium-chip ios-touch-target shrink-0 gap-2 px-4 py-2.5 text-xs font-semibold ${active ? "is-active" : ""}`}
                  data-active={active}
                >
                  <span>{filter.label}</span>
                  <span className={`rounded-full px-2 py-0.5 ${active ? "bg-white/15 text-white" : "bg-black/5 text-[var(--color-brand-accent)]"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {visibleClients.length === 0 ? (
          <div className="premium-panel flex min-h-[45vh] flex-col items-center justify-center gap-3 rounded-[2rem] px-6 py-10 text-center text-[var(--color-text-secondary)] sm:min-h-[18rem]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(122,73,33,0.08)] text-[var(--color-brand-accent)]">
              <Users size={28} className="opacity-90" />
            </div>
            <p className="text-base font-semibold text-[var(--color-ink)]">
              {journeyFilter === "todos" ? "Nenhum paciente encontrado" : "Nenhum paciente neste estagio"}
            </p>
            <p className="max-w-md text-sm text-[var(--color-text-secondary)]">
              Ajuste a busca, mude o recorte da jornada ou cadastre um novo prontuario para manter o fluxo da clinica organizado.
            </p>
            {!searchQuery && journeyFilter === "todos" && (
              <button
                onClick={() => setShowNewForm(true)}
                className="premium-button-primary mt-2 px-5 py-3 text-sm"
              >
                <span className="relative z-10">Adicionar primeiro paciente</span>
              </button>
            )}
          </div>
        ) : (
          <div className="premium-grid-board p-3 sm:p-4" onClick={(e) => e.stopPropagation()}>
            <div className="relative z-10 grid grid-cols-2 gap-2 min-[430px]:grid-cols-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
              <GenericFolderIcon
                label={branding.documentsLabel}
                selected={selectedId === "documents"}
                onClick={() => setSelectedId("documents")}
                onDoubleClick={handleOpenDocuments}
              />
              <AppIcon
                label={branding.dashboardLabel}
                selected={selectedId === "dashboard"}
                onClick={() => setSelectedId("dashboard")}
                onDoubleClick={() => setShowDashboard(true)}
              />
              {visibleClients.map((client) => (
                <motion.div
                  key={client.id}
                  layout="position"
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.22 }}
                >
                  <FolderIcon
                    client={client}
                    selected={openClientModal?.client.id === client.id}
                    onClick={() => handleOpenClient(client, "perfil")}
                    onDoubleClick={() => handleOpenClient(client, "perfil")}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}
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
                onClick={() => setShowNewForm(true)}
                className="premium-button-primary ios-touch-target px-4 py-3 text-sm"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <FolderPlus size={16} />
                  Novo paciente
                </span>
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
        {openClientModal && (
          <AnamnesisWindow
            key={openClientModal.client.id}
            client={openClientModal.client}
            portalLink={openClientModal.client.portalLink}
            initialTab={openClientModal.initialTab}
            onClose={() => setOpenClientModal(null)}
            onUpdate={handleClientUpdate}
            onAddDiagnostico={handleAddDiagnostico}
            onAddProcedimento={handleAddProcedimento}
            onDeleteProcedimento={handleDeleteProcedimento}
            onAddHomecare={handleAddHomecare}
            onConfirmarPagamento={handleConfirmarPagamento}
            onAddAppointment={handleAddAppointment}
            onLinkAppointmentToGoogle={handleLinkAppointmentToGoogle}
            onSaveFichaAnamnese={handleSaveFichaAnamnese}
            onDeletePhoto={handleDeletePhoto}
            onDeleteClient={handleDeleteClient}
            onTogglePreConsulta={handleTogglePreConsulta}
          />
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

      <AnimatePresence>
        {showNewForm && (
          <NewClientForm
            key="new-form"
            onClose={() => setShowNewForm(false)}
            onSave={handleNewClient}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
