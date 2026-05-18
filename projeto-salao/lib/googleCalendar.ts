"use client";

export type GoogleCalendarSession = {
  connected: boolean;
  email?: string;
  expiresAt?: number;
};

export type GoogleCalendarEventInput = {
  summary: string;
  description?: string;
  start: string;
  end: string;
  timeZone?: string;
};

export type GoogleCalendarEventResult = {
  id: string;
  htmlLink?: string;
  organizer?: {
    email?: string;
  };
};

export async function getGoogleCalendarSession(): Promise<GoogleCalendarSession> {
  try {
    const res = await fetch("/api/google-calendar/session", { cache: "no-store" });
    if (!res.ok) return { connected: false };
    return res.json();
  } catch {
    return { connected: false };
  }
}

export async function connectGoogleCalendar(): Promise<{ authUrl: string }> {
  const res = await fetch("/api/google-calendar/connect", { cache: "no-store" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Não foi possível iniciar a conexão com o Google Calendar.");
  }
  const data = await res.json();
  if (data.state) {
    sessionStorage.setItem("gcal_oauth_state", data.state);
  }
  return { authUrl: data.authUrl };
}

export async function disconnectGoogleCalendar(): Promise<void> {
  const res = await fetch("/api/google-calendar/disconnect", { method: "POST" });
  if (!res.ok) {
    throw new Error("Não foi possível desconectar do Google Calendar.");
  }
}

export async function createGoogleCalendarEvent(
  input: GoogleCalendarEventInput
): Promise<GoogleCalendarEventResult> {
  const res = await fetch("/api/google-calendar/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Não foi possível criar o evento no Google Calendar.");
  }

  return res.json();
}
