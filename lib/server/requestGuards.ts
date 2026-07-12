import { NextResponse } from "next/server";
import { getAdminOperationsToken, getCronSecret } from "@/lib/server/supabaseAdmin";
import crypto from "crypto";

const ADMIN_TOKEN_COOKIE = "admin_operations_token";

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token || null;
}

function readHeaderToken(request: Request, headerName: string) {
  const token = request.headers.get(headerName)?.trim();
  return token ? token : null;
}

function readAdminTokenFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const cookie of cookieHeader.split(";")) {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name === ADMIN_TOKEN_COOKIE) {
      const rawValue = valueParts.join("=");
      try {
        return decodeURIComponent(rawValue).trim() || null;
      } catch {
        return rawValue.trim() || null;
      }
    }
  }

  return null;
}

function buildError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function hasMatchingToken(candidate: string | null, expected: string | null) {
  if (!candidate || !expected) {
    return false;
  }

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  return candidateBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
}

export function resolveOperationActor(request: Request) {
  const actor = request.headers.get("x-admin-actor")?.trim();
  return actor ? actor.slice(0, 120) : "admin-console";
}

function readAdminRequestToken(request: Request) {
  return readHeaderToken(request, "x-admin-token") || readBearerToken(request) || readAdminTokenFromCookie(request);
}

export function isAdminRequest(request: Request) {
  return hasMatchingToken(readAdminRequestToken(request), getAdminOperationsToken());
}

export function requireAdminRequest(request: Request) {
  const expectedToken = getAdminOperationsToken();
  if (!expectedToken) {
    return buildError("ADMIN_OPERATIONS_TOKEN nao foi configurado no servidor.", 500);
  }

  if (!hasMatchingToken(readAdminRequestToken(request), expectedToken)) {
    return buildError("Chave administrativa invalida.", 401);
  }

  return null;
}

export function requireCronOrAdminRequest(request: Request) {
  const adminResponse = requireAdminRequest(request);
  if (!adminResponse) {
    return null;
  }

  const expectedCronSecret = getCronSecret();
  if (!expectedCronSecret) {
    return buildError("CRON_SECRET nao foi configurado no servidor.", 500);
  }

  const candidate = readHeaderToken(request, "x-cron-secret") || readBearerToken(request);
  if (!hasMatchingToken(candidate, expectedCronSecret)) {
    return buildError("Segredo de cron invalido.", 401);
  }

  return null;
}
