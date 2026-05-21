"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BrandLogo from "@/components/BrandLogo";
import { adminGetJson, adminPutJson, clearAdminOperationsToken, setAdminOperationsToken } from "@/lib/adminApi";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";

type AccessRequest = {
  id: string;
  email: string;
  justification: string | null;
  status: "pending" | "approved" | "denied";
  created_at: string;
  updated_at: string;
};

type AccessRequestsResponse = {
  requests: AccessRequest[];
};

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: AccessRequest["status"] }) {
  const styles = {
    pending: "border-amber-200 bg-amber-50/80 text-amber-700",
    approved: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
    denied: "border-rose-200 bg-rose-50/80 text-rose-700",
  };

  const labels = {
    pending: "Pendente",
    approved: "Aprovado",
    denied: "Recusado",
  };

  const icons = {
    pending: Clock,
    approved: CheckCircle2,
    denied: XCircle,
  };

  const Icon = icons[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${styles[status]}`}>
      <Icon size={12} />
      {labels[status]}
    </span>
  );
}

function RequestRow({
  request,
  onApprove,
  onDeny,
  updating,
}: {
  request: AccessRequest;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  updating: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="premium-card rounded-[1.75rem] p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <p className="truncate text-lg font-semibold text-[var(--color-ink)]">{request.email}</p>
            <StatusBadge status={request.status} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-[1.4fr_0.8fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">
                Contexto informado
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                {request.justification || "Nenhuma justificativa foi enviada para esta solicitacao."}
              </p>
            </div>

            <div className="rounded-[1.35rem] border border-[var(--color-brand-line)] bg-white/60 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">
                Datas
              </p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Solicitado em {formatDateTime(request.created_at)}</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Atualizado em {formatDateTime(request.updated_at)}</p>
            </div>
          </div>
        </div>

        {request.status === "pending" && (
          <div className="flex shrink-0 gap-2">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onApprove(request.id)}
              disabled={updating}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-600 transition-colors disabled:opacity-50"
              title="Aprovar"
            >
              {updating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onDeny(request.id)}
              disabled={updating}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 transition-colors disabled:opacity-50"
              title="Recusar"
            >
              {updating ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function AdminAccessRequestsPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [message, setMessage] = useState<string | null>(null);
  const [tokenPromptOpen, setTokenPromptOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  async function loadRequests(statusFilter: "pending" | "all") {
    setLoading(true);
    setMessage(null);
    try {
      const url = statusFilter === "pending" ? "/api/access/requests?status=pending" : "/api/access/requests?status=all";
      const data = await adminGetJson<AccessRequestsResponse>(url);
      setRequests(data.requests || []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nao foi possivel carregar as solicitacoes.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    setUpdatingId(id);
    try {
      await adminPutJson("/api/access/requests", { id, status: "approved" });
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "approved" } : r)));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nao foi possivel aprovar.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDeny(id: string) {
    setUpdatingId(id);
    try {
      await adminPutJson("/api/access/requests", { id, status: "denied" });
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "denied" } : r)));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nao foi possivel recusar.");
    } finally {
      setUpdatingId(null);
    }
  }

  function handleTokenSubmit() {
    const normalizedToken = tokenInput.trim();
    if (!normalizedToken) return;

    try {
      setAdminOperationsToken(normalizedToken);
      setTokenPromptOpen(false);
      setTokenInput("");
      setMessage(null);
      void loadRequests(filter);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nao foi possivel salvar a chave administrativa.");
    }
  }

  useEffect(() => {
    void loadRequests(filter);
  }, [filter]);

  const counts = useMemo(
    () => ({
      pending: requests.filter((request) => request.status === "pending").length,
      approved: requests.filter((request) => request.status === "approved").length,
      denied: requests.filter((request) => request.status === "denied").length,
    }),
    [requests]
  );

  return (
    <div className="min-h-[var(--app-dvh)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="premium-panel rounded-[2.25rem] p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-[var(--color-brand-sand)] via-[var(--color-brand-accent)] to-[var(--color-brand-deep)] shadow-[0_18px_36px_rgba(122,73,33,0.28)]">
                  <Users size={24} className="text-white" />
                </div>
                <div>
                  <p className="premium-kicker">Operacao restrita</p>
                  <BrandLogo className="mt-2 h-8" />
                </div>
              </div>

              <h1 className="premium-title mt-7 text-4xl font-semibold leading-none sm:text-[3.5rem]">
                Curadoria de acessos profissionais.
              </h1>
              <p className="premium-subtitle mt-4 max-w-2xl text-sm sm:text-base">
                Revise as solicitacoes de entrada, aprove ou recuse o acesso e mantenha a operacao protegida com uma fila clara e elegante para a equipe.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <span className="premium-chip text-xs font-semibold">
                <ShieldCheck size={14} />
                Acesso administrativo
              </span>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => void loadRequests(filter)}
                className="premium-button-secondary flex items-center gap-2 px-4 py-3 text-sm"
                title="Atualizar"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                  Atualizar fila
                </span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setTokenPromptOpen(true)}
                className="premium-button-secondary flex items-center gap-2 px-4 py-3 text-sm"
                title="Definir chave admin"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <KeyRound size={16} />
                  Chave admin
                </span>
              </motion.button>
            </div>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <div className="premium-stat rounded-[1.6rem] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Pendentes</p>
              <p className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">{counts.pending}</p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Solicitacoes aguardando avaliacao no filtro atual.</p>
            </div>
            <div className="premium-stat rounded-[1.6rem] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Aprovadas</p>
              <p className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">{counts.approved}</p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Contas ja liberadas entre os registros carregados.</p>
            </div>
            <div className="premium-stat rounded-[1.6rem] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Recusadas</p>
              <p className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">{counts.denied}</p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Solicitacoes que exigem nova comprovacao antes de aprovar.</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <label className="premium-chip gap-3 text-sm font-semibold">
              <span>Filtro</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as "pending" | "all")}
                className="bg-transparent text-sm font-semibold text-[var(--color-text)] outline-none"
              >
                <option value="pending">Pendentes</option>
                <option value="all">Todas</option>
              </select>
            </label>
          </div>
        </section>

        <AnimatePresence mode="wait">
          {message && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="premium-card flex items-start gap-3 rounded-[1.6rem] border-[var(--color-destructive)]/20 bg-[rgba(255,59,48,0.08)] p-4 text-sm text-[var(--color-destructive)]"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="premium-panel flex min-h-[18rem] items-center justify-center rounded-[2rem]">
            <Loader2 size={34} className="animate-spin text-[var(--color-brand-accent)]" />
          </div>
        ) : requests.length === 0 ? (
          <div className="premium-panel rounded-[2rem] px-6 py-16 text-center sm:px-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(122,73,33,0.08)] text-[var(--color-brand-accent)]">
              <Users size={28} />
            </div>
            <h3 className="premium-title mt-5 text-2xl font-semibold">
              {filter === "pending" ? "Nenhuma solicitacao pendente" : "Nenhuma solicitacao encontrada"}
            </h3>
            <p className="premium-subtitle mx-auto mt-3 max-w-xl text-sm sm:text-base">
              {filter === "pending"
                ? "A fila esta limpa neste momento. Quando uma nova solicitacao chegar, ela aparecera aqui para revisao manual."
                : "Quando alguem solicitar acesso, o registro ficara disponivel nesta central administrativa."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence>
              {requests.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  onApprove={handleApprove}
                  onDeny={handleDeny}
                  updating={updatingId === request.id}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {tokenPromptOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="premium-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setTokenPromptOpen(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="premium-window w-full max-w-md rounded-[2rem] p-6 sm:p-7"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-[rgba(122,73,33,0.08)] text-[var(--color-brand-accent)]">
                  <KeyRound size={20} />
                </div>
                <div>
                  <p className="premium-kicker">Seguranca operacional</p>
                  <h3 className="premium-title mt-2 text-2xl font-semibold">Chave administrativa</h3>
                </div>
              </div>

              <p className="premium-subtitle mt-4 text-sm">
                A chave fica disponivel nas variaveis do projeto ou no arquivo .env.local. Cole abaixo para autorizar as operacoes administrativas desta sessao.
              </p>

              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Cole a chave aqui"
                className="input-light mt-5"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTokenSubmit();
                }}
              />

              <div className="mt-5 flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleTokenSubmit}
                  className="premium-button-primary flex-1 px-4 py-3 text-sm"
                >
                  <span className="relative z-10">Confirmar</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setTokenPromptOpen(false);
                    setTokenInput("");
                  }}
                  className="premium-button-secondary px-4 py-3 text-sm"
                >
                  <span className="relative z-10">Cancelar</span>
                </motion.button>
              </div>

              <button
                onClick={() => {
                  clearAdminOperationsToken();
                  setTokenPromptOpen(false);
                  setMessage("Chave administrativa removida.");
                }}
                className="mt-4 w-full text-center text-xs font-medium text-[var(--color-text-secondary)] underline decoration-[rgba(122,73,33,0.35)] underline-offset-4 transition hover:text-[var(--color-brand-accent)]"
              >
                Limpar chave salva
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}