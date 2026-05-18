"use client";

import { useEffect, useMemo, useState } from "react";
import { AppointmentDraft, AppointmentStatus, Client, ClientAppointment } from "@/types";
import {
  connectGoogleCalendar,
  createGoogleCalendarEvent,
  disconnectGoogleCalendar,
  getGoogleCalendarSession,
  type GoogleCalendarSession,
} from "@/lib/googleCalendar";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Unplug,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Calendar,
} from "lucide-react";

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

const DURATIONS = [
  { label: "30 min", minutes: 30 },
  { label: "1 hora", minutes: 60 },
  { label: "1h30", minutes: 90 },
  { label: "2 horas", minutes: 120 },
];

const QUICK_TIMES = [
  { label: "Hoje 9h", hours: 9, minutes: 0, dayOffset: 0 },
  { label: "Hoje 14h", hours: 14, minutes: 0, dayOffset: 0 },
  { label: "Amanhã 9h", hours: 9, minutes: 0, dayOffset: 1 },
  { label: "Amanhã 14h", hours: 14, minutes: 0, dayOffset: 1 },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toISO(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateFull(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";
  return date.toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function isToday(date: Date) {
  const now = new Date();
  return date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function isTomorrow(date: Date) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return date.getDate() === tomorrow.getDate() && date.getMonth() === tomorrow.getMonth() && date.getFullYear() === tomorrow.getFullYear();
}

function formatDayLabel(date: Date) {
  if (isToday(date)) return "Hoje";
  if (isTomorrow(date)) return "Amanhã";
  return date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

export default function ClientAgendaTab({
  client,
  onAddAppointment,
  onLinkAppointmentToGoogle,
}: ClientAgendaTabProps) {
  const [googleSession, setGoogleSession] = useState<GoogleCalendarSession>({ connected: false });
  const [loadingSession, setLoadingSession] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [googleLink, setGoogleLink] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  const now = new Date();
  const defaultDate = toISO(now);
  const defaultHour = pad(now.getHours() + 1);

  const [date, setDate] = useState(defaultDate);
  const [hour, setHour] = useState(defaultHour);
  const [minute, setMinute] = useState("00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [status, setStatus] = useState<AppointmentStatus>("agendado");
  const [notes, setNotes] = useState("");

  const startTime = useMemo(() => {
    const d = new Date(date);
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    d.setHours(h, m, 0, 0);
    return d;
  }, [date, hour, minute]);

  const endTime = useMemo(() => {
    if (!startTime) return null;
    return new Date(startTime.getTime() + durationMinutes * 60_000);
  }, [startTime, durationMinutes]);

  const appointments = useMemo(
    () => [...client.appointments].sort((a, b) => new Date(b.inicioEm).getTime() - new Date(a.inicioEm).getTime()),
    [client.appointments]
  );

  const upcomingAppointments = useMemo(
    () => appointments.filter((a) => new Date(a.inicioEm) >= new Date()),
    [appointments]
  );

  useEffect(() => {
    void (async () => {
      try {
        const session = await getGoogleCalendarSession();
        setGoogleSession(session);
      } catch {
        setGoogleSession({ connected: false });
      } finally {
        setLoadingSession(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("gcal_connected");
    const error = params.get("gcal_error");

    if (connected === "true") {
      setMessage("Google Calendar conectado!");
      void getGoogleCalendarSession().then((s) => setGoogleSession(s));
      params.delete("gcal_connected");
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({}, document.title, newUrl);
    }

    if (error) {
      setMessage("Conexão com o Google cancelada.");
      params.delete("gcal_error");
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  const handleConnectGoogle = async () => {
    try {
      setMessage(null);
      const { authUrl } = await connectGoogleCalendar();
      window.open(authUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não foi possível conectar.");
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await disconnectGoogleCalendar();
      setGoogleSession({ connected: false });
      setMessage("Conexão com o Google Calendar removida.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não foi possível desconectar.");
    }
  };

  const applyQuickTime = (qt: (typeof QUICK_TIMES)[0]) => {
    const d = new Date();
    d.setDate(d.getDate() + qt.dayOffset);
    d.setHours(qt.hours, qt.minutes, 0, 0);
    setDate(toISO(d));
    setHour(pad(qt.hours));
    setMinute(pad(qt.minutes));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!startTime || !endTime) {
      setMessage("Preencha a data e o horário corretamente.");
      return;
    }

    setBusy(true);
    setMessage(null);
    setGoogleLink(null);

    try {
      const startIso = startTime.toISOString();
      const endIso = endTime.toISOString();

      const appointment = await onAddAppointment(client.id, {
        titulo: `Sessão - ${client.profile.nome}`,
        inicioEm: startIso,
        fimEm: endIso,
        status,
        origem: googleSession.connected ? "google_calendar" : "interno",
        observacoes: notes || undefined,
        metadata: { createdFrom: "agenda-tab" },
      });

      if (googleSession.connected) {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
        const googleEvent = await createGoogleCalendarEvent({
          summary: `Sessão - ${client.profile.nome}`,
          description: notes || `Atendimento de ${client.profile.nome}`,
          start: startIso,
          end: endIso,
          timeZone,
        });

        await onLinkAppointmentToGoogle(client.id, appointment.id, {
          googleEventId: googleEvent.id,
          googleCalendarId: googleEvent.organizer?.email || "primary",
          metadata: { createdFrom: "agenda-tab", googleHtmlLink: googleEvent.htmlLink || null },
        });

        setGoogleLink(googleEvent.htmlLink || null);
        setMessage("Agendamento criado e enviado para o Google Calendar!");
      } else {
        setMessage("Agendamento criado na agenda da clínica.");
      }

      const nextHour = pad(new Date().getHours() + 1);
      setDate(toISO(new Date()));
      setHour(nextHour);
      setMinute("00");
      setDurationMinutes(60);
      setStatus("agendado");
      setNotes("");
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error(err);
      }
      setMessage(err instanceof Error ? err.message : "Não foi possível salvar o agendamento.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
      {/* Google Calendar Connection Banner */}
      {loadingSession ? (
        <div className="rounded-[32px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.8)] p-5 flex items-center gap-3">
          <Loader2 size={20} className="animate-spin text-[var(--color-brand-accent)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">Verificando conexão com Google Calendar...</p>
        </div>
      ) : googleSession.connected ? (
        <div className="rounded-[32px] border border-[var(--color-brand-line)] bg-[rgba(92,139,101,0.08)] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">Google Calendar conectado</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{googleSession.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDisconnectGoogle}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-destructive)] transition-colors"
            >
              <Unplug size={13} /> Desconectar
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-[32px] border-2 border-dashed border-[var(--color-brand-accent)]/30 bg-[rgba(140,90,45,0.04)] p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-10 h-10 rounded-full bg-[var(--color-brand-soft)] flex items-center justify-center shrink-0">
                <CalendarDays size={20} className="text-[var(--color-brand-accent)]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">Conecte seu Google Calendar</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  Assim, seus agendamentos aparecem automaticamente no Google Calendar. A conexão fica salva neste navegador.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleConnectGoogle}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#7a4921] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#623915] shrink-0"
            >
              <Sparkles size={15} /> Conectar agora
            </button>
          </div>
        </div>
      )}

      {/* Appointment Form */}
      <form onSubmit={handleSubmit} className="rounded-[32px] border border-[var(--color-brand-line)] bg-white/85 p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-full bg-[var(--color-brand-soft)] flex items-center justify-center">
            <Clock size={16} className="text-[var(--color-brand-accent)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">Novo agendamento</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{client.profile.nome}</p>
          </div>
        </div>

        {/* Quick time presets */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73] mb-2">Horários rápidos</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_TIMES.map((qt) => (
              <button
                key={qt.label}
                type="button"
                onClick={() => applyQuickTime(qt)}
                className="px-3 py-2 rounded-xl text-xs font-medium border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] text-[var(--color-brand-deep)] hover:bg-white transition-colors"
              >
                {qt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date and Time */}
        <div className="grid gap-4 sm:grid-cols-2 mb-4">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">
            Data
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-light mt-2 min-h-11 w-full"
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">
              Hora
              <select
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                className="input-light mt-2 min-h-11 w-full"
              >
                {Array.from({ length: 14 }, (_, i) => i + 7).map((h) => (
                  <option key={h} value={pad(h)}>{pad(h)}h</option>
                ))}
              </select>
            </label>

            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">
              Minutos
              <select
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                className="input-light mt-2 min-h-11 w-full"
              >
                {["00", "15", "30", "45"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Duration */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73] mb-2">Duração</p>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.label}
                type="button"
                onClick={() => setDurationMinutes(d.minutes)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  durationMinutes === d.minutes
                    ? "bg-[#7a4921] text-white shadow-md"
                    : "border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] text-[var(--color-brand-deep)] hover:bg-white"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {startTime && endTime && (
          <div className="mb-4 rounded-2xl bg-[var(--color-brand-soft)] px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={14} className="text-[var(--color-brand-accent)]" />
              <span className="font-medium text-[var(--color-text)]">
                {formatDayLabel(startTime)}, {formatTimeOnly(startTime.toISOString())} — {formatTimeOnly(endTime.toISOString())}
              </span>
            </div>
            {googleSession.connected && (
              <p className="text-[11px] text-[var(--color-success)] mt-1 flex items-center gap-1">
                <CheckCircle2 size={11} /> Será enviado para o Google Calendar
              </p>
            )}
          </div>
        )}

        {/* Status */}
        <div className="mb-4">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
              className="input-light mt-2 min-h-11 w-full"
            >
              {(Object.keys(APPOINTMENT_STATUS_LABEL) as AppointmentStatus[]).map((s) => (
                <option key={s} value={s}>{APPOINTMENT_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Notes toggle */}
        <button
          type="button"
          onClick={() => setShowNotes(!showNotes)}
          className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors mb-3"
        >
          {showNotes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showNotes ? "Ocultar observações" : "Adicionar observações"}
        </button>

        {showNotes && (
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73] block mb-4">
            Observações
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-light mt-2 min-h-[100px] w-full"
              placeholder="Protocolo da sessão, lembretes..."
            />
          </label>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={busy}
          className="w-full min-h-12 rounded-xl bg-[#7a4921] text-sm font-semibold text-white transition hover:bg-[#623915] disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <CalendarDays size={16} />
              Agendar {googleSession.connected ? "e enviar ao Google Calendar" : ""}
            </>
          )}
        </button>

        {message && (
          <p className={`mt-3 text-sm text-center ${message.includes("sucesso") || message.includes("criado") || message.includes("conectado") ? "text-[var(--color-success)]" : "text-[var(--color-destructive)]"}`}>
            {message}
          </p>
        )}

        {googleLink && (
          <a
            href={googleLink}
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold text-[var(--color-brand-accent)] hover:text-[var(--color-brand-deep)]"
          >
            <ExternalLink size={15} /> Abrir no Google Calendar
          </a>
        )}
      </form>

      {/* Upcoming Appointments */}
      <section className="rounded-[32px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.82)] p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Agenda</p>
            <h3 className="text-base font-semibold text-[var(--color-text)]">Próximos agendamentos</h3>
          </div>
          <div className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[var(--color-brand-deep)]">
            {upcomingAppointments.length}
          </div>
        </div>

        {upcomingAppointments.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[var(--color-brand-line)] bg-white/60 px-4 py-6 text-center">
            <CalendarDays size={24} className="mx-auto mb-2 text-[var(--color-text-tertiary)]" />
            <p className="text-sm text-[var(--color-text-secondary)]">Nenhum agendamento futuro.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingAppointments.map((apt) => {
              const googleHtmlLink = typeof apt.metadata?.googleHtmlLink === "string" ? apt.metadata.googleHtmlLink : undefined;
              return (
                <article key={apt.id} className="rounded-2xl border border-[var(--color-brand-line)] bg-white/75 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--color-brand-soft)] flex items-center justify-center shrink-0 mt-0.5">
                        <Clock size={14} className="text-[var(--color-brand-accent)]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-text)]">{apt.titulo}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">{formatDateFull(apt.inicioEm)}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="rounded-full bg-[rgba(122,73,33,0.08)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--color-brand-deep)]">
                        {APPOINTMENT_STATUS_LABEL[apt.status]}
                      </span>
                      {apt.origem === "google_calendar" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                          <CheckCircle2 size={10} /> Google
                        </span>
                      )}
                    </div>
                  </div>

                  {googleHtmlLink && (
                    <a
                      href={googleHtmlLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-brand-accent)] hover:text-[var(--color-brand-deep)]"
                    >
                      <ExternalLink size={12} /> Abrir no Google
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
