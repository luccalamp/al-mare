import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { readSignedJsonCookieValue, timingSafeEqualHex } from "@/lib/server/signedCookie";
import crypto from "crypto";

const TWO_FA_COOKIE_SCOPE = "auth:2fa:v1";

function hashOTP(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente." },
      { status: 429 }
    );
  }

  const { code } = await request.json().catch(() => ({ code: "" }));

  if (!code || code.length !== 6) {
    return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  }

  const cookieStore = cookies();
  const payloadRaw = cookieStore.get("2fa_payload")?.value;

  if (!payloadRaw) {
    if (process.env.NODE_ENV !== "production") {
      console.error("2fa verify: no 2fa_payload cookie found");
    }
    return NextResponse.json({ error: "Sessão de verificação expirada. Solicite um novo código." }, { status: 400 });
  }

  const payload = readSignedJsonCookieValue<{ email: string; hash: string; exp: number }>(
    TWO_FA_COOKIE_SCOPE,
    payloadRaw
  );
  if (!payload) {
    if (process.env.NODE_ENV !== "production") {
      console.error("2fa verify: invalid signed payload");
    }
    return NextResponse.json({ error: "Sessão de verificação inválida." }, { status: 400 });
  }

  if (Date.now() > payload.exp) {
    return NextResponse.json({ error: "Código expirado. Solicite um novo." }, { status: 400 });
  }

  const inputHash = hashOTP(code);
  if (!timingSafeEqualHex(inputHash, payload.hash)) {
    return NextResponse.json({ error: "Código incorreto." }, { status: 401 });
  }

  const response = NextResponse.json({
    success: true,
    email: payload.email,
  });

  response.cookies.set("2fa_payload", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
