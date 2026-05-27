"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { Search, X, FolderPlus, Users, AlertTriangle, CheckCircle2, RefreshCw, Sparkles, FolderOpen, Activity, Clock, ArrowRight } from "lucide-react";
import { AppointmentDraft, Client, ClientAppointment, ClientJourneyStage, FichaAnamneseCapilarDados, WindowTab } from "@/types";
import { useBrandingConfig } from "@/components/BrandingConfigProvider";
import { useClients, SyncStatus } from "@/hooks/useClients";
import FolderIcon from "@/components/clientes/FolderIcon";
import AppIcon from "@/components/AppIcon";
import GenericFolderIcon from "@/components/GenericFolderIcon";
import BrandLogo from "@/components/BrandLogo";
import { getBrandDisplayTitle } from "@/lib/brandingConfig";
import { AnimatePresence, motion } from "framer-motion";

const AnamnesisWindow = dynamic(() => import("@/components/clientes/AnamnesisWindow"), { ssr: false });
const DashboardWindow = dynamic(() => import("@/components/DashboardWindow"), { ssr: false });
const DocumentsWindow = dynamic(() => import("@/components/DocumentsWindow"), { ssr: false });
const BrandingSettingsWindow = dynamic(() => import("@/components/BrandingSettingsWindow"), { ssr: false });
const GuideWindow = dynamic(() => import("@/components/GuideWindow"), { ssr: false });
const NewClientForm = dynamic(() => import("@/components/clientes/NewClientForm"), { ssr: false });

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

type WorkspaceFolderView = "root" | "patients";

const PATIENTS_FOLDER_LABEL = "Pacientes";

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
  const [workspaceFolder, setWorkspaceFolder] = useState<WorkspaceFolderView>("root");

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

  const filteredAttentionCount = useMemo(
    () =>
      journeyCounts["cadastro-inicial"]
      + journeyCounts["pre-consulta-pendente"]
      + journeyCounts["avaliacao-pendente"]
      + journeyCounts["retorno-pendente"],
    [journeyCounts]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenClientModal(null);
        setShowDashboard(false);
        setShowDocuments(false);
        setShowBrandingSettings(false);
        setShowGuide(false);
        setShowNewForm(false);
        setWorkspaceFolder("root");
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
    if (workspaceFolder === "patients") sections.push(PATIENTS_FOLDER_LABEL);
    if (showDashboard) sections.push(branding.dashboardLabel);
    if (showDocuments) sections.push(branding.documentsTitle);
    if (showBrandingSettings) sections.push("Personalização");
    if (showGuide) sections.push("Guia de uso");
    if (showNewForm) sections.push("Novo Paciente");
    if (openClientModal?.client.profile.nome) sections.push(openClientModal.client.profile.nome);
    sections.push(baseTitle);
    document.title = sections.join(" | ");
  }, [baseTitle, branding.dashboardLabel, branding.documentsTitle, openClientModal?.client.profile.nome, showDashboard, showDocuments, showBrandingSettings, showGuide, showNewForm, workspaceFolder]);

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

  const handleOpenPatientsFolder = () => {
    setWorkspaceFolder("patients");
    setSelectedId("patients");
  };

  const handleReturnToRootWorkspace = () => {
    setWorkspaceFolder("root");
    setSelectedId(null);
    setSearchQuery("");
    setJourneyFilter("todos");
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

  const rootWorkspaceStats = useMemo(
    () => [
      { label: "Prontuários ativos", value: clients.length, description: "base pronta para operar" },
      { label: "Demandam atenção", value: priorityPatientsCount, description: "resposta, avaliação ou retorno" },
      { label: "Agenda viva", value: upcomingAppointmentsCount, description: "pacientes com próxima sessão" },
    ],
    [clients.length, priorityPatientsCount, upcomingAppointmentsCount]
  );

  const rootFlowHighlights = useMemo(
    () => [
      { label: "Triagem", value: onboardingPatientsCount, description: "cadastros no início da jornada" },
      { label: "Acompanhamento", value: trackingPatientsCount, description: "casos com esteira ativa" },
      { label: "Sincronia", value: syncStatus === "error" ? "offline" : "ok", description: snapshotStatusLabel },
    ],
    [onboardingPatientsCount, snapshotStatusLabel, syncStatus, trackingPatientsCount]
  );

  const patientFolderStats = useMemo(
    () => [
      { label: "Visíveis agora", value: visibleClients.length, description: searchQuery ? "resultado da busca" : "no recorte atual" },
      { label: "Em atenção", value: filteredAttentionCount, description: "triagem, avaliação ou retorno" },
      { label: "Acompanhamento", value: journeyCounts["em-acompanhamento"], description: "casos estáveis na esteira" },
    ],
    [filteredAttentionCount, journeyCounts, searchQuery, visibleClients.length]
  );

  const handleManualSync = async () => {
    if (syncStatus === "syncing") return;
    await refreshClients();
  };
  const hasOverlayOpen = Boolean(openClientModal || showDashboard || showDocuments || showBrandingSettings || showGuide || showNewForm);
  const isPatientsFolderOpen = workspaceFolder === "patients";

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
                    Workspace clínico
                  </p>
                  <h1 className="premium-heading mt-4 max-w-4xl text-[clamp(2.8rem,5vw,4.9rem)]">
                    Uma frente mais viva, atual e ainda focada no que importa.
                  </h1>
                  <p className="premium-subtitle mt-4 max-w-2xl text-base">
                    A raiz ficou reservada para os módulos centrais, os prontuários foram agrupados em uma pasta dedicada e a leitura do ambiente ficou mais rápida sem perder leveza.
                  </p>
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
                      Abrir pacientes
                      <ArrowRight size={15} />
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

              <div className="space-y-3">
                <div className="workspace-aside-card p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--color-brand-accent)]">Pulso da clínica</p>
                      <h2 className="mt-2 text-lg font-semibold text-[var(--color-ink)]">Como a base está se movendo hoje</h2>
                    </div>
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

                <div className="workspace-aside-card p-4 sm:p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--color-brand-accent)]">Roteiro de uso</p>
                  <div className="mt-4 space-y-3 text-sm text-[var(--color-text-secondary)]">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[rgba(122,73,33,0.08)] text-[var(--color-brand-accent)]">
                        <FolderOpen size={16} />
                      </span>
                      <div>
                        <p className="font-semibold text-[var(--color-ink)]">Prontuários concentrados</p>
                        <p className="mt-1">A pasta Pacientes virou a entrada principal dos casos, deixando a home mais limpa e legível.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[rgba(92,117,100,0.12)] text-[var(--color-sage)]">
                        <Clock size={16} />
                      </span>
                      <div>
                        <p className="font-semibold text-[var(--color-ink)]">Leitura rápida da operação</p>
                        <p className="mt-1">Financeiro, documentos e status da base continuam acessíveis logo de cara, sem disputar atenção com todos os prontuários.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

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

          <div className="workspace-aside-card mt-4 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Home renovada</p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              Os módulos principais ficaram na raiz e os prontuários agora entram por uma pasta dedicada para a tela respirar melhor.
            </p>
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

        {isPatientsFolderOpen ? (
          <>
            <section className="premium-panel mb-4 rounded-[2rem] p-4 sm:p-6">
              <div className="workspace-hero-grid items-start">
                <div className="min-w-0">
                  <p className="premium-kicker">
                    <FolderOpen size={14} />
                    Home / {PATIENTS_FOLDER_LABEL}
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold text-[var(--color-ink)] sm:text-[2.2rem]">Prontuários das pacientes</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                    Aqui a navegação fica focada em casos, jornadas e próximos passos. A raiz segue limpa para alternar entre módulos e a pasta concentra toda a leitura clínica.
                  </p>

                  <div className="workspace-search-shell mt-5">
                    <Search size={16} className="shrink-0 text-[var(--color-brand-accent)]" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Buscar paciente, prontuário ou etapa"
                      aria-label="Buscar paciente"
                    />
                    {searchQuery ? (
                      <button type="button" onClick={() => setSearchQuery("")} aria-label="Limpar busca">
                        <X size={14} />
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleReturnToRootWorkspace}
                      className="premium-button-secondary px-4 py-3 text-sm"
                    >
                      <span className="relative z-10">Voltar para home</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewForm(true)}
                      className="premium-button-primary px-4 py-3 text-sm"
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        <FolderPlus size={16} />
                        Novo paciente
                      </span>
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  {patientFolderStats.map((item) => (
                    <div key={item.label} className="workspace-metric-card p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--color-brand-accent)]">{item.label}</p>
                      <strong className="mt-3 block text-[1.8rem] font-semibold leading-none text-[var(--color-ink)]">{item.value}</strong>
                      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

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
          </>
        ) : (
          <section className="space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="premium-kicker">
                  <Sparkles size={14} />
                  Ambientes principais
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)] sm:text-2xl">A raiz agora funciona como uma mesa clínica mais curada.</h2>
                <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-secondary)]">
                  Os prontuários deixaram de disputar espaço com os módulos principais. O resultado é uma home mais preenchida, atual e mais fácil de ler no primeiro olhar.
                </p>
              </div>

              <div className="workspace-aside-card px-4 py-4 text-sm text-[var(--color-text-secondary)] lg:max-w-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--color-brand-accent)]">Atalho principal</p>
                <p className="mt-2 font-semibold text-[var(--color-ink)]">Entre por Pacientes quando o foco for prontuário e use a raiz para alternar rápido entre operação, arquivos e indicadores.</p>
              </div>
            </div>

            <div className="premium-grid-board p-3 sm:p-4" onClick={(e) => e.stopPropagation()}>
              <div className="relative z-10 grid grid-cols-2 gap-2 min-[430px]:grid-cols-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
                <GenericFolderIcon
                  label={PATIENTS_FOLDER_LABEL}
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
              {isPatientsFolderOpen ? (
                <>
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
                    onClick={handleReturnToRootWorkspace}
                    className="premium-button-secondary ios-touch-target px-4 py-3 text-sm"
                  >
                    <span className="relative z-10">Home</span>
                  </button>
                </>
              ) : (
                <>
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
                </>
              )}
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
