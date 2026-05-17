"use client";

import { useMemo, useState } from "react";
import { AppointmentDraft, AppointmentStatus, Client, ClientAppointment } from "@/types";
import {
  connectGoogleCalendar,
  createGoogleCalendarEvent,
  disconnectGoogleCalendar,
  getGoogleCalendarSession,
  type GoogleCalendarSession,
} from "@/lib/googleCalendar";
import { CalendarDays, CheckCircle2, ExternalLink, Loader2, Unplug } from "lucide-react";

interface ClientAgendaTabProps {
  client: Client;
  onAddAppointment: (clientId: string, input: AppointmentDraft) => Promise<ClientAppointment>;
  onLinkAppointmentToGoogle: (
    clientId: string,
    appointmentId: string,
    input: Pick<AppointmentDraft, "googleEventId" | "googleCalendarId" | "metadata">
  ) => Promise<ClientAppointment>;
}

const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  realizado: "Realizado",
  cancelado: "Cancelado",
  faltou: "Faltou",
};

function toDateTimeLocal(value: Date) {
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function buildDefaultStart() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  return toDateTimeLocal(now);
}

function buildDefaultEnd(startValue: string) {
  const date = new Date(startValue);
  if (Number.isNaN(date.getTime())) {
    return buildDefaultStart();
  }
  date.setHours(date.getHours() + 1);
  return toDateTimeLocal(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ClientAgendaTab({
  client,
  onAddAppointment,
  onLinkAppointmentToGoogle,
}: ClientAgendaTabProps) {
  const defaultStart = useMemo(() => buildDefaultStart(), []);
  const [googleSession, setGoogleSession] = useState<GoogleCalendarSession | null>(() => getGoogleCalendarSession());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [googleLink, setGoogleLink] = useState<string | null>(null);
  const [syncToGoogle, setSyncToGoogle] = useState(Boolean(googleSession));
  const [form, setForm] = useState({
    titulo: `Sessão - ${client.profile.nome}`,
    inicioEm: defaultStart,
    fimEm: buildDefaultEnd(defaultStart),
    status: "agendado" as AppointmentStatus,
    observacoes: "",
  });

  const appointments = useMemo(
    () => [...client.appointments].sort((left, right) => new Date(right.inicioEm).getTime() - new Date(left.inicioEm).getTime()),
    [client.appointments]
  );

  const handleConnectGoogle = async (forcePrompt = false) => {
    try {
      setMessage(null);
      const session = await connectGoogleCalendar(forcePrompt);
      setGoogleSession(session);
      setSyncToGoogle(true);
      setMessage(session.email ? `Google Calendar conectado: ${session.email}` : "Google Calendar conectado.");
      return session;
    } catch (connectError) {
      const nextMessage = connectError instanceof Error ? connectError.message : "Nao foi possivel conectar ao Google Calendar agora.";
      setMessage(nextMessage);
      throw connectError;
    }
  };

  const handleDisconnectGoogle = () => {
    disconnectGoogleCalendar();
    setGoogleSession(null);
    setSyncToGoogle(false);
    setMessage("Conexão com o Google Calendar removida deste navegador.");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setGoogleLink(null);

    try {
      const startIso = new Date(form.inicioEm).toISOString();
      const endIso = new Date(form.fimEm).toISOString();
      if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
        throw new Error("O horário final precisa ser maior do que o horário inicial.");
      }

      const appointment = await onAddAppointment(client.id, {
        titulo: form.titulo,
        inicioEm: startIso,
        fimEm: endIso,
        status: form.status,
        origem: syncToGoogle ? "manual" : "interno",
        observacoes: form.observacoes,
        metadata: {
          createdFrom: "agenda-tab",
        },
      });

      if (syncToGoogle) {
        const session = googleSession ?? (await handleConnectGoogle());
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
        const googleEvent = await createGoogleCalendarEvent(session, {
          summary: form.titulo,
          description: form.observacoes || `Atendimento de ${client.profile.nome}`,
          start: startIso,
          end: endIso,
          timeZone,
        });

        await onLinkAppointmentToGoogle(client.id, appointment.id, {
          googleEventId: googleEvent.id,
          googleCalendarId: googleEvent.organizer?.email || "primary",
          metadata: {
            createdFrom: "agenda-tab",
            googleHtmlLink: googleEvent.htmlLink || null,
          },
        });

        setGoogleLink(googleEvent.htmlLink || null);
        setMessage("Agendamento salvo e enviado para o Google Calendar.");
      } else {
        setMessage("Agendamento salvo na agenda da clínica.");
      }

      const nextStart = buildDefaultStart();
      setForm({
        titulo: `Sessão - ${client.profile.nome}`,
        inicioEm: nextStart,
        fimEm: buildDefaultEnd(nextStart),
        status: "agendado",
        observacoes: "",
      });
    } catch (submitError) {
      console.error(submitError);
      setMessage(submitError instanceof Error ? submitError.message : "Não foi possível salvar o agendamento agora.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
      <section className="rounded-[32px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.8)] p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Agenda</p>
            <h3 className="text-lg font-semibold text-[var(--color-text)]">Crie horários e envie para o Google Calendar</h3>
            <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
              Cadastre o compromisso dentro do prontuário da paciente e, se quiser, sincronize o mesmo evento com o Google Calendar autenticado neste navegador via OAuth.
            </p>
          </div>

          <div className="rounded-[24px] border border-[var(--color-brand-line)] bg-white/75 px-4 py-3 text-sm text-[var(--color-text)] shadow-[0_10px_24px_rgba(94,58,28,0.06)]">
            <p className="font-semibold">Google Calendar</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
              {googleSession?.email ? `Conectado como ${googleSession.email}` : "Nenhuma conta Google conectada neste navegador."}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  void handleConnectGoogle(Boolean(googleSession)).catch(() => undefined);
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#7a4921] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#623915]"
              >
                {googleSession ? "Trocar conta Google" : "Conectar Google Calendar"}
              </button>
              {googleSession && (
                <button
                  type="button"
                  onClick={handleDisconnectGoogle}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)]"
                >
                  <Unplug size={15} /> Desconectar
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
        <form onSubmit={handleSubmit} className="rounded-[32px] border border-[var(--color-brand-line)] bg-white/85 p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73] md:col-span-2">
              Título do compromisso
              <input
                value={form.titulo}
                onChange={(event) => setForm((prev) => ({ ...prev, titulo: event.target.value }))}
                className="input-light mt-2 min-h-11"
                placeholder="Ex.: Sessão de avaliação capilar"
                required
              />
            </label>

            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">
              Início
              <input
                type="datetime-local"
                value={form.inicioEm}
                onChange={(event) => setForm((prev) => ({ ...prev, inicioEm: event.target.value }))}
                className="input-light mt-2 min-h-11"
                required
              />
            </label>

            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">
              Fim
              <input
                type="datetime-local"
                value={form.fimEm}
                onChange={(event) => setForm((prev) => ({ ...prev, fimEm: event.target.value }))}
                className="input-light mt-2 min-h-11"
                required
              />
            </label>

            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">
              Status inicial
              <select
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as AppointmentStatus }))}
                className="input-light mt-2 min-h-11"
              >
                {(Object.keys(APPOINTMENT_STATUS_LABEL) as AppointmentStatus[]).map((status) => (
                  <option key={status} value={status}>{APPOINTMENT_STATUS_LABEL[status]}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-3 rounded-[24px] border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-4 py-3 text-sm text-[var(--color-brand-deep)]">
              <input
                type="checkbox"
                checked={syncToGoogle}
                onChange={(event) => setSyncToGoogle(event.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-brand-line)] text-[#7a4921]"
              />
              Sincronizar este agendamento com o Google Calendar
            </label>

            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73] md:col-span-2">
              Observações
              <textarea
                value={form.observacoes}
                onChange={(event) => setForm((prev) => ({ ...prev, observacoes: event.target.value }))}
                className="input-light mt-2 min-h-[140px]"
                placeholder="Protocolo da sessão, duração prevista, lembretes ou orientações."
              />
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-[var(--color-text-secondary)]">
              Paciente vinculada: <strong className="text-[var(--color-text)]">{client.profile.nome}</strong>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#7a4921] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#623915] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <CalendarDays size={16} />}
              Criar agendamento
            </button>
          </div>

          {message && <p className="mt-4 text-sm text-[var(--color-brand-deep)]">{message}</p>}
          {googleLink && (
            <a
              href={googleLink}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-brand-accent)] hover:text-[var(--color-brand-deep)]"
            >
              <ExternalLink size={15} /> Abrir evento criado no Google Calendar
            </a>
          )}
        </form>

        <section className="rounded-[32px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.82)] p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Próximos registros</p>
              <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)]">Histórico da agenda da paciente</h3>
            </div>
            <div className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[var(--color-brand-deep)]">
              {appointments.length} evento{appointments.length !== 1 ? "s" : ""}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {appointments.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[var(--color-brand-line)] bg-white/60 px-4 py-5 text-sm text-[var(--color-text-secondary)]">
                Nenhum agendamento registrado para esta paciente ainda.
              </div>
            ) : (
              appointments.map((appointment) => {
                const googleHtmlLink = typeof appointment.metadata?.googleHtmlLink === "string" ? appointment.metadata.googleHtmlLink : undefined;
                return (
                  <article key={appointment.id} className="rounded-[24px] border border-[var(--color-brand-line)] bg-white/75 px-4 py-4 shadow-[0_10px_24px_rgba(94,58,28,0.05)]">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h4 className="text-base font-semibold text-[var(--color-text)]">{appointment.titulo}</h4>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                          {formatDateTime(appointment.inicioEm)} até {formatDateTime(appointment.fimEm)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-[rgba(122,73,33,0.08)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-deep)]">
                          {APPOINTMENT_STATUS_LABEL[appointment.status]}
                        </span>
                        {appointment.origem === "google_calendar" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 size={13} /> Google Calendar
                          </span>
                        )}
                      </div>
                    </div>

                    {appointment.observacoes && (
                      <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{appointment.observacoes}</p>
                    )}

                    {googleHtmlLink && (
                      <a
                        href={googleHtmlLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-brand-accent)] hover:text-[var(--color-brand-deep)]"
                      >
                        <ExternalLink size={15} /> Abrir no Google Calendar
                      </a>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
