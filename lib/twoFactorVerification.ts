export const TWO_FACTOR_VERIFIED_COOKIE = "almare_2fa_verified";
export const TWO_FACTOR_VERIFIED_MAX_AGE_SECONDS = 8 * 60 * 60;

const TWO_FACTOR_VERIFIED_SCOPE = "auth:2fa:verified:v1";

type TwoFactorVerificationPayload = {
  sub: string;
  sid: string;
  exp: number;
};

function getSigningSecret() {
  const secret = process.env.AUTH_COOKIE_SIGNING_SECRET?.trim();
  if (!secret) {
    throw new Error("AUTH_COOKIE_SIGNING_SECRET nao configurado para validar o segundo fator.");
  }

  return secret;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function signValue(value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSigningSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${TWO_FACTOR_VERIFIED_SCOPE}.${value}`)
  );

  return bytesToBase64Url(new Uint8Array(signature));
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }

  return difference === 0;
}

export function readSessionIdFromAccessToken(accessToken: string | null | undefined) {
  if (!accessToken) {
    return null;
  }

  try {
    const [, encodedPayload] = accessToken.split(".");
    if (!encodedPayload) {
      return null;
    }

    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encodedPayload))) as {
      session_id?: unknown;
    };
    return typeof payload.session_id === "string" && payload.session_id.trim()
      ? payload.session_id
      : null;
  } catch {
    return null;
  }
}

export function readSessionIdFromClaims(claims: unknown) {
  if (!claims || typeof claims !== "object") {
    return null;
  }

  const sessionId = (claims as Record<string, unknown>).session_id;
  return typeof sessionId === "string" && sessionId.trim() ? sessionId : null;
}

export async function createTwoFactorVerificationCookieValue(userId: string, sessionId: string) {
  const payload: TwoFactorVerificationPayload = {
    sub: userId,
    sid: sessionId,
    exp: Date.now() + TWO_FACTOR_VERIFIED_MAX_AGE_SECONDS * 1000,
  };
  const encodedPayload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const signature = await signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function isTwoFactorVerificationValid(
  rawValue: string | null | undefined,
  userId: string,
  sessionId: string | null | undefined
) {
  if (!rawValue || !sessionId) {
    return false;
  }

  const [encodedPayload, encodedSignature, ...extraParts] = rawValue.split(".");
  if (!encodedPayload || !encodedSignature || extraParts.length > 0) {
    return false;
  }

  try {
    const expectedSignature = await signValue(encodedPayload);
    if (
      !timingSafeEqual(
        base64UrlToBytes(encodedSignature),
        base64UrlToBytes(expectedSignature)
      )
    ) {
      return false;
    }

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(encodedPayload))
    ) as TwoFactorVerificationPayload;

    return (
      payload.sub === userId &&
      payload.sid === sessionId &&
      Number.isFinite(payload.exp) &&
      payload.exp > Date.now()
    );
  } catch {
    return false;
  }
}
