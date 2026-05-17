"use client";

type StoredGoogleCalendarSession = {
  clientId: string;
  accessToken: string;
  expiresAt: number;
  email?: string;
  scope?: string;
  tokenType?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GoogleIdentityWindow = Window & {
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          callback: (response: GoogleTokenResponse) => void;
          error_callback?: () => void;
        }) => {
          requestAccessToken: (options?: { prompt?: string }) => void;
        };
      };
    };
  };
};

export type GoogleCalendarSession = StoredGoogleCalendarSession;

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

const GOOGLE_CALENDAR_SESSION_KEY = "almare-google-calendar-session-v1";
const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

let googleScriptPromise: Promise<void> | null = null;

function getGoogleClientId() {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || "";
}

function getPublicGoogleOAuthMessage(response?: GoogleTokenResponse) {
  const errorText = `${response?.error ?? ""} ${response?.error_description ?? ""}`.toLowerCase();

  if (errorText.includes("popup_closed") || errorText.includes("user closed")) {
    return "A autenticação com Google foi cancelada antes da conclusão.";
  }

  if (errorText.includes("access_denied")) {
    return "O acesso ao Google não foi autorizado. Tente novamente se quiser continuar.";
  }

  return "Não foi possível autenticar com Google agora. Revise a configuração do OAuth e tente novamente.";
}

function readStoredSession(): StoredGoogleCalendarSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(GOOGLE_CALENDAR_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredGoogleCalendarSession;
    if (!parsed.accessToken || !parsed.expiresAt || !parsed.clientId) return null;
    if (parsed.clientId !== getGoogleClientId()) {
      window.localStorage.removeItem(GOOGLE_CALENDAR_SESSION_KEY);
      return null;
    }
    if (parsed.expiresAt <= Date.now() + 30_000) {
      window.localStorage.removeItem(GOOGLE_CALENDAR_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistSession(session: StoredGoogleCalendarSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GOOGLE_CALENDAR_SESSION_KEY, JSON.stringify(session));
}

async function fetchUserEmail(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return undefined;
  const payload = (await response.json()) as { email?: string };
  return payload.email;
}

async function loadGoogleIdentityScript() {
  if (typeof window === "undefined") {
    throw new Error("A autenticação com Google precisa rodar no navegador.");
  }

  const googleWindow = window as GoogleIdentityWindow;
  if (googleWindow.google?.accounts?.oauth2) return;

  if (!googleScriptPromise) {
    googleScriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity="true"]');
      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = GOOGLE_IDENTITY_SCRIPT;
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Não foi possível carregar o Google Identity Services."));
      document.head.appendChild(script);
    });
  }

  await googleScriptPromise;

  const timeoutAt = Date.now() + 5_000;
  while (!googleWindow.google?.accounts?.oauth2) {
    if (Date.now() >= timeoutAt) {
      throw new Error("Google Identity Services não ficou disponível após o carregamento do script.");
    }
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
}

export function getGoogleCalendarSession() {
  return readStoredSession();
}

export function disconnectGoogleCalendar() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(GOOGLE_CALENDAR_SESSION_KEY);
}

export async function connectGoogleCalendar(forcePrompt = false): Promise<GoogleCalendarSession> {
  const existing = readStoredSession();
  if (existing && !forcePrompt) {
    return existing;
  }

  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error("Defina NEXT_PUBLIC_GOOGLE_CLIENT_ID para ativar o Google Calendar via OAuth.");
  }

  await loadGoogleIdentityScript();

  const googleWindow = window as GoogleIdentityWindow;
  const oauth2 = googleWindow.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error("Google Identity Services não ficou disponível após o carregamento do script.");
  }

  return new Promise<GoogleCalendarSession>((resolve, reject) => {
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPES,
      callback: async (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(getPublicGoogleOAuthMessage(response)));
          return;
        }

        const session: StoredGoogleCalendarSession = {
          clientId,
          accessToken: response.access_token,
          expiresAt: Date.now() + Math.max((response.expires_in || 3600) - 30, 60) * 1000,
          scope: response.scope,
          tokenType: response.token_type,
          email: undefined,
        };

        try {
          session.email = await fetchUserEmail(session.accessToken);
        } catch {
          session.email = undefined;
        }

        persistSession(session);
        resolve(session);
      },
      error_callback: () => reject(new Error("Não foi possível iniciar a autenticação com Google agora. Tente novamente em instantes.")),
    });

    tokenClient.requestAccessToken({
      prompt: forcePrompt ? "select_account consent" : existing ? "" : "consent",
    });
  });
}

export async function createGoogleCalendarEvent(
  session: GoogleCalendarSession,
  input: GoogleCalendarEventInput
): Promise<GoogleCalendarEventResult> {
  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: input.summary,
      description: input.description,
      start: {
        dateTime: input.start,
        timeZone: input.timeZone,
      },
      end: {
        dateTime: input.end,
        timeZone: input.timeZone,
      },
    }),
  });

  if (response.status === 401) {
    disconnectGoogleCalendar();
    throw new Error("Sua conexão com o Google expirou. Conecte novamente e tente outra vez.");
  }

  if (!response.ok) {
    throw new Error("Não foi possível enviar o evento ao Google Calendar agora. Tente novamente em instantes.");
  }

  return (await response.json()) as GoogleCalendarEventResult;
}
