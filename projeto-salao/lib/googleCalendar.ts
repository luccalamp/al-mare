"use client";

export const GOOGLE_CALENDAR_OAUTH_STATE_STORAGE_KEY = "gcal_oauth_state";
export const GOOGLE_CALENDAR_OAUTH_MESSAGE_TYPE = "gcal_oauth_result";

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
    console.log("[gcal-session-client] Fetching session...");
    const res = await fetch("/api/google-calendar/session", { cache: "no-store" });
    if (!res.ok) {
      console.log("[gcal-session-client] API error:", res.status);
      return { connected: false };
    }
    const data = await res.json();
    console.log("[gcal-session-client] Session:", data);
    return data;
  } catch (err) {
    console.error("[gcal-session-client] Fetch failed:", err);
    return { connected: false };
  }
}

export async function connectGoogleCalendar(): Promise<{ authUrl: string }> {
  const res = await fetch("/api/google-calendar/connect", { cache: "no-store" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.error("[gcal-connect] API error:", data);
    throw new Error(data.error || "Não foi possível iniciar a conexão com o Google Calendar.");
  }
  const data = await res.json();
  console.log("[gcal-connect] Auth URL received:", data.authUrl);
  console.log("[gcal-connect] Redirect URI:", data.redirectUri);
  if (typeof window !== "undefined" && data.state) {
    localStorage.setItem(GOOGLE_CALENDAR_OAUTH_STATE_STORAGE_KEY, data.state);
  }
  return { authUrl: data.authUrl };
}

export async function disconnectGoogleCalendar(): Promise<void> {
  console.log("[gcal-disconnect] Starting...");
  const res = await fetch("/api/google-calendar/disconnect", { method: "POST" });
  if (!res.ok) {
    console.error("[gcal-disconnect] Failed");
    throw new Error("Não foi possível desconectar do Google Calendar.");
  }
  console.log("[gcal-disconnect] Success");
}

export async function createGoogleCalendarEvent(
  input: GoogleCalendarEventInput
): Promise<GoogleCalendarEventResult> {
  console.log("[gcal-event] Creating event:", input.summary);
  const res = await fetch("/api/google-calendar/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.error("[gcal-event] API error:", data);
    throw new Error(data.error || "Não foi possível criar o evento no Google Calendar.");
  }

  const result = await res.json();
  console.log("[gcal-event] Event created:", result.id);
  return result;
}
