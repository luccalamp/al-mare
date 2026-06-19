import type { Client, ClientAppointment, WindowTab } from "@/types";

export type HomeCardAccent = "default" | "warning" | "success";
export type HomeActionTone = "neutral" | "warning" | "accent" | "success";

export type HomeStatCard = {
  label: string;
  value: number;
  description: string;
  supporting: string;
  badge: string;
  accent: HomeCardAccent;
};

export type HomeAgendaItem = {
  id: string;
  clientId: string;
  clientName: string;
  startsAt: string;
  startsLabel: string;
  statusLabel: string;
  tab: WindowTab;
};

export type HomeActionItem = {
  id: string;
  clientId: string;
  clientName: string;
  stageLabel: string;
  nextActionLabel: string;
  supporting: string;
  tone: HomeActionTone;
  tab: WindowTab;
};

export type HomeFinanceItem = {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  amountLabel: string;
  description: string;
  supporting: string;
  tab: WindowTab;
};

export type HomeRecentRecordItem = {
  id: string;
  clientId: string;
  clientName: string;
  updatedAt: string;
  updatedLabel: string;
  description: string;
  tab: WindowTab;
};

export type HomeDashboardSnapshot = {
  heroHeadline: string;
  heroDescription: string;
  stats: HomeStatCard[];
  todayAgenda: HomeAgendaItem[];
  nextAppointments: HomeAgendaItem[];
  attentionItems: HomeActionItem[];
  financeItems: HomeFinanceItem[];
  recentFichaItems: HomeRecentRecordItem[];
  activePatientsCount: number;
  todayAppointmentsCount: number;
  overdueAppointmentsCount: number;
  pendingPatientsCount: number;
  overdueAndPendingCount: number;
  missingFichaCount: number;
  pendingHomecareCount: number;
  recentFichaUpdatesCount: number;
  upcomingAppointmentsCount: number;
};

const PENDING_APPOINTMENT_STATUSES = new Set<ClientAppointment["status"]>(["agendado", "confirmado"]);

function hasFichaRegistrada(client: Client) {
  return Boolean(client.fichaAnamnese && Object.keys(client.fichaAnamnese).length > 0);
}

function parseDate(value: string | undefined | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = startOfDay(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function isPendingAppointment(appointment: ClientAppointment) {
  return PENDING_APPOINTMENT_STATUSES.has(appointment.status);
}

function formatAppointmentLabel(date: Date, now: Date) {
  const today = startOfDay(now).getTime();
  const tomorrow = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)).getTime();
  const targetDay = startOfDay(date).getTime();
  const timeLabel = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (targetDay === today) {
    return `Hoje, ${timeLabel}`;
  }

  if (targetDay === tomorrow) {
    return `Amanha, ${timeLabel}`;
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRecordLabel(date: Date, now: Date) {
  const diffInMs = now.getTime() - date.getTime();
  const diffInHours = Math.max(0, Math.round(diffInMs / 3_600_000));

  if (diffInHours < 24) {
    return diffInHours <= 1 ? "Atualizada ha 1 hora" : `Atualizada ha ${diffInHours} horas`;
  }

  const diffInDays = Math.max(1, Math.round(diffInMs / 86_400_000));
  return diffInDays === 1 ? "Atualizada ontem" : `Atualizada ha ${diffInDays} dias`;
}

function formatStatusLabel(status: ClientAppointment["status"]) {
  const labels: Record<ClientAppointment["status"], string> = {
    agendado: "Agendado",
    confirmado: "Confirmado",
    realizado: "Realizado",
    cancelado: "Cancelado",
    faltou: "Faltou",
  };

  return labels[status];
}

function getClientName(client: Client) {
  return client.profile.nome?.trim() || "Paciente sem nome";
}

export function buildHomeDashboardSnapshot(clients: Client[]): HomeDashboardSnapshot {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const allUpcomingAppointments = clients
    .flatMap((client) =>
      client.appointments
        .filter(isPendingAppointment)
        .map((appointment) => ({
          client,
          appointment,
          startsAt: parseDate(appointment.inicioEm),
        }))
    )
    .filter(
      (entry): entry is { client: Client; appointment: ClientAppointment; startsAt: Date } =>
        Boolean(entry.startsAt)
    );

  const todayAppointments = allUpcomingAppointments
    .filter((entry) => entry.startsAt >= todayStart && entry.startsAt <= todayEnd)
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());

  const futureAppointments = allUpcomingAppointments
    .filter((entry) => entry.startsAt >= now)
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());

  const nextAppointments = futureAppointments.slice(0, 5).map((entry) => ({
    id: entry.appointment.id,
    clientId: entry.client.id,
    clientName: getClientName(entry.client),
    startsAt: entry.appointment.inicioEm,
    startsLabel: formatAppointmentLabel(entry.startsAt, now),
    statusLabel: formatStatusLabel(entry.appointment.status),
    tab: "agenda" as const,
  }));

  const todayAgenda = todayAppointments.slice(0, 5).map((entry) => ({
    id: entry.appointment.id,
    clientId: entry.client.id,
    clientName: getClientName(entry.client),
    startsAt: entry.appointment.inicioEm,
    startsLabel: formatAppointmentLabel(entry.startsAt, now),
    statusLabel: formatStatusLabel(entry.appointment.status),
    tab: "agenda" as const,
  }));

  const overdueAppointmentsCount = allUpcomingAppointments.filter((entry) => entry.startsAt < now).length;

  const pendingPatients = clients
    .filter((client) => client.journey && client.journey.stage !== "em-acompanhamento")
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

  const attentionItems = pendingPatients.slice(0, 5).map((client) => ({
    id: client.id,
    clientId: client.id,
    clientName: getClientName(client),
    stageLabel: client.journey?.stageLabel || "Fluxo clinico",
    nextActionLabel: client.journey?.nextActionLabel || "Revisar prontuario",
    supporting:
      client.journey?.stage === "pre-consulta-pendente"
        ? "A pre-consulta ainda nao voltou."
        : client.journey?.stage === "avaliacao-pendente"
        ? hasFichaRegistrada(client)
          ? "A ficha existe, mas ainda falta fechar a avaliacao."
          : "Ainda falta preencher a ficha clinica."
        : client.journey?.stage === "retorno-pendente"
        ? "Ja houve avaliacao, mas ainda falta proxima sessao."
        : "Paciente pronta para comecar o fluxo.",
    tone: client.journey?.tone || "neutral",
    tab: client.journey?.nextTab || "perfil",
  }));

  const financeItems = clients
    .flatMap((client) =>
      client.homecare
        .filter((item) => !item.pago)
        .map((item) => ({
          id: item.id,
          clientId: client.id,
          clientName: getClientName(client),
          amount: item.valorTotal || 0,
          amountLabel:
            typeof item.valorTotal === "number"
              ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.valorTotal)
              : "Valor nao informado",
          description: item.produtosRecomendados || "Homecare pendente",
          supporting: item.dataRetornoSugerida
            ? `Retorno sugerido em ${new Date(item.dataRetornoSugerida).toLocaleDateString("pt-BR")}`
            : "Sem data de retorno definida.",
          tab: "pos-venda" as const,
        }))
    )
    .sort((left, right) => right.amount - left.amount);

  const recentFichaItems = clients
    .filter((client) => hasFichaRegistrada(client))
    .map((client) => ({
      client,
      updatedAt: parseDate(client.updatedAt),
    }))
    .filter((entry): entry is { client: Client; updatedAt: Date } => Boolean(entry.updatedAt))
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());

  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  const recentFichaUpdatesCount = recentFichaItems.filter((entry) => entry.updatedAt >= sevenDaysAgo).length;
  const recentFichaRecords = recentFichaItems.slice(0, 5).map((entry) => ({
    id: entry.client.id,
    clientId: entry.client.id,
    clientName: getClientName(entry.client),
    updatedAt: entry.client.updatedAt,
    updatedLabel: formatRecordLabel(entry.updatedAt, now),
    description: entry.client.journey?.stage === "em-acompanhamento" ? "Prontuario em acompanhamento." : "Vale revisar a evolucao antes do proximo contato.",
    tab: "anamnese" as const,
  }));

  const missingFichaCount = clients.filter((client) => !hasFichaRegistrada(client)).length;
  const pendingPatientsCount = pendingPatients.length;
  const overdueAndPendingCount = new Set([
    ...pendingPatients.map((client) => client.id),
    ...allUpcomingAppointments.filter((entry) => entry.startsAt < now).map((entry) => entry.client.id),
  ]).size;
  const pendingHomecareCount = financeItems.length;
  const upcomingAppointmentsCount = futureAppointments.length;
  const activePatientsCount = clients.length;
  const todayAppointmentsCount = todayAppointments.length;

  let heroHeadline = "Tudo pronto para um atendimento acolhedor e bem conduzido";
  let heroDescription = "A home reune as prioridades da agenda, da evolucao clinica e do acompanhamento da paciente em um so lugar.";

  if (activePatientsCount === 0) {
    heroHeadline = "Pronta para receber as primeiras pacientes";
    heroDescription = "Assim que os cadastros entrarem, a home passa a destacar retornos, fichas pendentes e proximos cuidados.";
  } else if (todayAppointmentsCount > 0) {
    heroHeadline = `${todayAppointmentsCount} atendimento${todayAppointmentsCount === 1 ? "" : "s"} pedem preparo hoje`;
    heroDescription = "Use a agenda do dia para revisar a ficha, alinhar pendencias e conduzir cada jornada com mais seguranca.";
  } else if (overdueAndPendingCount > 0) {
    heroHeadline = `${overdueAndPendingCount} paciente${overdueAndPendingCount === 1 ? "" : "s"} merecem atencao`;
    heroDescription = "O foco agora esta em fichas incompletas, retornos sem continuidade ou compromissos que pedem reacendimento do cuidado.";
  } else if (upcomingAppointmentsCount > 0) {
    heroHeadline = `${upcomingAppointmentsCount} compromisso${upcomingAppointmentsCount === 1 ? "" : "s"} ja esta${upcomingAppointmentsCount === 1 ? "" : "o"} programado${upcomingAppointmentsCount === 1 ? "" : "s"}`;
    heroDescription = "Aproveite esse intervalo para revisar a evolucao das pacientes e deixar o home care redondo.";
  }

  const stats: HomeStatCard[] = [
    {
      label: "Pacientes ativos",
      value: activePatientsCount,
      description: activePatientsCount > 0 ? "Base pronta para atendimento, evolucao e acompanhamento." : "Nenhuma paciente cadastrada ainda.",
      supporting: activePatientsCount > 0 ? "Os prontuarios ajudam a conduzir cada jornada com mais clareza." : "Comece criando o primeiro prontuario para dar contexto real a home.",
      badge: activePatientsCount > 0 ? "Base" : "Inicio",
      accent: activePatientsCount > 0 ? "default" : "warning",
    },
    {
      label: "Agenda de hoje",
      value: todayAppointmentsCount,
      description: todayAppointmentsCount > 0 ? "Sessoes que pedem preparo, conforto e leitura tecnica hoje." : "Nenhum atendimento marcado para hoje.",
      supporting: todayAppointmentsCount > 0 ? "Abra a agenda e revise observacoes importantes antes do horario." : "Aproveite a janela para atualizar fichas e follow-ups com calma.",
      badge: todayAppointmentsCount > 0 ? "Hoje" : "Livre",
      accent: todayAppointmentsCount > 0 ? "default" : "success",
    },
    {
      label: "Atrasados e pendentes",
      value: overdueAndPendingCount,
      description: overdueAppointmentsCount > 0 ? `${overdueAppointmentsCount} compromisso(s) ja passaram do horario.` : "Sem atrasos criticos na agenda.",
      supporting: pendingPatientsCount > 0 ? `${pendingPatientsCount} paciente(s) ainda pedem acao clinica.` : "Fluxo principal sem pendencias urgentes.",
      badge: overdueAndPendingCount > 0 ? "Foco" : "Em dia",
      accent: overdueAndPendingCount > 0 ? "warning" : "success",
    },
    {
      label: "Sem ficha completa",
      value: missingFichaCount,
      description: missingFichaCount > 0 ? "Pacientes que ainda precisam de avaliacao clinica completa." : "Todas as pacientes tem ficha registrada.",
      supporting: missingFichaCount > 0 ? "Vale priorizar esse preenchimento antes de avancar na conduta." : "A base clinica esta pronta para consulta e revisao.",
      badge: missingFichaCount > 0 ? "Ficha" : "Completo",
      accent: missingFichaCount > 0 ? "warning" : "success",
    },
    {
      label: "Homecare pendente",
      value: pendingHomecareCount,
      description: pendingHomecareCount > 0 ? "Cuidados em casa que ainda pedem ajuste, acerto ou retorno." : "Sem pendencias financeiras de homecare.",
      supporting: pendingHomecareCount > 0 ? "Use esse bloco para manter o acompanhamento vivo fora da clinica." : "O pos-venda esta em dia no momento.",
      badge: pendingHomecareCount > 0 ? "Caixa" : "Ok",
      accent: pendingHomecareCount > 0 ? "warning" : "success",
    },
    {
      label: "Fichas recentes",
      value: recentFichaUpdatesCount,
      description: recentFichaUpdatesCount > 0 ? "Prontuarios atualizados nos ultimos 7 dias." : "Nenhuma ficha atualizada na ultima semana.",
      supporting: recentFichaUpdatesCount > 0 ? "Bom bloco para revisar evolucao, resposta terapeutica e retorno das pacientes." : "Quando a equipe atualizar fichas, elas aparecem aqui.",
      badge: recentFichaUpdatesCount > 0 ? "Recente" : "Historico",
      accent: recentFichaUpdatesCount > 0 ? "default" : "success",
    },
  ];

  return {
    heroHeadline,
    heroDescription,
    stats,
    todayAgenda,
    nextAppointments,
    attentionItems,
    financeItems: financeItems.slice(0, 5),
    recentFichaItems: recentFichaRecords,
    activePatientsCount,
    todayAppointmentsCount,
    overdueAppointmentsCount,
    pendingPatientsCount,
    overdueAndPendingCount,
    missingFichaCount,
    pendingHomecareCount,
    recentFichaUpdatesCount,
    upcomingAppointmentsCount,
  };
}
