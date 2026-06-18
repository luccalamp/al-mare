"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Client } from "@/types";
import BrandLogo from "@/components/BrandLogo";
import ChartSurface from "@/components/charts/ChartSurface";
import RecoveryConsole from "@/components/RecoveryConsole";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  Line,
} from "recharts";
import {
  DollarSign,
  Users,
  Scissors,
  CalendarRange,
  TrendingUp,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  Clock,
} from "lucide-react";

interface DashboardWindowProps {
  clients: Client[];
  onClose: () => void;
}

type AnalyticsClient = Pick<Client, "id" | "profile" | "colorimetrias" | "homecare" | "createdAt" | "updatedAt">;

type DashboardProcedureRow = {
  id: string;
  created_at: string;
  tecnica_utilizada?: string;
  altura_clareamento: number;
  fundo_clareamento_obtido: string;
  mistura_tonalizante: string;
  volumagem_ox: string;
  valor_procedimento?: number;
  deleted_at?: string | null;
};

type DashboardHomecareRow = {
  id: string;
  created_at: string;
  produtos_recomendados: string;
  data_retorno_sugerida?: string;
  obs_cuidados?: string;
  valor_total?: number | null;
  forma_pagamento?: "normal" | "avista" | "parcelado";
  parcelas?: number | null;
  pago?: boolean;
  confirmado_em?: string | null;
  deleted_at?: string | null;
};

type DashboardClientRow = {
  id: string;
  nome?: string;
  whatsapp?: string;
  canal_aquisicao?: string;
  created_at: string;
  updated_at: string;
  historico_procedimentos?: DashboardProcedureRow[] | null;
  manutencao_homecare?: DashboardHomecareRow[] | null;
};

type DashboardClientsResponse = {
  clients?: DashboardClientRow[];
};

type DatePreset = "7d" | "30d" | "all" | "custom";
type TrendDirection = "up" | "down" | "stable";

type DateWindow = {
  start: Date;
  end: Date;
  usesDailyBuckets: boolean;
  label: string;
  comparisonEnabled: boolean;
};

type NumericComparison = {
  current: number;
  previous: number;
  deltaPercent: number;
  trend: TrendDirection;
  available: boolean;
  baselineZero: boolean;
};

type RevenuePoint = {
  key: string;
  label: string;
  sortKey: number;
  procedureRevenue: number;
  homecareConfirmedRevenue: number;
  homecarePendingRevenue: number;
  realizedRevenue: number;
  potentialRevenue: number;
  procedureCount: number;
};

type TechniqueMetric = {
  name: string;
  revenue: number;
  count: number;
  avgTicket: number;
  share: number;
};

type LeadSourceMetric = {
  name: string;
  value: number;
  share: number;
};

type MixMetric = {
  name: string;
  value: number;
  pct: number;
  color: string;
  description: string;
};

type InsightItem = {
  label: string;
  value: string;
  description: string;
};

type WindowSnapshot = {
  realizedRevenue: number;
  pendingRevenue: number;
  procedureRevenue: number;
  procedureCount: number;
  activeClientsWithRevenue: number;
  avgTicket: number;
  totalHomecareCount: number;
  homecareConfirmedCount: number;
  homecarePendingCount: number;
  homecareCountConfirmationRate: number;
};

type FinancialMetrics = WindowSnapshot & {
  potentialRevenue: number;
  homecareConfirmedRevenue: number;
  revenuePerClient: number;
  dailyAverageRevenue: number;
  homecareValueConfirmationRate: number;
  trendData: RevenuePoint[];
  techniqueData: TechniqueMetric[];
  leadSourceData: LeadSourceMetric[];
  mixData: MixMetric[];
  insightItems: InsightItem[];
  capturedClientsCount: number;
  bestBucket: RevenuePoint | null;
  topTechnique: TechniqueMetric | null;
};

type KpiCardProps = {
  label: string;
  value: string;
  description: string;
  supporting: string;
  icon: ReactNode;
  iconClassName: string;
  surfaceClassName: string;
  comparison?: NumericComparison;
};

type InsightTileProps = {
  label: string;
  value: string;
  description: string;
};

const FINANCE_COLORS = {
  procedure: "#7A4921",
  homecareConfirmed: "#5D7A63",
  homecarePending: "#D2A679",
  realizedLine: "#315C48",
  accent: "#A56D3A",
  neutral: "#B98555",
} as const;

const EMPTY_PROFILE: Client["profile"] = {
  nome: "",
  whatsapp: "",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function formatCurrencyFull(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatCurrencyCompact(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number, digits = 0) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value / 100);
}

function formatSignedPercent(value: number, digits = 0) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const prefix = safeValue > 0 ? "+" : "";
  return `${prefix}${formatPercent(safeValue, digits)}`;
}

function normalizeAnalyticsClient(client: AnalyticsClient): AnalyticsClient {
  return {
    ...client,
    profile: client.profile ?? EMPTY_PROFILE,
    colorimetrias: Array.isArray(client.colorimetrias) ? client.colorimetrias : [],
    homecare: Array.isArray(client.homecare) ? client.homecare : [],
  };
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function diffDaysInclusive(start: Date, end: Date) {
  const startTime = startOfDay(start).getTime();
  const endTime = startOfDay(end).getTime();
  return Math.max(1, Math.floor((endTime - startTime) / 86_400_000) + 1);
}

function getTrendDirection(deltaPercent: number, threshold = 3): TrendDirection {
  if (deltaPercent > threshold) return "up";
  if (deltaPercent < -threshold) return "down";
  return "stable";
}

function getEarliestRecordDate(clients: AnalyticsClient[]) {
  let earliest: Date | null = null;

  const applyCandidate = (value?: string | null) => {
    if (!value) return;
    const candidate = new Date(value);
    if (Number.isNaN(candidate.getTime())) return;
    if (!earliest || candidate < earliest) earliest = candidate;
  };

  clients.forEach((client) => {
    applyCandidate(client.createdAt);
    client.colorimetrias.forEach((procedure) => applyCandidate(procedure.data));
    client.homecare.forEach((homecare) => applyCandidate(homecare.data));
  });

  return earliest;
}

function getSelectedWindow(
  clients: AnalyticsClient[],
  preset: DatePreset,
  customStart: string,
  customEnd: string
): DateWindow {
  const now = new Date();

  if (preset === "7d" || preset === "30d") {
    const days = preset === "7d" ? 7 : 30;
    const start = startOfDay(now);
    start.setDate(start.getDate() - (days - 1));

    return {
      start,
      end: now,
      usesDailyBuckets: true,
      label: preset === "7d" ? "Ultimos 7 dias" : "Ultimos 30 dias",
      comparisonEnabled: true,
    };
  }

  const earliest = getEarliestRecordDate(clients) ?? startOfDay(now);

  if (preset === "all") {
    const start = startOfDay(earliest);
    const days = diffDaysInclusive(start, now);

    return {
      start,
      end: now,
      usesDailyBuckets: days <= 45,
      label: "Todo o historico",
      comparisonEnabled: false,
    };
  }

  const rawStart = customStart ? new Date(`${customStart}T00:00:00`) : startOfDay(earliest);
  const rawEnd = customEnd ? new Date(`${customEnd}T23:59:59`) : now;

  const start = rawStart <= rawEnd ? rawStart : rawEnd;
  const end = rawEnd >= rawStart ? rawEnd : rawStart;
  const days = diffDaysInclusive(start, end);

  return {
    start,
    end,
    usesDailyBuckets: days <= 45,
    label: `${start.toLocaleDateString("pt-BR")} ate ${end.toLocaleDateString("pt-BR")}`,
    comparisonEnabled: Boolean(customStart && customEnd),
  };
}

function isWithinWindow(value: string, window: DateWindow) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= window.start && date <= window.end;
}

function getBucketMeta(date: Date, usesDailyBuckets: boolean) {
  if (usesDailyBuckets) {
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      sortKey: startOfDay(date).getTime(),
    };
  }

  const bucketDate = new Date(date.getFullYear(), date.getMonth(), 1);
  return {
    key: `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, "0")}`,
    label: bucketDate.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
    sortKey: bucketDate.getTime(),
  };
}

function computeNumericComparison(current: number, previous: number): NumericComparison {
  if (previous === 0 && current === 0) {
    return {
      current,
      previous,
      deltaPercent: 0,
      trend: "stable",
      available: true,
      baselineZero: false,
    };
  }

  if (previous === 0) {
    return {
      current,
      previous,
      deltaPercent: 100,
      trend: "up",
      available: true,
      baselineZero: true,
    };
  }

  const deltaPercent = ((current - previous) / previous) * 100;

  return {
    current,
    previous,
    deltaPercent,
    trend: getTrendDirection(deltaPercent),
    available: true,
    baselineZero: false,
  };
}

function unavailableComparison(current: number): NumericComparison {
  return {
    current,
    previous: 0,
    deltaPercent: 0,
    trend: "stable",
    available: false,
    baselineZero: false,
  };
}

function summarizeWindow(clients: AnalyticsClient[], window: DateWindow): WindowSnapshot {
  let procedureRevenue = 0;
  let procedureCount = 0;
  let confirmedHomecareRevenue = 0;
  let pendingHomecareRevenue = 0;
  let totalHomecareCount = 0;
  let homecareConfirmedCount = 0;
  let homecarePendingCount = 0;
  const activeClients = new Set<string>();

  clients.forEach((client) => {
    client.colorimetrias.forEach((procedure) => {
      if (!isWithinWindow(procedure.data, window)) return;
      procedureRevenue += procedure.valor || 0;
      procedureCount += 1;
      activeClients.add(client.id);
    });

    client.homecare.forEach((homecare) => {
      if (!isWithinWindow(homecare.data, window)) return;
      totalHomecareCount += 1;
      activeClients.add(client.id);

      if (homecare.pago) {
        confirmedHomecareRevenue += homecare.valorTotal || 0;
        homecareConfirmedCount += 1;
        return;
      }

      pendingHomecareRevenue += homecare.valorTotal || 0;
      homecarePendingCount += 1;
    });
  });

  return {
    realizedRevenue: procedureRevenue + confirmedHomecareRevenue,
    pendingRevenue: pendingHomecareRevenue,
    procedureRevenue,
    procedureCount,
    activeClientsWithRevenue: activeClients.size,
    avgTicket: procedureCount > 0 ? procedureRevenue / procedureCount : 0,
    totalHomecareCount,
    homecareConfirmedCount,
    homecarePendingCount,
    homecareCountConfirmationRate:
      totalHomecareCount > 0 ? (homecareConfirmedCount / totalHomecareCount) * 100 : 0,
  };
}

function truncateLabel(value: string, maxLength = 16) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}...`;
}

function getComparisonAccent(trend: TrendDirection) {
  if (trend === "up") return "text-emerald-600";
  if (trend === "down") return "text-rose-500";
  return "text-gray-400";
}

function KpiCard({
  label,
  value,
  description,
  supporting,
  icon,
  iconClassName,
  surfaceClassName,
  comparison,
}: KpiCardProps) {
  const ComparisonIcon =
    comparison?.trend === "up"
      ? ArrowUpRight
      : comparison?.trend === "down"
      ? ArrowDownRight
      : Minus;

  return (
    <div
      className={`rounded-3xl border p-5 shadow-[0_12px_34px_rgba(94,58,28,0.06)] transition-all hover:bg-white/75 hover:shadow-[0_16px_40px_rgba(94,58,28,0.1)] ${surfaceClassName}`}
    >
      <div className={`flex items-center gap-2 ${iconClassName}`}>
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>

      <span className="mt-3 block text-2xl font-black text-[#1d1d1f]">{value}</span>
      <p className="mt-2 text-sm font-medium text-[var(--color-text)]">{description}</p>

      {comparison ? (
        <div className={`mt-2 flex items-center gap-1 text-[10px] font-semibold ${getComparisonAccent(comparison.trend)}`}>
          <ComparisonIcon size={12} />
          {!comparison.available
            ? "Comparacao indisponivel para este recorte"
            : comparison.baselineZero
            ? "Sem base no periodo anterior"
            : `${formatSignedPercent(comparison.deltaPercent, 0)} vs periodo anterior`}
        </div>
      ) : null}

      <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{supporting}</p>
    </div>
  );
}

function InsightTile({ label, value, description }: InsightTileProps) {
  return (
    <div className="rounded-[22px] border border-white/70 bg-white/70 px-4 py-4 shadow-[0_10px_28px_rgba(94,58,28,0.05)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">{label}</p>
      <strong className="mt-2 block text-lg font-semibold text-[var(--color-ink)]">{value}</strong>
      <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">{description}</p>
    </div>
  );
}

export default function DashboardWindow({ clients, onClose }: DashboardWindowProps) {
  const [allClients, setAllClients] = useState<AnalyticsClient[] | null>(null);
  const [preset, setPreset] = useState<DatePreset>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  useEffect(() => {
    fetch("/api/clients?includeArchived=true")
      .then((res) => res.json() as Promise<DashboardClientsResponse>)
      .then((data) => {
        const rawClients = Array.isArray(data.clients) ? data.clients : [];
        const transformed = rawClients.map<AnalyticsClient>((row) => ({
          id: row.id,
          profile: {
            ...EMPTY_PROFILE,
            nome: row.nome || "",
            whatsapp: row.whatsapp || "",
            acquisitionChannel: row.canal_aquisicao || undefined,
          },
          colorimetrias: Array.isArray(row.historico_procedimentos)
            ? row.historico_procedimentos
                .filter((item) => !item.deleted_at)
                .map((procedure) => ({
                  id: procedure.id,
                  data: procedure.created_at,
                  tecnicaUtilizada: procedure.tecnica_utilizada || "",
                  alturaClareamento: procedure.altura_clareamento,
                  fundoClareamentoObtido: procedure.fundo_clareamento_obtido,
                  misturaTonalizante: procedure.mistura_tonalizante,
                  volumagemOx: procedure.volumagem_ox,
                  valor: procedure.valor_procedimento,
                }))
            : [],
          homecare: Array.isArray(row.manutencao_homecare)
            ? row.manutencao_homecare
                .filter((item) => !item.deleted_at)
                .map((homecare) => ({
                  id: homecare.id,
                  data: homecare.created_at,
                  produtosRecomendados: homecare.produtos_recomendados,
                  dataRetornoSugerida: homecare.data_retorno_sugerida,
                  obsCuidados: homecare.obs_cuidados,
                  valorTotal: homecare.valor_total ?? undefined,
                  formaPagamento: homecare.forma_pagamento ?? undefined,
                  parcelas: homecare.parcelas ?? undefined,
                  pago: homecare.pago ?? undefined,
                  confirmadoEm: homecare.confirmado_em ?? undefined,
                }))
            : [],
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));

        setAllClients(transformed);
      })
      .catch(() => setAllClients([]));
  }, []);

  const effectiveClients = useMemo(
    () => (allClients ?? clients ?? []).map(normalizeAnalyticsClient),
    [allClients, clients]
  );

  const selectedWindow = useMemo(
    () => getSelectedWindow(effectiveClients, preset, customStart, customEnd),
    [customEnd, customStart, effectiveClients, preset]
  );

  const previousWindow = useMemo(() => {
    if (!selectedWindow.comparisonEnabled) return null;

    const days = diffDaysInclusive(selectedWindow.start, selectedWindow.end);
    const previousEnd = new Date(selectedWindow.start.getTime() - 1);
    const previousStart = startOfDay(previousEnd);
    previousStart.setDate(previousStart.getDate() - (days - 1));

    return {
      ...selectedWindow,
      start: previousStart,
      end: previousEnd,
      comparisonEnabled: false,
    };
  }, [selectedWindow]);

  const currentSnapshot = useMemo(
    () => summarizeWindow(effectiveClients, selectedWindow),
    [effectiveClients, selectedWindow]
  );

  const previousSnapshot = useMemo(
    () => (previousWindow ? summarizeWindow(effectiveClients, previousWindow) : null),
    [effectiveClients, previousWindow]
  );

  const comparisons = useMemo(
    () => ({
      realizedRevenue: previousSnapshot
        ? computeNumericComparison(currentSnapshot.realizedRevenue, previousSnapshot.realizedRevenue)
        : unavailableComparison(currentSnapshot.realizedRevenue),
      avgTicket: previousSnapshot
        ? computeNumericComparison(currentSnapshot.avgTicket, previousSnapshot.avgTicket)
        : unavailableComparison(currentSnapshot.avgTicket),
      activeClients: previousSnapshot
        ? computeNumericComparison(currentSnapshot.activeClientsWithRevenue, previousSnapshot.activeClientsWithRevenue)
        : unavailableComparison(currentSnapshot.activeClientsWithRevenue),
      homecareRate: previousSnapshot
        ? computeNumericComparison(
            currentSnapshot.homecareCountConfirmationRate,
            previousSnapshot.homecareCountConfirmationRate
          )
        : unavailableComparison(currentSnapshot.homecareCountConfirmationRate),
    }),
    [currentSnapshot, previousSnapshot]
  );

  const metrics = useMemo<FinancialMetrics>(() => {
    const trendBuckets = new Map<string, RevenuePoint>();
    const techniqueMap = new Map<string, { revenue: number; count: number }>();
    const leadSourceCount: Record<string, number> = {};
    let capturedClientsCount = 0;
    let homecareConfirmedRevenue = 0;
    let homecarePendingRevenue = 0;

    const ensureBucket = (date: Date) => {
      const meta = getBucketMeta(date, selectedWindow.usesDailyBuckets);
      const existing = trendBuckets.get(meta.key);
      if (existing) return existing;

      const next: RevenuePoint = {
        key: meta.key,
        label: meta.label,
        sortKey: meta.sortKey,
        procedureRevenue: 0,
        homecareConfirmedRevenue: 0,
        homecarePendingRevenue: 0,
        realizedRevenue: 0,
        potentialRevenue: 0,
        procedureCount: 0,
      };

      trendBuckets.set(meta.key, next);
      return next;
    };

    effectiveClients.forEach((client) => {
      if (isWithinWindow(client.createdAt, selectedWindow)) {
        const source = client.profile.acquisitionChannel || "Nao informado";
        leadSourceCount[source] = (leadSourceCount[source] || 0) + 1;
        capturedClientsCount += 1;
      }

      client.colorimetrias.forEach((procedure) => {
        if (!isWithinWindow(procedure.data, selectedWindow)) return;

        const value = procedure.valor || 0;
        const bucket = ensureBucket(new Date(procedure.data));
        bucket.procedureRevenue += value;
        bucket.realizedRevenue += value;
        bucket.potentialRevenue += value;
        bucket.procedureCount += 1;

        const technique = procedure.tecnicaUtilizada || "Nao informado";
        const current = techniqueMap.get(technique) ?? { revenue: 0, count: 0 };
        current.revenue += value;
        current.count += 1;
        techniqueMap.set(technique, current);
      });

      client.homecare.forEach((homecare) => {
        if (!isWithinWindow(homecare.data, selectedWindow)) return;

        const value = homecare.valorTotal || 0;
        const bucket = ensureBucket(new Date(homecare.data));

        if (homecare.pago) {
          bucket.homecareConfirmedRevenue += value;
          bucket.realizedRevenue += value;
          bucket.potentialRevenue += value;
          homecareConfirmedRevenue += value;
          return;
        }

        bucket.homecarePendingRevenue += value;
        bucket.potentialRevenue += value;
        homecarePendingRevenue += value;
      });
    });

    const procedureRevenue = currentSnapshot.procedureRevenue;
    const realizedRevenue = currentSnapshot.realizedRevenue;
    const pendingRevenue = currentSnapshot.pendingRevenue;
    const potentialRevenue = realizedRevenue + pendingRevenue;

    const trendData = Array.from(trendBuckets.values()).sort((left, right) => left.sortKey - right.sortKey);

    const techniqueData = Array.from(techniqueMap.entries())
      .map(([name, data]) => ({
        name,
        revenue: data.revenue,
        count: data.count,
        avgTicket: data.count > 0 ? data.revenue / data.count : 0,
        share: procedureRevenue > 0 ? (data.revenue / procedureRevenue) * 100 : 0,
      }))
      .sort((left, right) => right.revenue - left.revenue);

    const leadSourceData = Object.entries(leadSourceCount)
      .map(([name, value]) => ({
        name,
        value,
        share: capturedClientsCount > 0 ? (value / capturedClientsCount) * 100 : 0,
      }))
      .sort((left, right) => right.value - left.value);

    const mixData = [
      {
        name: "Procedimentos",
        value: procedureRevenue,
        pct: potentialRevenue > 0 ? (procedureRevenue / potentialRevenue) * 100 : 0,
        color: FINANCE_COLORS.procedure,
        description: "Receita de servicos executados.",
      },
      {
        name: "Homecare confirmado",
        value: homecareConfirmedRevenue,
        pct: potentialRevenue > 0 ? (homecareConfirmedRevenue / potentialRevenue) * 100 : 0,
        color: FINANCE_COLORS.homecareConfirmed,
        description: "Produtos ja convertidos em receita.",
      },
      {
        name: "Homecare em aberto",
        value: pendingRevenue,
        pct: potentialRevenue > 0 ? (pendingRevenue / potentialRevenue) * 100 : 0,
        color: FINANCE_COLORS.homecarePending,
        description: "Receita potencial ainda nao confirmada.",
      },
    ].filter((item) => item.value > 0);

    const bestBucket =
      trendData.length > 0
        ? trendData.reduce((best, current) => (current.realizedRevenue > best.realizedRevenue ? current : best))
        : null;

    const topTechnique = techniqueData[0] ?? null;
    const totalWindowDays = diffDaysInclusive(selectedWindow.start, selectedWindow.end);
    const revenuePerClient =
      currentSnapshot.activeClientsWithRevenue > 0
        ? realizedRevenue / currentSnapshot.activeClientsWithRevenue
        : 0;

    const homecareValueConfirmationRate =
      homecareConfirmedRevenue + homecarePendingRevenue > 0
        ? (homecareConfirmedRevenue / (homecareConfirmedRevenue + homecarePendingRevenue)) * 100
        : 0;

    const insightItems: InsightItem[] = [
      {
        label: "Maior motor",
        value: topTechnique ? topTechnique.name : "Sem tecnica lider",
        description: topTechnique
          ? `${formatPercent(topTechnique.share, 1)} da receita de procedimentos e ticket medio de ${formatCurrency(topTechnique.avgTicket)}.`
          : "Sem procedimentos registrados no recorte atual.",
      },
      {
        label: selectedWindow.usesDailyBuckets ? "Melhor dia" : "Melhor mes",
        value: bestBucket ? bestBucket.label : "Sem pico de receita",
        description: bestBucket
          ? `${formatCurrency(bestBucket.realizedRevenue)} realizados nessa janela.`
          : "Assim que houver receita no periodo, o pico aparece aqui.",
      },
      {
        label: "Media realizada",
        value: formatCurrency(realizedRevenue / totalWindowDays),
        description: `${formatCount(currentSnapshot.activeClientsWithRevenue)} cliente(s) geraram caixa no periodo selecionado.`,
      },
    ];

    return {
      ...currentSnapshot,
      potentialRevenue,
      homecareConfirmedRevenue,
      revenuePerClient,
      dailyAverageRevenue: realizedRevenue / totalWindowDays,
      homecareValueConfirmationRate,
      trendData,
      techniqueData,
      leadSourceData,
      mixData,
      insightItems,
      capturedClientsCount,
      bestBucket,
      topTechnique,
    };
  }, [currentSnapshot, effectiveClients, selectedWindow]);

  const pendingShareOfPotential =
    metrics.potentialRevenue > 0 ? (metrics.pendingRevenue / metrics.potentialRevenue) * 100 : 0;
  const proceduresShareOfRealized =
    metrics.realizedRevenue > 0 ? (metrics.procedureRevenue / metrics.realizedRevenue) * 100 : 0;
  const homecareShareOfRealized =
    metrics.realizedRevenue > 0 ? (metrics.homecareConfirmedRevenue / metrics.realizedRevenue) * 100 : 0;

  const financeCards = useMemo<KpiCardProps[]>(
    () => [
      {
        label: "Receita realizada",
        value: formatCurrency(metrics.realizedRevenue),
        description: "Procedimentos executados somados ao homecare confirmado.",
        supporting: metrics.bestBucket
          ? `Melhor janela: ${metrics.bestBucket.label} com ${formatCurrency(metrics.bestBucket.realizedRevenue)}.`
          : "Sem receita realizada no periodo selecionado.",
        icon: <DollarSign size={16} />,
        iconClassName: "text-[#7A4921]",
        surfaceClassName: "bg-white/55 border-white/70",
        comparison: comparisons.realizedRevenue,
      },
      {
        label: "Receita em aberto",
        value: formatCurrency(metrics.pendingRevenue),
        description:
          metrics.pendingRevenue > 0
            ? "Valor que ainda pode virar caixa apos confirmacao."
            : "Nao ha receita pendente de homecare neste recorte.",
        supporting: `${formatPercent(pendingShareOfPotential, 1)} do potencial financeiro ainda esta em aberto.`,
        icon: <Clock size={16} />,
        iconClassName: "text-amber-600",
        surfaceClassName: "bg-amber-50/70 border-amber-200/80",
      },
      {
        label: "Ticket medio",
        value: formatCurrency(metrics.avgTicket),
        description: `${formatCount(metrics.procedureCount)} procedimento(s) executados no periodo.`,
        supporting: "Mede quanto cada servico rendeu em media antes do homecare.",
        icon: <Scissors size={16} />,
        iconClassName: "text-emerald-600",
        surfaceClassName: "bg-emerald-50/60 border-emerald-200/70",
        comparison: comparisons.avgTicket,
      },
      {
        label: "Clientes com receita",
        value: formatCount(metrics.activeClientsWithRevenue),
        description: "Base que efetivamente gerou faturamento no recorte.",
        supporting: `Receita media de ${formatCurrency(metrics.revenuePerClient)} por cliente com compra.`,
        icon: <Users size={16} />,
        iconClassName: "text-[var(--color-brand-deep)]",
        surfaceClassName: "bg-[rgba(122,73,33,0.08)] border-[rgba(122,73,33,0.18)]",
        comparison: comparisons.activeClients,
      },
      {
        label: "Confirmacao homecare",
        value: formatPercent(metrics.homecareValueConfirmationRate, 0),
        description: `${formatCount(metrics.homecareConfirmedCount)} de ${formatCount(metrics.totalHomecareCount)} prescricoes viraram receita.`,
        supporting: `Por quantidade, a taxa ficou em ${formatPercent(metrics.homecareCountConfirmationRate, 1)}.`,
        icon: <CheckCircle size={16} />,
        iconClassName: "text-[#5D7A63]",
        surfaceClassName: "bg-[#f4fbf6] border-[#cfe5d5]",
        comparison: comparisons.homecareRate,
      },
    ],
    [comparisons, metrics, pendingShareOfPotential]
  );

  const ticketChartData = useMemo(
    () => [...metrics.techniqueData].sort((left, right) => right.avgTicket - left.avgTicket).slice(0, 5),
    [metrics.techniqueData]
  );

  return (
    <AnimatePresence>
      <motion.div
        className="premium-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="premium-window relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px]"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="premium-window-header flex shrink-0 items-center gap-3 px-4 py-4 sm:px-6">
            <button onClick={onClose} className="h-5 w-5 rounded-full bg-[#ff5f57] sm:h-3 sm:w-3" />
            <div className="flex flex-1 items-center justify-center gap-3">
              <TrendingUp size={16} className="text-[var(--color-brand-accent)]" />
              <BrandLogo compact />
            </div>
            <div className="w-8" />
          </div>

          <div className="flex-1 space-y-8 overflow-y-auto p-4 sm:p-8">
            <div className="premium-card rounded-[28px] p-4 sm:p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">
                    Painel financeiro
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)]">
                    Receita, ticket, mix de servicos e conversao de homecare
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                    {selectedWindow.label} · {formatCount(metrics.activeClientsWithRevenue)} cliente(s) com receita ·{" "}
                    {formatCurrency(metrics.realizedRevenue)} realizados
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {([
                    ["7d", "Semanal"],
                    ["30d", "Mensal"],
                    ["all", "Tudo"],
                    ["custom", "Personalizado"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPreset(value)}
                      className={`premium-chip px-4 py-2 text-xs font-semibold transition-colors ${
                        preset === value ? "is-active" : "text-[var(--color-brand-deep)]"
                      }`}
                      data-active={preset === value}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {preset === "custom" && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                    Inicio
                    <input
                      type="date"
                      value={customStart}
                      onChange={(event) => setCustomStart(event.target.value)}
                      className="input-light mt-2"
                    />
                  </label>

                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                    Fim
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(event) => setCustomEnd(event.target.value)}
                      className="input-light mt-2"
                    />
                  </label>
                </div>
              )}

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {metrics.insightItems.map((item) => (
                  <InsightTile
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    description={item.description}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              {financeCards.map((card) => (
                <KpiCard key={card.label} {...card} />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.6fr_1fr]">
              <div className="rounded-[32px] border border-white/70 bg-white/55 p-6 shadow-[0_16px_40px_rgba(94,58,28,0.06)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#1d1d1f]">
                      Fluxo financeiro do periodo
                    </h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                      Linha = receita realizada. Barras = composicao do que entrou por servicos,
                      homecare confirmado e homecare em aberto.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-deep)]">
                    <CalendarRange size={12} />
                    {selectedWindow.label}
                  </div>
                </div>

                {metrics.trendData.length > 0 ? (
                  <ChartSurface className="mt-5 h-[22rem] w-full min-w-0" minHeight="22rem">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                      <ComposedChart data={metrics.trendData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="rgba(122,73,33,0.08)" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fontWeight: 700 }}
                          axisLine={false}
                          tickLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 10, fontWeight: 600, fill: "#6b7280" }}
                          tickFormatter={(value) => formatCurrencyCompact(Number(value))}
                          axisLine={false}
                          tickLine={false}
                          width={72}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(122,73,33,0.05)" }}
                          contentStyle={{
                            borderRadius: "20px",
                            border: "1px solid rgba(122,73,33,0.12)",
                            boxShadow: "0 12px 32px rgba(0,0,0,0.08)",
                            background: "rgba(255,255,255,0.96)",
                          }}
                          formatter={(value) => formatCurrencyFull(Number(value ?? 0))}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                        <Bar
                          dataKey="procedureRevenue"
                          name="Procedimentos"
                          stackId="flow"
                          fill={FINANCE_COLORS.procedure}
                          radius={[6, 6, 0, 0]}
                        />
                        <Bar
                          dataKey="homecareConfirmedRevenue"
                          name="Homecare confirmado"
                          stackId="flow"
                          fill={FINANCE_COLORS.homecareConfirmed}
                        />
                        <Bar
                          dataKey="homecarePendingRevenue"
                          name="Homecare em aberto"
                          stackId="flow"
                          fill={FINANCE_COLORS.homecarePending}
                        />
                        <Line
                          type="monotone"
                          dataKey="realizedRevenue"
                          name="Receita realizada"
                          stroke={FINANCE_COLORS.realizedLine}
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ChartSurface>
                ) : (
                  <div className="flex h-[22rem] items-center justify-center text-sm font-medium text-gray-400">
                    Nenhuma movimentacao financeira no periodo selecionado.
                  </div>
                )}
              </div>

              <div className="rounded-[32px] border border-white/70 bg-white/55 p-6 shadow-[0_16px_40px_rgba(94,58,28,0.06)]">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#1d1d1f]">Mix da receita</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                  Percentual = categoria / potencial financeiro do periodo. Aqui voce enxerga
                  quanto ja entrou e quanto ainda esta pendente.
                </p>

                {metrics.mixData.length > 0 ? (
                  <div className="mt-4 grid gap-5 lg:grid-cols-[0.95fr_1.05fr] xl:grid-cols-1 2xl:grid-cols-[0.95fr_1.05fr]">
                    <ChartSurface className="h-64 w-full min-w-0" minHeight="16rem">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                        <PieChart>
                          <Pie
                            data={metrics.mixData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={58}
                            outerRadius={86}
                            paddingAngle={3}
                            animationDuration={800}
                          >
                            {metrics.mixData.map((item) => (
                              <Cell key={item.name} fill={item.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              borderRadius: "18px",
                              border: "1px solid rgba(122,73,33,0.12)",
                              boxShadow: "0 12px 32px rgba(0,0,0,0.08)",
                              background: "rgba(255,255,255,0.96)",
                            }}
                            formatter={(value) => formatCurrencyFull(Number(value ?? 0))}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartSurface>

                    <div className="space-y-3">
                      {metrics.mixData.map((item) => (
                        <div key={item.name} className="rounded-[20px] border border-white/70 bg-white/75 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="text-sm font-semibold text-[#1d1d1f]">{item.name}</span>
                            </div>
                            <span className="text-xs font-bold text-[var(--color-brand-accent)]">
                              {formatPercent(item.pct, 1)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-[var(--color-text)]">
                            {formatCurrency(item.value)}
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-64 items-center justify-center text-sm font-medium text-gray-400">
                    Sem receita suficiente para mostrar composicao.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_1fr]">
              <div className="rounded-[32px] border border-white/70 bg-white/55 p-6 shadow-[0_16px_40px_rgba(94,58,28,0.06)]">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#1d1d1f]">
                  Tecnicas que mais faturam
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                  Participacao calculada sobre a receita de procedimentos. Ajuda a ver o que
                  realmente sustenta o caixa de servicos.
                </p>

                {metrics.techniqueData.length > 0 ? (
                  <div className="mt-5 space-y-4">
                    {metrics.techniqueData.slice(0, 5).map((technique, index) => (
                      <div key={technique.name} className="rounded-[22px] border border-white/70 bg-white/72 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-black text-gray-400">#{index + 1}</span>
                              <h4 className="truncate text-sm font-semibold text-[#1d1d1f]">
                                {technique.name}
                              </h4>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold text-gray-500">
                              <span className="rounded-full bg-white/80 px-2.5 py-1">
                                {formatCount(technique.count)} procedimento(s)
                              </span>
                              <span className="rounded-full bg-white/80 px-2.5 py-1">
                                ticket medio {formatCurrency(technique.avgTicket)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-[var(--color-brand-accent)]">
                              {formatCurrency(technique.revenue)}
                            </p>
                            <p className="mt-1 text-[10px] font-semibold text-gray-500">
                              {formatPercent(technique.share, 1)} dos servicos
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 h-2 rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(technique.share, 2)}%`,
                              background: `linear-gradient(90deg, ${FINANCE_COLORS.procedure}, ${FINANCE_COLORS.neutral})`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center text-sm font-medium text-gray-400">
                    Nenhuma tecnica registrada no periodo.
                  </div>
                )}
              </div>

              <div className="rounded-[32px] border border-white/70 bg-white/55 p-6 shadow-[0_16px_40px_rgba(94,58,28,0.06)]">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#1d1d1f]">
                  Ticket medio por tecnica
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                  Compara o valor medio por procedimento entre as tecnicas mais relevantes.
                </p>

                {ticketChartData.length > 0 ? (
                  <ChartSurface className="mt-5 h-64 w-full min-w-0" minHeight="16rem">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                      <BarChart data={ticketChartData} margin={{ top: 10, right: 8, left: 0, bottom: 12 }}>
                        <CartesianGrid vertical={false} stroke="rgba(122,73,33,0.08)" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fontWeight: 700 }}
                          tickFormatter={(value) => truncateLabel(String(value), 12)}
                          axisLine={false}
                          tickLine={false}
                          interval={0}
                          height={48}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fontWeight: 600, fill: "#6b7280" }}
                          tickFormatter={(value) => formatCurrencyCompact(Number(value))}
                          axisLine={false}
                          tickLine={false}
                          width={72}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(122,73,33,0.05)" }}
                          contentStyle={{
                            borderRadius: "18px",
                            border: "1px solid rgba(122,73,33,0.12)",
                            boxShadow: "0 12px 32px rgba(0,0,0,0.08)",
                            background: "rgba(255,255,255,0.96)",
                          }}
                          formatter={(value) => formatCurrencyFull(Number(value ?? 0))}
                        />
                        <Bar
                          dataKey="avgTicket"
                          fill={FINANCE_COLORS.accent}
                          radius={[10, 10, 0, 0]}
                          barSize={34}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartSurface>
                ) : (
                  <div className="flex h-64 items-center justify-center text-sm font-medium text-gray-400">
                    Sem dados suficientes para comparar ticket medio.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_1fr]">
              <div className="rounded-[32px] border border-white/70 bg-white/55 p-6 shadow-[0_16px_40px_rgba(94,58,28,0.06)]">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#1d1d1f]">
                  Captacao do periodo
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                  Percentual = pacientes do canal / pacientes cadastrados no recorte. Este bloco
                  apoia a leitura comercial, nao entra no faturamento.
                </p>

                {metrics.leadSourceData.length > 0 ? (
                  <ChartSurface className="mt-5 h-64 w-full min-w-0" minHeight="16rem">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                      <BarChart
                        data={metrics.leadSourceData.slice(0, 6)}
                        layout="vertical"
                        margin={{ top: 4, right: 12, left: 16, bottom: 0 }}
                      >
                        <CartesianGrid horizontal={false} stroke="rgba(122,73,33,0.08)" />
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={112}
                          tick={{ fontSize: 10, fontWeight: 700 }}
                          tickFormatter={(value) => truncateLabel(String(value), 16)}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(122,73,33,0.05)" }}
                          contentStyle={{
                            borderRadius: "18px",
                            border: "1px solid rgba(122,73,33,0.12)",
                            boxShadow: "0 12px 32px rgba(0,0,0,0.08)",
                            background: "rgba(255,255,255,0.96)",
                          }}
                          formatter={(value, _name, item) => {
                            const source = item?.payload as LeadSourceMetric | undefined;
                            const share = source ? ` (${formatPercent(source.share, 1)})` : "";
                            return `${formatCount(Number(value ?? 0))} paciente(s)${share}`;
                          }}
                        />
                        <Bar dataKey="value" fill={FINANCE_COLORS.neutral} radius={[0, 10, 10, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartSurface>
                ) : (
                  <div className="flex h-64 items-center justify-center text-sm font-medium text-gray-400">
                    Nenhum cadastro novo no periodo selecionado.
                  </div>
                )}
              </div>

              <div className="rounded-[32px] border border-white/70 bg-white/55 p-6 shadow-[0_16px_40px_rgba(94,58,28,0.06)]">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#1d1d1f]">
                  Leitura financeira do periodo
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                  Aqui os percentuais sempre deixam claro qual e o denominador: realizado,
                  potencial ou base de homecare.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <div className="mb-1 flex items-center gap-2 text-emerald-600">
                      <CheckCircle size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Confirmado</span>
                    </div>
                    <span className="text-xl font-black text-[#1d1d1f]">
                      {formatCurrency(metrics.homecareConfirmedRevenue)}
                    </span>
                    <p className="mt-2 text-[11px] leading-relaxed text-emerald-800">
                      Homecare que ja virou receita.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                    <div className="mb-1 flex items-center gap-2 text-amber-600">
                      <Clock size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Em aberto</span>
                    </div>
                    <span className="text-xl font-black text-[#1d1d1f]">
                      {formatCurrency(metrics.pendingRevenue)}
                    </span>
                    <p className="mt-2 text-[11px] leading-relaxed text-amber-800">
                      Receita potencial ainda pendente.
                    </p>
                  </div>
                </div>

                {metrics.homecareConfirmedRevenue + metrics.pendingRevenue > 0 ? (
                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--color-text)]">Conversao de valor do homecare</span>
                      <span className="font-bold text-[var(--color-brand-accent)]">
                        {formatPercent(metrics.homecareValueConfirmationRate, 1)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(metrics.homecareValueConfirmationRate, 2)}%`,
                          background: `linear-gradient(90deg, ${FINANCE_COLORS.homecareConfirmed}, ${FINANCE_COLORS.procedure})`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 space-y-4">
                  {[
                    {
                      label: "Procedimentos dentro do realizado",
                      value: formatPercent(proceduresShareOfRealized, 1),
                      note: "Percentual = receita de servicos / receita realizada.",
                    },
                    {
                      label: "Homecare dentro do realizado",
                      value: formatPercent(homecareShareOfRealized, 1),
                      note: "Percentual = homecare confirmado / receita realizada.",
                    },
                    {
                      label: "Em aberto dentro do potencial",
                      value: formatPercent(pendingShareOfPotential, 1),
                      note: "Percentual = receita pendente / potencial do periodo.",
                    },
                    {
                      label: "Receita media por dia",
                      value: formatCurrency(metrics.dailyAverageRevenue),
                      note: "Media de receita realizada por dia no recorte ativo.",
                    },
                    {
                      label: "Receita media por cliente com compra",
                      value: formatCurrency(metrics.revenuePerClient),
                      note: "Considera apenas pacientes que geraram caixa.",
                    },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[20px] border border-white/70 bg-white/72 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-[#1d1d1f]">{item.label}</span>
                        <span className="text-sm font-bold text-[var(--color-brand-accent)]">{item.value}</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{item.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <RecoveryConsole />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
