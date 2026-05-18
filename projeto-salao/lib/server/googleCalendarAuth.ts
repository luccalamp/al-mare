import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const GOOGLE_TOKEN_COOKIE = "gcal_tokens";
const GOOGLE_TOKEN_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

type StoredTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  email?: string;
};

function getGoogleClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || "";
}

function getGoogleClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
}

function getRedirectUri(): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://jakoliveira.com.br";
  return `${baseUrl}/google-calendar-callback`;
}

export function getGoogleCalendarAuthUrl(state: string): string {
  const clientId = getGoogleClientId();
  const redirectUri = getRedirectUri();
  const scopes = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  email?: string;
}> {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  const redirectUri = getRedirectUri();

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json().catch(() => ({}));
    throw new Error(errorData.error_description || "Falha ao trocar o código por tokens.");
  }

  const tokenData = await tokenResponse.json();

  let email: string | undefined;
  try {
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      email = userInfo.email;
    }
  } catch {
    // Email is optional
  }

  return {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_in: tokenData.expires_in,
    email,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error("Falha ao renovar o token de acesso.");
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
  };
}

export function readStoredTokens(): StoredTokens | null {
  const cookieStore = cookies();
  const raw = cookieStore.get(GOOGLE_TOKEN_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredTokens;
    if (!parsed.access_token || !parsed.refresh_token || !parsed.expires_at) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeTokens(tokens: StoredTokens): NextResponse {
  const response = NextResponse.json({ success: true });
  const encrypted = encryptTokens(tokens);

  response.cookies.set(GOOGLE_TOKEN_COOKIE, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: GOOGLE_TOKEN_MAX_AGE,
    path: "/",
  });

  return response;
}

export function clearStoredTokens(): NextResponse {
  const response = NextResponse.json({ success: true });
  response.cookies.set(GOOGLE_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}

function getEncryptionKey(): Buffer {
  const secret = process.env.GOOGLE_CLIENT_SECRET || "fallback-key-do-not-use-in-production";
  return crypto.createHash("sha256").update(secret).digest().slice(0, 32);
}

function encryptTokens(tokens: StoredTokens): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(JSON.stringify(tokens), "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptTokens(encrypted: string): StoredTokens | null {
  try {
    const [ivHex, authTagHex, encryptedHex] = encrypted.split(":");
    if (!ivHex || !authTagHex || !encryptedHex) return null;

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return JSON.parse(decrypted) as StoredTokens;
  } catch {
    return null;
  }
}

export async function getValidAccessToken(): Promise<{ accessToken: string; email?: string } | null> {
  const cookieStore = cookies();
  const raw = cookieStore.get(GOOGLE_TOKEN_COOKIE)?.value;
  if (!raw) return null;

  const tokens = decryptTokens(raw);
  if (!tokens) return null;

  if (Date.now() >= tokens.expires_at - 60_000) {
    try {
      const refreshed = await refreshAccessToken(tokens.refresh_token);
      const updated: StoredTokens = {
        ...tokens,
        access_token: refreshed.access_token,
        expires_at: Date.now() + refreshed.expires_in * 1000,
      };
      const response = storeTokens(updated);
      response.headers.set("X-GCal-Token-Refreshed", "true");
      return { accessToken: updated.access_token, email: tokens.email };
    } catch {
      return null;
    }
  }

  return { accessToken: tokens.access_token, email: tokens.email };
}

export async function createCalendarEventServer(input: {
  summary: string;
  description?: string;
  start: string;
  end: string;
  timeZone?: string;
}): Promise<{
  id: string;
  htmlLink?: string;
  organizer?: { email?: string };
}> {
  const auth = await getValidAccessToken();
  if (!auth) {
    throw new Error("Conexão com o Google Calendar não encontrada ou expirada. Reconecte e tente novamente.");
  }

  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.start, timeZone: input.timeZone },
      end: { dateTime: input.end, timeZone: input.timeZone },
    }),
  });

  if (response.status === 401) {
    throw new Error("Sua conexão com o Google expirou. Reconecte e tente novamente.");
  }

  if (!response.ok) {
    throw new Error("Não foi possível criar o evento no Google Calendar.");
  }

  return response.json();
}
