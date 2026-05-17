"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, X, FolderPlus, Users, Menu, AlertTriangle, CheckCircle2 } from "lucide-react";
import { AppointmentDraft, Client, ClientAppointment, ClientJourneyStage, FichaAnamneseCapilarDados, WindowTab } from "@/types";
import { useBrandingConfig } from "@/components/BrandingConfigProvider";
import { useClients } from "@/hooks/useClients";
import FolderIcon from "@/components/FolderIcon";
import AppIcon from "@/components/AppIcon";
import BrandingSettingsWindow from "@/components/BrandingSettingsWindow";
import GenericFolderIcon from "@/components/GenericFolderIcon";
import BrandMark from "@/components/BrandMark";
import BrandLogo from "@/components/BrandLogo";
import AnamnesisWindow from "@/components/AnamnesisWindow";
import DashboardWindow from "@/components/DashboardWindow";
import DocumentsWindow from "@/components/DocumentsWindow";
import NewClientForm from "@/components/NewClientForm";
import { getBrandDisplayTitle } from "@/lib/brandingConfig";
import { AnimatePresence, motion } from "framer-motion";

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
    addHomecare,
    addAppointment,
    linkAppointmentToGoogle,
    saveFichaAnamnese,
    deletePhoto,
    deleteClient,
    syncWarning,
    lastSnapshotAt,
  } = useClients();
  const [openClientModal, setOpenClientModal] = useState<{ client: Client, initialTab: WindowTab } | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showBrandingSettings, setShowBrandingSettings] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [spotlightFocused, setSpotlightFocused] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [journeyFilter, setJourneyFilter] = useState<"todos" | ClientJourneyStage>("todos");
  const [pageFeedback, setPageFeedback] = useState<PageFeedback | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setOpenClientModal(null);
        setShowDashboard(false);
        setShowDocuments(false);
        setShowBrandingSettings(false);
        setShowNewForm(false);
        setShowMobileMenu(false);
        setJourneyFilter("todos");
        setPageFeedback(null);
        setSearchQuery("");
        searchRef.current?.blur();
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
    const hasOverlay = Boolean(openClientModal || showDashboard || showDocuments || showBrandingSettings || showNewForm);

    if (hasOverlay) {
      document.body.dataset.overlayOpen = "true";
    } else {
      delete document.body.dataset.overlayOpen;
    }

    return () => {
      delete document.body.dataset.overlayOpen;
    };
  }, [openClientModal, showDashboard, showDocuments, showBrandingSettings, showNewForm]);

  useEffect(() => {
    const sections: string[] = [];
    if (showDashboard) sections.push(branding.dashboardLabel);
    if (showDocuments) sections.push(branding.documentsTitle);
    if (showBrandingSettings) sections.push("Personalização");
    if (showNewForm) sections.push("Novo Paciente");
    if (openClientModal?.client.profile.nome) sections.push(openClientModal.client.profile.nome);
    sections.push(baseTitle);
    document.title = sections.join(" | ");
  }, [baseTitle, branding.dashboardLabel, branding.documentsTitle, openClientModal?.client.profile.nome, showDashboard, showDocuments, showBrandingSettings, showNewForm]);

  const handleOpenDocuments = () => {
    setSelectedId("documents");
    setShowDocuments(true);
    setShowMobileMenu(false);
  };

  const handleOpenBrandingSettings = () => {
    setSelectedId(null);
    setShowBrandingSettings(true);
    setShowMobileMenu(false);
  };

  const handleOpenClient = (client: Client, initialTab: WindowTab = "perfil") => {
    setOpenClientModal({ client, initialTab });
    setSelectedId(null);
    setShowMobileMenu(false);
  };

  const handleDeleteClient = async (clientId: string) => {
    await deleteClient(clientId);
    setSelectedId((prev) => (prev === clientId ? null : prev));
    setOpenClientModal((prev) => (prev?.client.id === clientId ? null : prev));
    setShowMobileMenu(false);
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
  const handleAddHomecare = async (
    clientId: string,
    input: {
      produtosRecomendados: string;
      obsCuidados?: string;
      dataRetornoSugerida?: string;
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

  const formattedSnapshotAt =
    lastSnapshotAt ? new Date(lastSnapshotAt).toLocaleString("pt-BR") : null;

  return (
    <div className="relative min-h-[var(--app-dvh)] bg-white/40" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* ---- Menubar — Liquid Glass White ---- */}
      <header
        className="app-sticky-header flex flex-wrap items-center gap-2.5 px-3 pb-2.5 pt-[max(0.75rem,env(safe-area-inset-top))] sm:flex-nowrap sm:gap-3 sm:px-4"
        style={{
          background: "rgba(255, 255, 255, 0.4)",
          backdropFilter: "blur(20px) saturate(1.6)",
          WebkitBackdropFilter: "blur(20px) saturate(1.6)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
          boxShadow: "0 1px 0 rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.7)",
        }}
      >
        {/* Logo */}
        <div className="mr-0 flex shrink-0 items-center gap-2 sm:mr-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#d7b289] to-[#7a4921] flex items-center justify-center shadow-md">
            <BrandMark className="h-4 w-4" />
          </div>
          <BrandLogo compact className="hidden sm:flex" />
        </div>

        {/* Spotlight search */}
        <div
          className={`order-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 transition-all duration-200 sm:order-none sm:mx-auto sm:max-w-sm sm:flex-1`}
          style={{
            background: spotlightFocused ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.55)",
            border: spotlightFocused ? "1px solid rgba(140,90,45,0.38)" : "1px solid rgba(74,44,26,0.10)",
            boxShadow: spotlightFocused ? "0 0 0 3px rgba(140,90,45,0.10)" : "none",
          }}
        >
          <Search size={13} className={`flex-shrink-0 transition-colors ${spotlightFocused ? "text-[var(--color-brand-accent)]" : "text-[#aeaeb2]"}`} />
          <input
            ref={searchRef}
            id="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSpotlightFocused(true)}
            onBlur={() => setSpotlightFocused(false)}
            placeholder="Buscar paciente, protocolo ou prontuário..."
            className="bg-transparent flex-1 text-sm text-[#1d1d1f] placeholder-[#aeaeb2] outline-none min-h-6"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="p-1.5 text-[#aeaeb2] hover:text-[#6e6e73] transition-colors"
              aria-label="Limpar busca"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="hidden lg:flex items-center gap-1 text-[#6e6e73] text-xs">
          <Users size={12} />
          <span>{visibleClients.length} paciente{visibleClients.length !== 1 ? "s" : ""}</span>
        </div>

        {/* New client button */}
        <button
          id="new-client-btn"
          onClick={() => setShowNewForm(true)}
          className="hidden md:flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: "rgba(140,90,45,0.10)",
            border: "1px solid rgba(140,90,45,0.22)",
            color: "#8c5a2d",
          }}
          title="Novo paciente"
        >
          <FolderPlus size={13} />
          <span>Novo Paciente</span>
        </button>

        <button
          type="button"
          onClick={handleOpenBrandingSettings}
          className="hidden md:flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: "rgba(255,255,255,0.7)",
            border: "1px solid rgba(74,44,26,0.10)",
            color: "#6e6e73",
          }}
          title="Personalizar a marca e os textos"
        >
          <span>Personalizar</span>
        </button>

        <button
          onClick={() => setShowMobileMenu((prev) => !prev)}
          className="sm:hidden inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white/60 text-[#1d1d1f]"
          aria-label="Abrir menu"
          aria-expanded={showMobileMenu}
        >
          <Menu size={18} />
        </button>
      </header>

      <AnimatePresence>
        {showMobileMenu && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="sm:hidden sticky top-[calc(env(safe-area-inset-top)+4.9rem)] z-20 mx-3 mt-2 rounded-2xl border border-white/60 bg-white/70 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.12)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[#6e6e73]">
              <span>Ações</span>
              <span>{filteredClients.length} pacientes</span>
            </div>
            <button
              onClick={() => {
                setShowNewForm(true);
                setShowMobileMenu(false);
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#8c5a2d]/20 bg-[#f4e6d3] px-4 py-3 text-sm font-semibold text-[#8c5a2d]"
            >
              <FolderPlus size={15} /> Novo Paciente
            </button>
            <button
              onClick={handleOpenBrandingSettings}
              className="mt-3 flex w-full items-center justify-center rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-[#6e6e73]"
            >
              Personalizar marca e textos
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {syncWarning && (
        <div className="mx-3 mt-3 rounded-2xl border border-amber-300/70 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-[0_10px_30px_rgba(180,83,9,0.10)] sm:mx-8">
          <p className="font-semibold">Protecao de dados ativada</p>
          <p className="mt-1 text-amber-900/90">{syncWarning}</p>
          {formattedSnapshotAt && (
            <p className="mt-1 text-xs text-amber-800/80">Ultima copia local salva: {formattedSnapshotAt}</p>
          )}
        </div>
      )}

      {pageFeedback && (
        <div
          className={`mx-3 mt-3 flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm shadow-[0_10px_30px_rgba(0,0,0,0.08)] sm:mx-8 ${
            pageFeedback.tone === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
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

      {/* ---- Desktop area ---- */}
      <main
        className="relative min-h-[calc(var(--app-dvh)-4.5rem)] px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:p-8"
        onClick={() => setSelectedId(null)}
      >
        {/* Search result hint */}
        {searchQuery && (
          <div className="mb-4 flex items-center gap-2 text-[#6e6e73] text-sm spotlight-appear">
            <Search size={13} />
            <span>
              {visibleClients.length} resultado{visibleClients.length !== 1 ? "s" : ""} para &quot;{searchQuery}&quot;
            </span>
          </div>
        )}

        {filteredClients.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {JOURNEY_FILTERS.map((filter) => {
              const count = filter.id === "todos" ? filteredClients.length : journeyCounts[filter.id];
              const active = journeyFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setJourneyFilter(filter.id)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-[#7a4921] text-white"
                      : "bg-white/65 text-[#6e6e73] hover:bg-white"
                  }`}
                >
                  <span>{filter.label}</span>
                  <span className={`rounded-full px-2 py-0.5 ${active ? "bg-white/15 text-white" : "bg-black/5 text-[#8c5a2d]"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {visibleClients.length === 0 ? (
          <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-[#aeaeb2] sm:min-h-[16rem]">
            <BrandMark className="h-14 w-14 opacity-80" />
            <p className="text-sm">
              {journeyFilter === "todos" ? "Nenhum paciente encontrado" : "Nenhum paciente neste estagio"}
            </p>
            {!searchQuery && journeyFilter === "todos" && (
              <button
                onClick={() => setShowNewForm(true)}
                className="mt-2 px-4 py-2 rounded-xl text-[#8c5a2d] text-sm font-medium transition-colors"
                style={{ background: "rgba(140,90,45,0.08)", border: "1px solid rgba(140,90,45,0.18)" }}
              >
                + Adicionar primeiro paciente
              </button>
            )}
          </div>
        ) : (
          <div
            className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6"
            onClick={(e) => e.stopPropagation()}
          >
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
                layout
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
        )}
      </main>

      {/* ---- Modals ---- */}
      <AnimatePresence>
        {openClientModal && (
          <AnamnesisWindow
            key={openClientModal.client.id}
            client={openClientModal.client}
            initialTab={openClientModal.initialTab}
            onClose={() => setOpenClientModal(null)}
            onUpdate={handleClientUpdate}
            onAddDiagnostico={handleAddDiagnostico}
            onAddProcedimento={handleAddProcedimento}
            onAddHomecare={handleAddHomecare}
            onAddAppointment={handleAddAppointment}
            onLinkAppointmentToGoogle={handleLinkAppointmentToGoogle}
            onSaveFichaAnamnese={handleSaveFichaAnamnese}
            onDeletePhoto={handleDeletePhoto}
            onDeleteClient={handleDeleteClient}
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
