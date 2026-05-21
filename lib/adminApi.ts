"use client";

const ADMIN_TOKEN_SESSION_KEY = "salao-admin-operations-token-v1";

function readStoredToken() {
  if (typeof window === "undefined") return null;
  const value = window.sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY)?.trim();
  return value ? value : null;
}

function storeToken(token: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ADMIN_TOKEN_SESSION_KEY, token);
}

export function setAdminOperationsToken(token: string) {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    throw new Error("A chave administrativa não pode estar vazia.");
  }

  storeToken(normalizedToken);
}

export function clearAdminOperationsToken() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ADMIN_TOKEN_SESSION_KEY);
}

export async function ensureAdminOperationsToken(
  promptMessage = "Informe a chave administrativa para liberar operacoes sensiveis de arquivamento, restore e backup."
) {
  const currentToken = readStoredToken();
  if (currentToken) {
    return currentToken;
  }

  if (typeof window === "undefined") {
    throw new Error("A chave administrativa so pode ser informada no navegador.");
  }

  const enteredToken = window.prompt(promptMessage, "")?.trim();
  if (!enteredToken) {
    throw new Error("A operacao exige a chave administrativa configurada no servidor.");
  }

  storeToken(enteredToken);
  return enteredToken;
}

export async function refreshAdminOperationsToken(
  promptMessage = "Atualize a chave administrativa desta sessao."
) {
  clearAdminOperationsToken();
  return ensureAdminOperationsToken(promptMessage);
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { error: text } : {};
}

async function performAdminRequest<T>(
  input: string,
  init: RequestInit,
  promptMessage?: string,
  allowRetry = true
): Promise<T> {
  const adminToken = await ensureAdminOperationsToken(promptMessage);
  const headers = new Headers(init.headers);
  headers.set("x-admin-token", adminToken);

  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (response.status === 401 && allowRetry) {
    await refreshAdminOperationsToken("A chave administrativa atual foi recusada. Informe uma nova chave.");
    return performAdminRequest<T>(input, init, promptMessage, false);
  }

  const payload = await parseResponse(response);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Nao foi possivel concluir a operacao administrativa agora.";
    throw new Error(message);
  }

  return payload as T;
}

export function adminGetJson<T>(path: string, promptMessage?: string) {
  return performAdminRequest<T>(path, { method: "GET", cache: "no-store" }, promptMessage);
}

export function adminPostJson<T>(path: string, body: unknown, promptMessage?: string) {
  return performAdminRequest<T>(path, { method: "POST", body: JSON.stringify(body) }, promptMessage);
}

export function adminPutJson<T>(path: string, body: unknown, promptMessage?: string) {
  return performAdminRequest<T>(path, { method: "PUT", body: JSON.stringify(body) }, promptMessage);
}
