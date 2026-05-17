"use client";

import { useMemo, useState } from "react";
import { Client } from "@/types";
import BrandLogo from "@/components/BrandLogo";
import RecoveryConsole from "@/components/RecoveryConsole";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DollarSign, Activity, Users, Scissors, CalendarRange, TrendingUp } from "lucide-react";

interface DashboardWindowProps {
  clients: Client[];
  onClose: () => void;
}

type DatePreset = "7d" | "30d" | "all" | "custom";

const CHART_COLORS = ["#7A4921", "#A56D3A", "#D2A679", "#5D7A63", "#B98555", "#8C5B2F"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
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

export default function DashboardWindow({ clients, onClose }: DashboardWindowProps) {
  const [preset, setPreset] = useState<DatePreset>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let procCount = 0;
    const revenueBuckets = new Map<string, number>();
    const procedureRevenue: Record<string, number> = {};
    const leadSourceCount: Record<string, number> = {};

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
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const leadSourceData = Object.entries(leadSourceCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      totalClients: filteredPatients.length,
      totalRevenue,
      procCount,
      revenueData,
      profitabilityData,
      leadSourceData,
    };
  }, [clients, customEnd, customStart, preset]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.1)", backdropFilter: "blur(6px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-[32px] overflow-hidden"
          style={{
            background: "rgba(255, 255, 255, 0.75)",
            backdropFilter: "blur(32px) saturate(1.8)",
            border: "1px solid rgba(255, 255, 255, 0.4)",
            boxShadow: "0 40px 100px rgba(0,0,0,0.15)",
          }}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Title bar */}
          <div className="flex items-center gap-3 px-4 sm:px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            <button onClick={onClose} className="w-5 h-5 rounded-full bg-[#ff5f57] sm:w-3 sm:h-3" />
            <div className="flex-1 flex items-center justify-center gap-3">
              <TrendingUp size={16} className="text-[var(--color-brand-accent)]" />
              <BrandLogo compact />
            </div>
            <div className="w-8" />
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8">
            <div className="rounded-[28px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.78)] p-4 sm:p-5">
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
                      className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                        preset === value
                          ? "bg-[#7a4921] text-white"
                          : "bg-white text-[var(--color-brand-deep)] hover:bg-[var(--color-brand-soft)]"
                      }`}
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

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {[
                { label: "Faturamento", val: formatCurrency(metrics.totalRevenue), icon: <DollarSign size={16} />, color: "text-[var(--color-brand-deep)]" },
                { label: "Pacientes", val: metrics.totalClients, icon: <Users size={16} />, color: "text-[var(--color-brand-accent)]" },
                { label: "Procedimentos", val: metrics.procCount, icon: <Scissors size={16} />, color: "text-[var(--color-success)]" },
                { label: "Ticket Médio", val: formatCurrency(metrics.procCount ? metrics.totalRevenue / metrics.procCount : 0), icon: <Activity size={16} />, color: "text-[var(--color-warning)]" },
              ].map(k => (
                <div key={k.label} className="bg-white/45 p-5 rounded-3xl border border-white flex flex-col gap-2 shadow-[0_12px_34px_rgba(94,58,28,0.06)]">
                  <div className={`flex items-center gap-2 ${k.color}`}>
                    {k.icon} <span className="text-[10px] font-bold uppercase tracking-widest">{k.label}</span>
                  </div>
                  <span className="text-2xl font-black text-[#1d1d1f]">{k.val}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-8">
              <div className="bg-white/45 p-6 rounded-[32px] border border-white shadow-[0_16px_40px_rgba(94,58,28,0.06)]">
                <h3 className="text-xs font-bold text-[#1d1d1f] uppercase mb-6 tracking-widest">Evolução do Faturamento</h3>
                <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.revenueData}>
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip
                          cursor={{ fill: 'rgba(122,73,33,0.06)' }}
                          formatter={(value) => formatCurrency(Number(value ?? 0))}
                          contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="value" fill="#7A4921" radius={[10, 10, 10, 10]} barSize={22} />
                      </BarChart>
                   </ResponsiveContainer>
                </div>
              </div>

              <div className="grid gap-8">
                <div className="bg-white/45 p-6 rounded-[32px] border border-white relative shadow-[0_16px_40px_rgba(94,58,28,0.06)]">
                   <h3 className="text-xs font-bold text-[#1d1d1f] uppercase mb-6 tracking-widest">Rentabilidade por Procedimento</h3>
                   <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={metrics.profitabilityData} innerRadius={58} outerRadius={84} paddingAngle={4} dataKey="value">
                            {metrics.profitabilityData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} contentStyle={{ borderRadius: '20px', border: 'none' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-6">
                        <div className="text-center">
                          <span className="block text-2xl font-black">{metrics.profitabilityData.length}</span>
                          <span className="text-[8px] font-bold uppercase text-gray-500">técnicas</span>
                        </div>
                      </div>
                   </div>
                </div>

                <div className="bg-white/45 p-6 rounded-[32px] border border-white relative shadow-[0_16px_40px_rgba(94,58,28,0.06)]">
                   <div className="flex items-center justify-between gap-3 mb-6">
                     <h3 className="text-xs font-bold text-[#1d1d1f] uppercase tracking-widest">Origem dos Leads</h3>
                     <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-deep)]">
                       <CalendarRange size={12} />
                       filtro ativo
                     </div>
                   </div>
                   <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={metrics.leadSourceData} innerRadius={52} outerRadius={84} paddingAngle={4} dataKey="value">
                            {metrics.leadSourceData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '20px', border: 'none' }} />
                        </PieChart>
                      </ResponsiveContainer>
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
