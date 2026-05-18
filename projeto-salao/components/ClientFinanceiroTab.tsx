"use client";

import { useMemo } from "react";
import { Client } from "@/types";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  DollarSign,
  Scissors,
  CheckCircle,
  Clock,
  ShoppingBag,
} from "lucide-react";

interface ClientFinanceiroTabProps {
  client: Client;
}

const PAGO_COLOR = "#5D7A63";
const PENDENTE_COLOR = "#D2A679";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function formatCurrencyFull(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function ClientFinanceiroTab({ client }: ClientFinanceiroTabProps) {
  const financeiro = useMemo(() => {
    let totalProcedimentos = 0;
    const revenueBuckets = new Map<string, number>();
    const procedureRevenue: Record<string, number> = {};

    client.colorimetrias.forEach((proc) => {
      const val = proc.valor || 0;
      totalProcedimentos += val;
      const date = new Date(proc.data);
      const label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      revenueBuckets.set(label, (revenueBuckets.get(label) || 0) + val);
      const tech = proc.tecnicaUtilizada || "Nao informado";
      procedureRevenue[tech] = (procedureRevenue[tech] || 0) + val;
    });

    const homecarePagos = client.homecare.filter((h) => h.pago);
    const homecarePendentes = client.homecare.filter((h => h.valorTotal && !h.pago));
    const totalHomecarePago = homecarePagos.reduce((s, h) => s + (h.valorTotal || 0), 0);
    const totalHomecarePendente = homecarePendentes.reduce((s, h) => s + (h.valorTotal || 0), 0);
    const receitaTotal = totalProcedimentos + totalHomecarePago;

    return {
      receitaTotal,
      totalProcedimentos,
      totalProcedimentosCount: client.colorimetrias.length,
      homecarePagos,
      homecarePendentes,
      totalHomecarePago,
      totalHomecarePendente,
      receitaData: Array.from(revenueBuckets.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      rentabilidadeData: Object.entries(procedureRevenue)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      pagamentoData: [
        { name: "Pago", value: totalHomecarePago || 1 },
        { name: "Pendente", value: totalHomecarePendente || 0 },
      ].filter(d => d.value > 0 || d.name === "Pago"),
    };
  }, [client]);

  const hasProcedimentos = client.colorimetrias.length > 0;
  const hasHomecare = client.homecare.length > 0;

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Receita Total", val: formatCurrency(financeiro.receitaTotal), icon: <DollarSign size={16} />, color: "text-[#7A4921]" },
          { label: "Procedimentos", val: financeiro.totalProcedimentosCount, icon: <Scissors size={16} />, color: "text-emerald-600" },
          { label: "Homecare Pago", val: formatCurrency(financeiro.totalHomecarePago), icon: <CheckCircle size={16} />, color: "text-emerald-600" },
          { label: "Pendentes", val: formatCurrency(financeiro.totalHomecarePendente), icon: <Clock size={16} />, color: "text-amber-600" },
        ].map((k) => (
          <div key={k.label} className="bg-white/55 p-5 rounded-3xl border border-white/70 flex flex-col gap-2 shadow-[0_12px_34px_rgba(94,58,28,0.06)]">
            <div className={`flex items-center gap-2 ${k.color}`}>
              {k.icon}
              <span className="text-[10px] font-bold uppercase tracking-widest">{k.label}</span>
            </div>
            <span className="text-2xl font-black text-[#1d1d1f]">{k.val}</span>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid min-w-0 grid-cols-1 gap-8 xl:grid-cols-[1.4fr_1fr]">
        {/* Evolução do Faturamento */}
        <div className="min-w-0 rounded-[32px] border border-white/70 bg-white/55 p-6 shadow-[0_16px_40px_rgba(94,58,28,0.06)]">
          <h3 className="text-xs font-bold text-[#1d1d1f] uppercase mb-1 tracking-widest">Evolução do Faturamento</h3>
          <p className="text-[10px] text-gray-500 mb-5 font-medium">
            {financeiro.receitaData.length} períodos · Total {formatCurrencyFull(financeiro.receitaTotal)}
          </p>
          {financeiro.receitaData.length > 0 ? (
            <div className="min-w-0 w-full overflow-hidden" style={{ minHeight: "16rem" }}>
              <ResponsiveContainer width="100%" height={256} minWidth={280} minHeight={220}>
                <AreaChart data={financeiro.receitaData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cliRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7A4921" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#7A4921" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ borderRadius: "20px", border: "none", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [formatCurrencyFull(Number(value ?? 0)), ""]}
                  />
                  <Area type="monotone" dataKey="value" stroke="#7A4921" strokeWidth={2} fill="url(#cliRevGrad)" animationDuration={800} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm font-medium">Nenhum procedimento registrado</div>
          )}
        </div>

        {/* Status de Pagamentos */}
        <div className="grid min-w-0 gap-8">
          <div className="min-w-0 rounded-[32px] border border-white/70 bg-white/55 p-6 shadow-[0_16px_40px_rgba(94,58,28,0.06)]">
            <h3 className="text-xs font-bold text-[#1d1d1f] uppercase mb-1 tracking-widest">Status dos Pagamentos</h3>
            <p className="text-[10px] text-gray-500 mb-2 font-medium">{client.homecare.length} prescrições</p>
            {financeiro.pagamentoData.some(d => d.value > 0) ? (
              <div className="min-w-0 w-full overflow-hidden" style={{ minHeight: "14rem" }}>
                <ResponsiveContainer width="100%" height={224} minWidth={240} minHeight={180}>
                  <PieChart>
                    <Pie data={financeiro.pagamentoData} innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" animationDuration={800}>
                      {financeiro.pagamentoData.map((entry, i) => (
                        <Cell key={i} fill={entry.name === "Pago" ? PAGO_COLOR : PENDENTE_COLOR} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: "20px", border: "none", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => [formatCurrencyFull(Number(value ?? 0)), ""]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-56 flex items-center justify-center text-gray-400 text-sm font-medium">Nenhum homecare cadastrado</div>
            )}
            {hasHomecare && (
              <div className="mt-3 flex justify-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#5D7A63]" />
                  <span className="text-gray-600">Pago: {formatCurrency(financeiro.totalHomecarePago)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D2A679]" />
                  <span className="text-gray-600">Pendente: {formatCurrency(financeiro.totalHomecarePendente)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Procedimentos Realizados */}
      <div className="bg-white/55 p-6 rounded-[32px] border border-white/70 shadow-[0_16px_40px_rgba(94,58,28,0.06)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-[#1d1d1f] uppercase tracking-widest">Procedimentos Realizados</h3>
          <span className="rounded-full bg-[var(--color-brand-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--color-brand-deep)]">
            {client.colorimetrias.length}
          </span>
        </div>
        {hasProcedimentos ? (
          <div className="space-y-3">
            {client.colorimetrias.map((proc) => (
              <div key={proc.id} className="flex items-center justify-between rounded-2xl border border-[var(--color-brand-line)] bg-white/70 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text)] truncate">{proc.tecnicaUtilizada}</p>
                  <p className="text-[10px] text-gray-500">{formatDate(proc.data)}</p>
                </div>
                <span className="text-sm font-black text-[var(--color-brand-deep)] flex-shrink-0 ml-2">
                  {proc.valor ? formatCurrency(proc.valor) : "-"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-24 flex items-center justify-center text-gray-400 text-sm font-medium">Nenhum procedimento registrado</div>
        )}
      </div>

      {/* Prescrições Homecare */}
      <div className="bg-white/55 p-6 rounded-[32px] border border-white/70 shadow-[0_16px_40px_rgba(94,58,28,0.06)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShoppingBag size={14} className="text-[var(--color-brand-accent)]" />
            <h3 className="text-xs font-bold text-[#1d1d1f] uppercase tracking-widest">Prescrições Homecare</h3>
          </div>
          <span className="rounded-full bg-[var(--color-brand-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--color-brand-deep)]">
            {client.homecare.length}
          </span>
        </div>
        {hasHomecare ? (
          <div className="space-y-3">
            {client.homecare.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-2xl border border-[var(--color-brand-line)] bg-white/70 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--color-text)] truncate">{h.produtosRecomendados}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-500">{formatDate(h.data)}</span>
                    {h.valorTotal && (
                      <>
                        <span className="text-[10px] font-bold text-[var(--color-brand-deep)]">R$ {h.valorTotal.toFixed(2)}</span>
                        {h.formaPagamento === "parcelado" && h.parcelas && (
                          <span className="text-[10px] text-gray-400">{h.parcelas}x no cartão</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 ml-2">
                  {h.pago ? (
                    <div className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Pago</span>
                    </div>
                  ) : h.valorTotal ? (
                    <div className="flex items-center gap-1 text-amber-600">
                      <Clock size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Pendente</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-24 flex items-center justify-center text-gray-400 text-sm font-medium">Nenhuma prescrição registrada</div>
        )}
      </div>
    </div>
  );
}
