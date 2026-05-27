"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Search, X, FolderPlus, Users, FolderOpen, AlertTriangle, CheckCircle2, ArrowLeft
} from "lucide-react";
import { AppointmentDraft, Client, ClientAppointment, ClientJourneyStage, FichaAnamneseCapilarDados, WindowTab } from "@/types";
import { useBrandingConfig } from "@/components/BrandingConfigProvider";
import { useClients, SyncStatus } from "@/hooks/useClients";
import FolderIcon from "@/components/clientes/FolderIcon";
import BrandLogo from "@/components/BrandLogo";
import { getBrandDisplayTitle } from "@/lib/brandingConfig";
import { AnimatePresence, motion } from "framer-motion";

const AnamnesisWindow = dynamic(() => import("@/components/clientes/AnamnesisWindow"), { ssr: false });
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

export default function PacientesPage() {
  const router = useRouter();
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
  } = useClients();
  const [openClientModal, setOpenClientModal] = useState<{ client: Client; initialTab: WindowTab } | null>(null);
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

  const filteredAttentionCount = useMemo(
    () =>
      journeyCounts["cadastro-inicial"]
      + journeyCounts["pre-consulta-pendente"]
      + journeyCounts["avaliacao-pendente"]
      + journeyCounts["retorno-pendente"],
    [journeyCounts]
  );

  const patientFolderStats = useMemo(
    () => [
      { label: "Visíveis agora", value: visibleClients.length, description: searchQuery ? "busca" : "recorte atual" },
      { label: "Em atenção", value: filteredAttentionCount, description: "prioridade" },
      { label: "Acompanhamento", value: journeyCounts["em-acompanhamento"], description: "andamento" },
    ],
    [filteredAttentionCount, journeyCounts, searchQuery, visibleClients.length]
  );

  const formattedLastSyncedAt =
    lastSyncedAt ? new Date(lastSyncedAt).toLocaleString("pt-BR") : null;
  const syncLabelMap: Record<SyncStatus, string> = {
    idle: "Online",
    syncing: "Sincronizando",
    synced: formattedLastSyncedAt ? `Sincronizado ${formattedLastSyncedAt}` : "Online",
    error: "Offline",
  };
  const snapshotStatusLabel = syncLabelMap[syncStatus];

  const handleReturnToHome = () => {
    router.push("/");
  };

  const handleOpenClient = (client: Client, initialTab: WindowTab = "perfil") => {
    setOpenClientModal({ client, initialTab });
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

  const handleDeleteClient = async (clientId: string) => {
    await deleteClient(clientId);
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (openClientModal) {
          setOpenClientModal(null);
        } else if (showNewForm) {
          setShowNewForm(false);
        } else {
          router.push("/");
        }
        setPageFeedback(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openClientModal, showNewForm, router]);

  useEffect(() => {
    setOpenClientModal((prev) => {
      if (!prev) return prev;
      const freshClient = clients.find((client) => client.id === prev.client.id);
      return freshClient ? { ...prev, client: freshClient } : null;
    });
  }, [clients]);

  useEffect(() => {
    const hasOverlay = Boolean(openClientModal || showNewForm);
    if (hasOverlay) {
      document.body.dataset.overlayOpen = "true";
    } else {
      delete document.body.dataset.overlayOpen;
    }
    return () => {
      delete document.body.dataset.overlayOpen;
    };
  }, [openClientModal, showNewForm]);

  useEffect(() => {
    const sections: string[] = ["Pacientes"];
    if (showNewForm) sections.push("Novo Paciente");
    if (openClientModal?.client.profile.nome) sections.push(openClientModal.client.profile.nome);
    sections.push(baseTitle);
    document.title = sections.join(" | ");
  }, [baseTitle, openClientModal?.client.profile.nome, showNewForm]);

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
      >
        <div className="workspace-shell space-y-4">
          <section className="premium-panel mb-4 rounded-[2rem] p-4 sm:p-6">
            <nav className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <button
                onClick={handleReturnToHome}
                className="transition-colors hover:text-[var(--color-brand-deep)]"
              >
                Home
              </button>
              <span className="text-[var(--color-brand-accent)]">/</span>
              <span className="flex items-center gap-1.5 font-semibold text-[var(--color-ink)]">
                <FolderOpen size={14} />
                Pacientes
              </span>
              <span className={`ml-auto premium-chip px-3 py-1.5 text-[11px] ${syncStatus === "error" ? "" : "is-active"}`}>
                {snapshotStatusLabel}
              </span>
            </nav>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="workspace-search-shell max-w-md flex-1">
                <Search size={16} className="shrink-0 text-[var(--color-brand-accent)]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar paciente"
                  aria-label="Buscar paciente"
                />
                {searchQuery ? (
                  <button type="button" onClick={() => setSearchQuery("")} aria-label="Limpar busca">
                    <X size={14} />
                  </button>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReturnToHome}
                  className="premium-button-secondary inline-flex items-center gap-1.5 px-4 py-3 text-sm"
                >
                  <ArrowLeft size={14} />
                  <span className="relative z-10">Voltar para home</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewForm(true)}
                  className="premium-button-primary px-4 py-3 text-sm"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <FolderPlus size={16} />
                    Novo
                  </span>
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {patientFolderStats.map((item) => (
                <div key={item.label} className="workspace-metric-card px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--color-brand-accent)]">{item.label}</p>
                  <strong className="mt-1 block text-[1.5rem] font-semibold leading-none text-[var(--color-ink)]">{item.value}</strong>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{item.description}</p>
                </div>
              ))}
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
                Ajuste a busca, troque o filtro ou cadastre um novo prontuario.
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
        </div>
      </main>

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
