"use client";

import { useMemo, useState } from "react";
import { Client } from "@/types";
import BrandLogo from "@/components/BrandLogo";
import RecoveryConsole from "@/components/RecoveryConsole";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import {
  DollarSign,
  Activity,
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

type DatePreset = "7d" | "30d" | "all" | "custom";

const CHART_COLORS = ["#7A4921", "#A56D3A", "#D2A679", "#5D7A63", "#B98555", "#8C5B2F"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function formatCurrencyFull(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function isWithinRange(value: string, preset: DatePreset, startDate: string, endDate: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (preset === "all") return true;
  if (preset === "custom") {
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  }
  const now = new Date();
  const days = preset === "7d" ? 7 : 30;
  const start = new Date(now);
  start.setDate(now.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return date >= start && date <= now;
}

function buildRevenueLabel(date: Date, preset: DatePreset, customStart: string, customEnd: string) {
  const usesDailyBuckets = preset === "7d" || preset === "30d" || (preset === "custom" && customStart && customEnd);
  return usesDailyBuckets
    ? date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

type PeriodComparison = {
  currentTotal: number;
  previousTotal: number;
  percentChange: number;
  trend: "up" | "down" | "stable";
};

function computePeriodComparison(
  clients: Client[],
  preset: DatePreset
): PeriodComparison {
  const now = new Date();
  const days = preset === "7d" ? 7 : 30;

  const currentStart = new Date(now);
  currentStart.setDate(now.getDate() - (days - 1));

  const prevEnd = new Date(currentStart);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - (days - 1));

  const currentRevenues: number[] = [];
  const previousRevenues: number[] = [];

  clients.forEach((client) => {
    client.colorimetrias.forEach((proc) => {
      const procDate = new Date(proc.data);
      const val = proc.valor || 0;

      if (procDate >= currentStart && procDate <= now) {
        currentRevenues.push(val);
      } else if (procDate >= prevStart && procDate <= prevEnd) {
        previousRevenues.push(val);
      }
    });
  });

  const currentTotal = currentRevenues.reduce((a, b) => a + b, 0);
  const previousTotal = previousRevenues.reduce((a, b) => a + b, 0);

  if (previousTotal === 0) {
    return { currentTotal, previousTotal, percentChange: currentTotal > 0 ? 100 : 0, trend: "up" as const };
  }

  const percentChange = ((currentTotal - previousTotal) / previousTotal) * 100;
  const trend: "up" | "down" | "stable" = percentChange > 5 ? "up" : percentChange < -5 ? "down" : "stable";

  return { currentTotal, previousTotal, percentChange, trend };
}

type TooltipPayload = { name?: string; value?: number; color?: string };

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="bg-white/90 backdrop-blur-xl px-4 py-3 rounded-2xl shadow-lg"
      style={{ border: "1px solid rgba(122,73,33,0.1)" }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-bold text-[#1d1d1f]">
          {formatCurrencyFull(entry.value ?? 0)}
        </p>
      ))}
    </div>
  );
};

type LegendPayload = { value?: string; color?: string };

const DonutTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div
      className="bg-white/90 backdrop-blur-xl px-4 py-3 rounded-2xl shadow-lg"
      style={{ border: "1px solid rgba(122,73,33,0.1)" }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{d.name}</p>
      <p className="text-sm font-bold text-[#1d1d1f]">{formatCurrencyFull(d.value ?? 0)}</p>
    </div>
  );
};

const RenderLegend = ({ payload }: { payload?: LegendPayload[] }) => {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 px-1">
      {payload?.map((entry, index) => (
        <div key={`legend-${index}`} className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[10px] font-semibold text-gray-600 truncate leading-tight">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function DashboardWindow({ clients, onClose }: DashboardWindowProps) {
  const [preset, setPreset] = useState<DatePreset>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const periodComparison = useMemo(
    () => computePeriodComparison(clients, preset),
    [clients, preset]
  );

  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let procCount = 0;
    const revenueBuckets = new Map<string, number>();
    const procedureRevenue: Record<string, number> = {};
    const leadSourceCount: Record<string, number> = {};
    const proceduresByMonth: Record<string, number> = {};
    const topProcedures: Record<string, { count: number; revenue: number }> = {};

    const filteredPatients = clients.filter((client) =>
      isWithinRange(client.createdAt, preset, customStart, customEnd)
    );

    clients.forEach((client) => {
      client.colorimetrias.forEach((procedure) => {
        if (!isWithinRange(procedure.data, preset, customStart, customEnd)) return;

        const value = procedure.valor || 0;
        const date = new Date(procedure.data);
        const label = buildRevenueLabel(date, preset, customStart, customEnd);
        totalRevenue += value;
        procCount += 1;
        revenueBuckets.set(label, (revenueBuckets.get(label) || 0) + value);

        const technique = procedure.tecnicaUtilizada || "Nao informado";
        procedureRevenue[technique] = (procedureRevenue[technique] || 0) + value;

        const monthKey = date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
        proceduresByMonth[monthKey] = (proceduresByMonth[monthKey] || 0) + 1;

        topProcedures[technique] = topProcedures[technique] || { count: 0, revenue: 0 };
        topProcedures[technique].count += 1;
        topProcedures[technique].revenue += value;
      });
    });

    filteredPatients.forEach((client) => {
      const source = client.profile.acquisitionChannel || "Nao informado";
      leadSourceCount[source] = (leadSourceCount[source] || 0) + 1;
    });

    const revenueData = Array.from(revenueBuckets.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

    const profitabilityData = Object.entries(procedureRevenue)
      .map(([name, value]) => ({
        name,
        value,
        pct: totalRevenue > 0 ? Math.round((value / totalRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);

    const leadSourceData = Object.entries(leadSourceCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const topProceduresList = Object.entries(topProcedures)
      .map(([name, data]) => ({
        name,
        count: data.count,
        revenue: data.revenue,
        avgTicket: data.count > 0 ? data.revenue / data.count : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    let totalHomecarePago = 0;
    let totalHomecarePendente = 0;
    let totalHomecareCount = 0;
    clients.forEach((client) => {
      client.homecare.forEach((h) => {
        totalHomecareCount += 1;
        if (h.pago) {
          totalHomecarePago += h.valorTotal || 0;
        } else {
          totalHomecarePendente += h.valorTotal || 0;
        }
      });
    });

    return {
      totalClients: filteredPatients.length,
      totalRevenue,
      procCount,
      revenueData,
      profitabilityData,
      leadSourceData,
      topProcedures: topProceduresList,
      proceduresByMonth: Object.entries(proceduresByMonth)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      totalHomecarePago,
      totalHomecarePendente,
      totalHomecareCount,
    };
  }, [clients, customEnd, customStart, preset]);

  const TrendIcon = periodComparison.trend === "up"
    ? ArrowUpRight
    : periodComparison.trend === "down"
    ? ArrowDownRight
    : Minus;

  const trendColor = periodComparison.trend === "up"
    ? "text-emerald-600"
    : periodComparison.trend === "down"
    ? "text-red-500"
    : "text-gray-400";

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
          className="premium-window relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px]"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="premium-window-header flex shrink-0 items-center gap-3 px-4 py-4 sm:px-6">
            <button onClick={onClose} className="w-5 h-5 rounded-full bg-[#ff5f57] sm:w-3 sm:h-3" />
            <div className="flex-1 flex items-center justify-center gap-3">
              <TrendingUp size={16} className="text-[var(--color-brand-accent)]" />
              <BrandLogo compact />
            </div>
            <div className="w-8" />
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8">
            <div className="premium-card rounded-[28px] p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Analytics operacional</p>
                  <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)]">Visão financeira e aquisição de pacientes</h3>
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
                        preset === value
                          ? "is-active"
                          : "text-[var(--color-brand-deep)]"
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
                    Início
                    <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="input-light mt-2" />
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                    Fim
                    <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="input-light mt-2" />
                  </label>
                </div>
              )}
            </div>

            {/* KPI Cards com comparação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {([
                {
                  label: "Faturamento",
                  val: formatCurrency(metrics.totalRevenue),
                  icon: <DollarSign size={16} />,
                  color: "text-[#7A4921]",
                  comparison: `${periodComparison.percentChange >= 0 ? "+" : ""}${periodComparison.percentChange.toFixed(0)}% vs período anterior`,
                },
                {
                  label: "Procedimentos",
                  val: metrics.procCount,
                  icon: <Scissors size={16} />,
                  color: "text-emerald-600",
                  comparison: `${periodComparison.currentTotal > periodComparison.previousTotal ? "+" : ""}${metrics.procCount > 0 ? Math.round(((periodComparison.currentTotal || 1) / (periodComparison.previousTotal || 1) - 1) * 100) : 0}% vs período anterior`,
                },
                {
                  label: "Pacientes",
                  val: metrics.totalClients,
                  icon: <Users size={16} />,
                  color: "text-amber-600",
                },
                {
                  label: "Ticket Médio",
                  val: formatCurrency(metrics.procCount ? metrics.totalRevenue / metrics.procCount : 0),
                  icon: <Activity size={16} />,
                  color: "text-blue-600",
                },
              ] as Array<{ label: string; val: string | number; icon: React.ReactNode; color: string; comparison?: string }>).map((k) => (
                <div
                  key={k.label}
                  className="bg-white/55 p-5 rounded-3xl border border-white/70 flex flex-col gap-2 shadow-[0_12px_34px_rgba(94,58,28,0.06)] transition-all hover:shadow-[0_16px_40px_rgba(94,58,28,0.1)] hover:bg-white/70"
                >
                  <div className={`flex items-center gap-2 ${k.color}`}>
                    {k.icon}
                    <span className="text-[10px] font-bold uppercase tracking-widest">{k.label}</span>
                  </div>
                  <span className="text-2xl font-black text-[#1d1d1f]">{k.val}</span>
                  {k.comparison && (
                    <div className={`flex items-center gap-1 text-[10px] font-semibold ${trendColor}`}>
                      <TrendIcon size={12} />
                      {k.comparison}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Gráficos principais */}
            <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-8">
              {/* Área - Evolução do Faturamento */}
              <div className="bg-white/55 p-6 rounded-[32px] border border-white/70 shadow-[0_16px_40px_rgba(94,58,28,0.06)]">
                <h3 className="text-xs font-bold text-[#1d1d1f] uppercase mb-1 tracking-widest">Evolução do Faturamento</h3>
                <p className="text-[10px] text-gray-500 mb-5 font-medium">
                  {metrics.revenueData.length} períodos · Total {formatCurrencyFull(metrics.totalRevenue)}
                </p>
                {metrics.revenueData.length > 0 ? (
                  <div className="h-64 w-full" style={{ minHeight: "16rem" }}>
                    <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                      <AreaChart data={metrics.revenueData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#7A4921" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#7A4921" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fontWeight: 700 }}
                          axisLine={false}
                          tickLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis hide />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(122,73,33,0.15)", strokeWidth: 1, strokeDasharray: "4 4" }} />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#7A4921"
                          strokeWidth={2}
                          fill="url(#revGradient)"
                          animationDuration={800}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-400 text-sm font-medium">
                    Nenhum dado no período selecionado
                  </div>
                )}
              </div>

              {/* Coluna direita */}
              <div className="grid gap-8">
                {/* Rentabilidade por Procedimento */}
                <div className="bg-white/55 p-6 rounded-[32px] border border-white/70 shadow-[0_16px_40px_rgba(94,58,28,0.06)]">
                  <h3 className="text-xs font-bold text-[#1d1d1f] uppercase mb-1 tracking-widest">Rentabilidade por Procedimento</h3>
                  <p className="text-[10px] text-gray-500 mb-2 font-medium">{metrics.profitabilityData.length} técnicas</p>
                  {metrics.profitabilityData.length > 0 ? (
                    <div className="h-56 w-full" style={{ minHeight: "14rem" }}>
                      <ResponsiveContainer width="100%" height="100%" minHeight={180}>
                        <PieChart>
                          <Pie
                            data={metrics.profitabilityData}
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                            animationDuration={800}
                          >
                            {metrics.profitabilityData.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<DonutTooltip />} />
                          <Legend content={<RenderLegend />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-56 flex items-center justify-center text-gray-400 text-sm font-medium">
                      Nenhum dado no período
                    </div>
                  )}
                </div>

                {/* Origem dos Leads */}
                <div className="bg-white/55 p-6 rounded-[32px] border border-white/70 shadow-[0_16px_40px_rgba(94,58,28,0.06)]">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <h3 className="text-xs font-bold text-[#1d1d1f] uppercase tracking-widest">Origem dos Leads</h3>
                    <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-deep)]">
                      <CalendarRange size={12} />
                      {preset === "7d" ? "7 dias" : preset === "30d" ? "30 dias" : "todo período"}
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-2 font-medium">{metrics.totalClients} pacientes</p>
                  {metrics.leadSourceData.length > 0 ? (
                    <div className="h-56 w-full" style={{ minHeight: "14rem" }}>
                      <ResponsiveContainer width="100%" height="100%" minHeight={180}>
                        <PieChart>
                          <Pie
                            data={metrics.leadSourceData}
                            innerRadius={44}
                            outerRadius={76}
                            paddingAngle={3}
                            dataKey="value"
                            animationDuration={800}
                          >
                            {metrics.leadSourceData.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<DonutTooltip />} />
                          <Legend content={<RenderLegend />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-56 flex items-center justify-center text-gray-400 text-sm font-medium">
                      Nenhum dado no período
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Top 5 Procedimentos + Procedimentos por Mês */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-8">
              {/* Top 5 Procedimentos */}
              <div className="bg-white/55 p-6 rounded-[32px] border border-white/70 shadow-[0_16px_40px_rgba(94,58,28,0.06)]">
                <h3 className="text-xs font-bold text-[#1d1d1f] uppercase mb-4 tracking-widest">Top Procedimentos</h3>
                {metrics.topProcedures.length > 0 ? (
                  <div className="w-full space-y-3">
                    {metrics.topProcedures.map((proc, i) => {
                      const pct = metrics.totalRevenue > 0 ? (proc.revenue / metrics.totalRevenue) * 100 : 0;
                      return (
                        <div key={proc.name} className="flex items-center gap-3">
                          <span className="w-5 text-center text-[11px] font-black text-gray-400">#{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-[#1d1d1f] truncate">{proc.name}</span>
                              <span className="text-[11px] font-bold text-[var(--color-brand-accent)] ml-2 flex-shrink-0">
                                {formatCurrency(proc.revenue)}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.max(pct, 2)}%`,
                                  background: `linear-gradient(90deg, ${CHART_COLORS[i % CHART_COLORS.length]}, ${CHART_COLORS[(i + 1) % CHART_COLORS.length]})`,
                                }}
                              />
                            </div>
                            <div className="flex justify-between mt-0.5">
                              <span className="text-[9px] text-gray-400">{proc.count}x</span>
                              <span className="text-[9px] text-gray-400">{pct.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-gray-400 text-sm font-medium">
                    Nenhum procedimento no período
                  </div>
                )}
              </div>

              {/* Procedimentos por Mês */}
              <div className="bg-white/55 p-6 rounded-[32px] border border-white/70 shadow-[0_16px_40px_rgba(94,58,28,0.06)]">
                <h3 className="text-xs font-bold text-[#1d1d1f] uppercase mb-4 tracking-widest">Procedimentos por Mês</h3>
                {metrics.proceduresByMonth.length > 0 && metrics.revenueData.length > 1 ? (
                  <div className="h-56 w-full" style={{ minHeight: "14rem" }}>
                    <ResponsiveContainer width="100%" height="100%" minHeight={180}>
                      <BarChart data={metrics.proceduresByMonth} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fontWeight: 700 }}
                          axisLine={false}
                          tickLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis hide />
                        <Tooltip
                          cursor={{ fill: "rgba(122,73,33,0.06)" }}
                          contentStyle={{
                            borderRadius: "20px",
                            border: "none",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                            background: "rgba(255,255,255,0.95)",
                          }}
                          formatter={(value) => [`${value ?? 0} procedimentos`, ""]}
                        />
                        <Bar
                          dataKey="count"
                          fill="#A56D3A"
                          radius={[8, 8, 8, 8]}
                          barSize={28}
                          animationDuration={800}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-56 flex items-center justify-center text-gray-400 text-sm font-medium">
                    Dados insuficientes para gráfico mensal
                  </div>
                )}
              </div>
            </div>

            {/* Pagamentos Homecare */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-8">
              <div className="bg-white/55 p-6 rounded-[32px] border border-white/70 shadow-[0_16px_40px_rgba(94,58,28,0.06)]">
                <h3 className="text-xs font-bold text-[#1d1d1f] uppercase mb-1 tracking-widest">Pagamentos Homecare</h3>
                <p className="text-[10px] text-gray-500 mb-4 font-medium">{metrics.totalHomecareCount} prescrições</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200 p-4">
                    <div className="flex items-center gap-2 text-emerald-600 mb-1">
                      <CheckCircle size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Confirmados</span>
                    </div>
                    <span className="text-xl font-black text-[#1d1d1f]">{formatCurrency(metrics.totalHomecarePago)}</span>
                  </div>
                  <div className="rounded-2xl bg-amber-50/70 border border-amber-200 p-4">
                    <div className="flex items-center gap-2 text-amber-600 mb-1">
                      <Clock size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Pendentes</span>
                    </div>
                    <span className="text-xl font-black text-[#1d1d1f]">{formatCurrency(metrics.totalHomecarePendente)}</span>
                  </div>
                </div>
                {metrics.totalHomecareCount > 0 && (
                  <div className="mt-4">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${metrics.totalHomecarePago + metrics.totalHomecarePendente > 0
                            ? Math.round((metrics.totalHomecarePago / (metrics.totalHomecarePago + metrics.totalHomecarePendente)) * 100)
                            : 0}%`,
                          background: "linear-gradient(90deg, #5D7A63, #7A4921)",
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-gray-500 text-right">
                      {metrics.totalHomecarePago + metrics.totalHomecarePendente > 0
                        ? `${Math.round((metrics.totalHomecarePago / (metrics.totalHomecarePago + metrics.totalHomecarePendente)) * 100)}% taxa de confirmação`
                        : "Sem dados"}
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-white/55 p-6 rounded-[32px] border border-white/70 shadow-[0_16px_40px_rgba(94,58,28,0.06)]">
                <h3 className="text-xs font-bold text-[#1d1d1f] uppercase mb-1 tracking-widest">Resumo Financeiro</h3>
                <p className="text-[10px] text-gray-500 mb-4 font-medium">Procedimentos + Homecare</p>
                <div className="space-y-4">
                  {[
                    { label: "Faturamento Procedimentos", value: metrics.totalRevenue, color: "#7A4921" },
                    { label: "Homecare Confirmado", value: metrics.totalHomecarePago, color: "#5D7A63" },
                    { label: "Homecare Pendente", value: metrics.totalHomecarePendente, color: "#D2A679" },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-[var(--color-text)]">{item.label}</span>
                        <span className="font-bold">{formatCurrency(item.value)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (item.value / (metrics.totalRevenue + metrics.totalHomecarePago + metrics.totalHomecarePendente || 1)) * 100)}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-gray-100 flex justify-between text-sm">
                    <span className="font-bold text-[#1d1d1f]">Receita Total</span>
                    <span className="font-black text-[var(--color-brand-deep)]">
                      {formatCurrency(metrics.totalRevenue + metrics.totalHomecarePago)}
                    </span>
                  </div>
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
