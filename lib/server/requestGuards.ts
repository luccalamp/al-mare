import { NextResponse } from "next/server";
import { getAdminOperationsToken, getCronSecret } from "@/lib/server/supabaseAdmin";

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

function buildError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function hasMatchingToken(candidate: string | null, expected: string | null) {
  return Boolean(candidate && expected && candidate === expected);
}

export function resolveOperationActor(request: Request) {
  const actor = request.headers.get("x-admin-actor")?.trim();
  return actor ? actor.slice(0, 120) : "admin-console";
}

export function requireAdminRequest(request: Request) {
  const expectedToken = getAdminOperationsToken();
  if (!expectedToken) {
    return buildError("ADMIN_OPERATIONS_TOKEN nao foi configurado no servidor.", 500);
  }

  const candidate = readHeaderToken(request, "x-admin-token") || readBearerToken(request);
  if (!hasMatchingToken(candidate, expectedToken)) {
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
