import crypto from "crypto";
import { readServerEnv } from "@/lib/server/supabaseAdmin";

function getSigningSecret() {
  const secret =
    readServerEnv("AUTH_COOKIE_SIGNING_SECRET") ||
    readServerEnv("TWO_FA_COOKIE_SECRET") ||
    readServerEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    readServerEnv("RESEND_API_KEY");

  if (!secret) {
    throw new Error("AUTH_COOKIE_SIGNING_SECRET nao configurado para assinar cookies sensiveis.");
  }

  return secret;
}

function signValue(scope: string, value: string) {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(`${scope}.${value}`)
    .digest("base64url");
}

function timingSafeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSignedJsonCookieValue(scope: string, payload: unknown) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signValue(scope, encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function readSignedJsonCookieValue<T>(scope: string, rawValue: string | undefined | null): T | null {
  if (!rawValue) {
    return null;
  }

  const [encodedPayload, signature, ...extraParts] = rawValue.split(".");
  if (!encodedPayload || !signature || extraParts.length > 0) {
    return null;
  }

  const expectedSignature = signValue(scope, encodedPayload);
  if (!timingSafeEqualText(signature, expectedSignature)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function timingSafeEqualHex(left: string, right: string) {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) {
    return false;
  }

  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
