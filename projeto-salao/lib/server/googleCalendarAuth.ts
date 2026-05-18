import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const GOOGLE_TOKEN_COOKIE = "gcal_tokens";
const GOOGLE_TOKEN_MAX_AGE = 365 * 24 * 60 * 60; // 1 year
const GOOGLE_CALENDAR_CALLBACK_PATH = "/google-calendar-callback";

type StoredTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  email?: string;
};

function getGoogleClientId(): string {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || "";
  if (!clientId && process.env.NODE_ENV !== "production") {
    console.error("[gcal-config] NEXT_PUBLIC_GOOGLE_CLIENT_ID not set!");
  }
  return clientId;
}

function getGoogleClientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  if (!secret && process.env.NODE_ENV !== "production") {
    console.error("[gcal-config] GOOGLE_CLIENT_SECRET not set!");
  }
  return secret;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getRequestOrigin(request: Request): string {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

export function resolveGoogleCalendarRedirectUri(request?: Request): string {
  const explicitRedirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim();
  if (explicitRedirectUri) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[gcal-auth] Using explicit redirect URI:", explicitRedirectUri);
    }
    return trimTrailingSlash(explicitRedirectUri);
  }

  if (request) {
    const origin = trimTrailingSlash(getRequestOrigin(request));
    const uri = `${origin}${GOOGLE_CALENDAR_CALLBACK_PATH}`;
    if (process.env.NODE_ENV !== "production") {
      console.log("[gcal-auth] Resolved redirect URI from request:", uri);
    }
    return uri;
  }

  const configuredBaseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() || process.env.BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredBaseUrl) {
    const uri = `${trimTrailingSlash(configuredBaseUrl)}${GOOGLE_CALENDAR_CALLBACK_PATH}`;
    if (process.env.NODE_ENV !== "production") {
      console.log("[gcal-auth] Resolved redirect URI from env:", uri);
    }
    return uri;
  }

  throw new Error(
    "Nao foi possivel determinar a URL de retorno do Google Calendar. Configure GOOGLE_CALENDAR_REDIRECT_URI ou acesse pela URL final do app."
  );
}

export function getGoogleCalendarAuthUrl(state: string, redirectUri: string): string {
  const clientId = getGoogleClientId();
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

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  if (process.env.NODE_ENV !== "production") {
    console.log("[gcal-auth-url] Generated URL:", authUrl);
  }

  return authUrl;
}


export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  email?: string;
}> {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  if (process.env.NODE_ENV !== "production") {
    console.log("[gcal-exchange] clientId:", clientId.substring(0, 10) + "...");
    console.log("[gcal-exchange] redirectUri:", redirectUri);
  }

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
    console.error("[gcal-exchange] Google token error:", errorData);
    throw new Error(errorData.error_description || "Falha ao trocar o código por tokens.");
  }

  const tokenData = await tokenResponse.json();

  if (process.env.NODE_ENV !== "production") {
    console.log("[gcal-exchange] Token exchange successful");
  }

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

  if (process.env.NODE_ENV !== "production") {
    console.log("[gcal-refresh] Refreshing access token...");
  }

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
    const errorData = await response.json().catch(() => ({}));
    console.error("[gcal-refresh] Google refresh error:", errorData);
    throw new Error("Falha ao renovar o token de acesso.");
  }

  const data = await response.json();
  console.log("[gcal-refresh] Token refreshed successfully");
  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
  };
}

export function readStoredTokens(): StoredTokens | null {
  const cookieStore = cookies();
  const raw = cookieStore.get(GOOGLE_TOKEN_COOKIE)?.value;

  if (process.env.NODE_ENV !== "production") {
    console.log("[gcal-read] Cookie present:", !!raw);
  }

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

  if (process.env.NODE_ENV !== "production") {
    console.log("[gcal-store] Storing tokens for email:", tokens.email);
  }

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

  if (process.env.NODE_ENV !== "production") {
    console.log("[gcal-clear] Tokens cleared");
  }

  return response;
}

function getEncryptionKey(): Buffer {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) {
    console.error("[gcal-encrypt-key] GOOGLE_CLIENT_SECRET not set!");
  }
  return crypto.createHash("sha256").update(secret || "fallback-key-do-not-use-in-production").digest().slice(0, 32);
}

function encryptTokens(tokens: StoredTokens): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(JSON.stringify(tokens), "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  if (process.env.NODE_ENV !== "production") {
    console.log("[gcal-encrypt] Token encrypted for:", tokens.email);
  }

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptTokens(encrypted: string): StoredTokens | null {
  try {
    const [ivHex, authTagHex, encryptedHex] = encrypted.split(":");
    if (!ivHex || !authTagHex || !encryptedHex) {
      console.log("[gcal-decrypt] Invalid token format");
      return null;
    }

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    const parsed = JSON.parse(decrypted) as StoredTokens;

    if (process.env.NODE_ENV !== "production") {
      console.log("[gcal-decrypt] Token decrypted for:", parsed.email);
    }

    return parsed;
  } catch (err) {
    console.error("[gcal-decrypt] Decryption failed:", err);
    return null;
  }
}

export async function getValidAccessToken(): Promise<{ accessToken: string; email?: string } | null> {
  const cookieStore = cookies();
  const raw = cookieStore.get(GOOGLE_TOKEN_COOKIE)?.value;

  if (process.env.NODE_ENV !== "production") {
    console.log("[gcal-valid-token] Cookie present:", !!raw);
  }

  if (!raw) return null;

  const tokens = decryptTokens(raw);
  if (!tokens) {
    console.log("[gcal-valid-token] Token decryption failed");
    return null;
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[gcal-valid-token] Token expires at:", new Date(tokens.expires_at).toISOString());
    console.log("[gcal-valid-token] Token expired:", Date.now() >= tokens.expires_at - 60_000);
  }

  if (Date.now() >= tokens.expires_at - 60_000) {
    console.log("[gcal-valid-token] Refreshing token...");
    try {
      const refreshed = await refreshAccessToken(tokens.refresh_token);
      const updated: StoredTokens = {
        ...tokens,
        access_token: refreshed.access_token,
        expires_at: Date.now() + refreshed.expires_in * 1000,
      };
      const response = storeTokens(updated);
      response.headers.set("X-GCal-Token-Refreshed", "true");
      console.log("[gcal-valid-token] Token refreshed");
      return { accessToken: updated.access_token, email: tokens.email };
    } catch (err) {
      console.error("[gcal-valid-token] Refresh failed:", err);
      return null;
    }
  }

  console.log("[gcal-valid-token] Token valid");
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

  console.log("[gcal-create-event] Creating event:", input.summary);
  console.log("[gcal-create-event] Using email:", auth.email);

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
    console.error("[gcal-create-event] 401 Unauthorized - token expired");
    throw new Error("Sua conexão com o Google expirou. Reconecte e tente novamente.");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("[gcal-create-event] Google API error:", errorData);
    throw new Error("Não foi possível criar o evento no Google Calendar.");
  }

  const result = await response.json();
  console.log("[gcal-create-event] Event created:", result.id);
  return result;
}
