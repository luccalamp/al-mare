import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/server/rateLimit";
import crypto from "crypto";

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

  let payload: { email: string; hash: string; exp: number };
  try {
    payload = JSON.parse(Buffer.from(payloadRaw, "base64").toString("utf8"));
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("2fa verify: failed to parse payload:", e);
    }
    return NextResponse.json({ error: "Sessão de verificação inválida." }, { status: 400 });
  }

  if (Date.now() > payload.exp) {
    return NextResponse.json({ error: "Código expirado. Solicite um novo." }, { status: 400 });
  }

  const inputHash = hashOTP(code);
  if (inputHash !== payload.hash) {
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
