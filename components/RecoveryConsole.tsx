"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BackupRunHistory,
  DeletedRecordSummary,
  RecoverySummary,
  RestoreDrillHistory,
  RestoreOperationResult,
  RowChangeAuditEntry,
} from "@/types";
import {
  ArchiveRestore,
  DatabaseBackup,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Search,
} from "lucide-react";

type AuditResponse = {
  entries: RowChangeAuditEntry[];
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

function formatPayloadSize(bytes?: number) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

function SummaryCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-[26px] border border-white bg-white/70 p-4 shadow-[0_12px_30px_rgba(94,58,28,0.06)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--color-brand-accent)]">{title}</p>
      <strong className="mt-2 block text-lg text-[var(--color-text)]">{value}</strong>
      <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">{subtitle}</p>
    </div>
  );
}

function DeletedRecordList({
  title,
  items,
  restoringRecordId,
  onRestore,
}: {
  title: string;
  items: readonly DeletedRecordSummary[];
  restoringRecordId: string | null;
  onRestore: (item: DeletedRecordSummary) => Promise<void>;
}) {
  return (
    <div className="rounded-[28px] border border-white bg-white/70 p-4 shadow-[0_12px_30px_rgba(94,58,28,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-[var(--color-text)]">{title}</h4>
        <span className="rounded-full bg-[var(--color-brand-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--color-brand-deep)]">
          {items.length}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] p-4 text-sm text-[var(--color-text-secondary)]">
            Nenhum item arquivado nesta fila agora.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.recordId} className="rounded-2xl border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.82)] p-4">
              <p className="text-sm font-semibold text-[var(--color-text)]">{item.displayName}</p>
              {item.subtitle ? <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{item.subtitle}</p> : null}
              <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]">Arquivado em {formatDateTime(item.deletedAt)}</p>
              {item.deleteReason ? <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">{item.deleteReason}</p> : null}
              <button
                type="button"
                onClick={() => void onRestore(item)}
                disabled={restoringRecordId === item.recordId}
                className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {restoringRecordId === item.recordId ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                Restaurar
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Falha na operacao."
    );
  }
  return payload as T;
}

export default function RecoveryConsole() {
  const [summary, setSummary] = useState<RecoverySummary | null>(null);
  const [auditEntries, setAuditEntries] = useState<RowChangeAuditEntry[]>([]);
  const [auditTable, setAuditTable] = useState<string>("clientes");
  const [auditRecordId, setAuditRecordId] = useState("");
  const [auditTransactionId, setAuditTransactionId] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [restoringRecordId, setRestoringRecordId] = useState<string | null>(null);
  const [restoringTransaction, setRestoringTransaction] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [runningDrill, setRunningDrill] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const latestBackup: BackupRunHistory | undefined = summary?.latestBackup;
  const latestRestoreDrill: RestoreDrillHistory | undefined = summary?.latestRestoreDrill;

  const backupTableCount = useMemo(() => {
    if (!latestBackup) return 0;
    return Object.keys(latestBackup.tableCounts || {}).length;
  }, [latestBackup]);

  async function loadSummary() {
    try {
      setLoadingSummary(true);
      setError(null);
      const nextSummary = await fetchJson<RecoverySummary>("/api/admin/recovery/summary");
      setSummary(nextSummary);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar o resumo de recuperacao.");
    } finally {
      setLoadingSummary(false);
    }
  }

  async function loadAudit() {
    try {
      setLoadingAudit(true);
      setError(null);
      const searchParams = new URLSearchParams();
      if (auditTable) searchParams.set("table", auditTable);
      if (auditRecordId.trim()) searchParams.set("recordId", auditRecordId.trim());
      if (auditTransactionId.trim()) searchParams.set("transactionId", auditTransactionId.trim());
      searchParams.set("limit", "60");

      const response = await fetchJson<AuditResponse>(`/api/admin/audit?${searchParams.toString()}`);
      setAuditEntries(response.entries);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar o log de auditoria.");
    } finally {
      setLoadingAudit(false);
    }
  }

  async function handleRestore(item: DeletedRecordSummary) {
    try {
      setRestoringRecordId(item.recordId);
      setFeedback(null);
      setError(null);
      const response = await fetchJson<{ results: RestoreOperationResult[] }>("/api/admin/restore", {
        method: "POST",
        body: JSON.stringify({ tableName: item.tableName, recordId: item.recordId }),
      });
      const restored = response.results[0];
      setFeedback(
        restored.restoredStorage
          ? "Registro restaurado com sucesso e midia devolvida ao bucket ativo."
          : "Registro restaurado com sucesso. Nao houve midia para retornar do quarantine."
      );
      await loadSummary();
      if (auditEntries.length > 0) await loadAudit();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Nao foi possivel restaurar o registro selecionado.");
    } finally {
      setRestoringRecordId(null);
    }
  }

  async function handleRestoreTransaction() {
    if (!auditTransactionId.trim()) {
      setError("Informe um transaction_id para restaurar todos os registros relacionados.");
      return;
    }
    try {
      setRestoringTransaction(true);
      setFeedback(null);
      setError(null);
      const response = await fetchJson<{ results: RestoreOperationResult[] }>("/api/admin/restore", {
        method: "POST",
        body: JSON.stringify({ transactionId: Number(auditTransactionId) }),
      });
      setFeedback(`${response.results.length} registro(s) restaurado(s) a partir da transacao informada.`);
      await loadSummary();
      await loadAudit();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Nao foi possivel restaurar a transacao informada.");
    } finally {
      setRestoringTransaction(false);
    }
  }

  async function handleRunBackup() {
    try {
      setRunningBackup(true);
      setFeedback(null);
      setError(null);
      await fetchJson("/api/internal/backups/export", { method: "POST" });
      setFeedback("Backup clinico executado com sucesso.");
      await loadSummary();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Nao foi possivel executar o backup agora.");
    } finally {
      setRunningBackup(false);
    }
  }

  async function handleRunDrill() {
    try {
      setRunningDrill(true);
      setFeedback(null);
      setError(null);
      await fetchJson("/api/internal/backups/drill", { method: "POST" });
      setFeedback("Drill de restauracao executado com sucesso.");
      await loadSummary();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Nao foi possivel executar o drill de restauracao agora.");
    } finally {
      setRunningDrill(false);
    }
  }

  useEffect(() => { void loadSummary(); }, []);

  return (
    <section className="rounded-[32px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.78)] p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Proteção e recuperação</p>
          <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)]">Central administrativa de proteção, auditoria e backup</h3>
          <p className="mt-2 max-w-3xl text-sm text-[var(--color-text-secondary)]">
            Exclusões sensíveis agora entram em área protegida. Use este painel para revisar itens arquivados, consultar o histórico de alterações,
            executar backup manual e validar o drill mensal de restauração.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadSummary()}
          disabled={loadingSummary}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingSummary ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
          Atualizar
        </button>
      </div>

      {(error || feedback) && (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {error || feedback}
        </div>
      )}

      {loadingSummary && !summary ? (
        <div className="mt-5 flex items-center justify-center gap-3 py-12 text-sm text-[var(--color-text-secondary)]">
          <Loader2 size={18} className="animate-spin" />
          Carregando console de recuperação…
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Último backup"
              value={latestBackup ? formatDateTime(latestBackup.completedAt || latestBackup.startedAt) : "Sem execução"}
              subtitle={latestBackup ? `${latestBackup.destination} · ${formatPayloadSize(latestBackup.payloadBytes)} · ${backupTableCount} tabelas` : "Execute o backup manual ou deixe o cron diário rodar."}
            />
            <SummaryCard
              title="Último drill"
              value={latestRestoreDrill ? formatDateTime(latestRestoreDrill.completedAt || latestRestoreDrill.startedAt) : "Sem execução"}
              subtitle={latestRestoreDrill ? `Status ${latestRestoreDrill.status} com resumo armazenado no histórico.` : "O drill mensal valida download e legibilidade do artefato mais recente."}
            />
            <SummaryCard
              title="Fila clientes"
              value={String(summary?.deletedClients.length || 0)}
              subtitle="Pacientes arquivados via soft delete, prontos para restauração controlada."
            />
            <SummaryCard
              title="Fila documentos"
              value={String((summary?.deletedDocuments.length || 0) + (summary?.deletedPhotos.length || 0))}
              subtitle="Fotos e documentos enviados para área protegida com trilha completa de auditoria."
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleRunBackup()}
              disabled={runningBackup}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#7a4921] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#623915] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {runningBackup ? <Loader2 size={16} className="animate-spin" /> : <DatabaseBackup size={16} />}
              Rodar backup agora
            </button>
            <button
              type="button"
              onClick={() => void handleRunDrill()}
              disabled={runningDrill}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {runningDrill ? <Loader2 size={16} className="animate-spin" /> : <ArchiveRestore size={16} />}
              Rodar drill de restauração
            </button>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <DeletedRecordList title="Clientes arquivados" items={summary?.deletedClients || []} restoringRecordId={restoringRecordId} onRestore={handleRestore} />
            <DeletedRecordList title="Fotos arquivadas" items={summary?.deletedPhotos || []} restoringRecordId={restoringRecordId} onRestore={handleRestore} />
            <DeletedRecordList title="Documentos arquivados" items={summary?.deletedDocuments || []} restoringRecordId={restoringRecordId} onRestore={handleRestore} />
          </div>

          <div className="rounded-[28px] border border-white bg-white/70 p-5 shadow-[0_12px_30px_rgba(94,58,28,0.06)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--color-brand-accent)]">Auditoria</p>
                <h4 className="mt-1 text-base font-semibold text-[var(--color-text)]">Filtro do histórico de alterações</h4>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  Filtre por tabela, código do registro e ID da transação. Se uma transação reunir vários itens de uma queda ou arquivamento, você pode restaurá-los em lote.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void loadAudit()}
                  disabled={loadingAudit}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingAudit ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  Buscar auditoria
                </button>
                <button
                  type="button"
                  onClick={() => void handleRestoreTransaction()}
                  disabled={!auditTransactionId.trim() || restoringTransaction}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {restoringTransaction ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                  Restaurar transação
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                Tabela
                <select value={auditTable} onChange={(event) => setAuditTable(event.target.value)} className="input-light mt-2">
                  <option value="clientes">clientes</option>
                  <option value="client_photos">client_photos</option>
                  <option value="company_documents">company_documents</option>
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                record_identity.id
                <input value={auditRecordId} onChange={(event) => setAuditRecordId(event.target.value)} className="input-light mt-2" placeholder="UUID do registro" />
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                transaction_id
                <input value={auditTransactionId} onChange={(event) => setAuditTransactionId(event.target.value)} className="input-light mt-2" placeholder="Ex.: 184726" />
              </label>
            </div>

            <div className="mt-5 space-y-3">
              {auditEntries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] p-4 text-sm text-[var(--color-text-secondary)]">
                  Faça a busca para listar os eventos auditados desta tabela ou transação.
                </div>
              ) : (
                auditEntries.map((entry) => (
                  <div key={entry.auditId} className="rounded-2xl border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.82)] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-text)]">
                          {entry.tableName} · {entry.operation}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          tx {entry.transactionId} · {formatDateTime(entry.changedAt)}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[var(--color-brand-deep)]">
                        {typeof entry.recordIdentity.id === "string" ? entry.recordIdentity.id : "sem id"}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-6 text-[var(--color-text-secondary)] break-all">
                      {JSON.stringify(entry.recordIdentity)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
