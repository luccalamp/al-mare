import { NextResponse, type NextRequest } from "next/server";
import { checkApiRateLimit, applyRateLimitHeaders, type RateLimitCheck } from "@/lib/server/rateLimit";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

const PUBLIC_PATH_PREFIXES = ["/login", "/portal", "/google-calendar-callback", "/auth/v1/callback", "/auth/callback"];
const PUBLIC_API_PREFIXES = ["/api/access/request", "/api/access/check", "/api/auth/2fa", "/api/portal", "/api/google-calendar/callback"];
const API_ALLOWED_ORIGIN = "https://jakoliveira.com.br";

function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV !== "production";
  const isPreviewDeployment = process.env.VERCEL_ENV === "preview";
  const { supabaseUrl } = getSupabasePublicConfig();
  const supabaseParsedUrl = supabaseUrl ? new URL(supabaseUrl) : null;
  const supabaseOrigin = supabaseParsedUrl?.origin || null;
  const supabaseHostname = supabaseParsedUrl?.hostname || "";
  const supabaseWsOrigin = supabaseOrigin?.replace(/^http/i, "ws") || null;
  const supabaseProjectRef = supabaseHostname.split(".")[0] || null;
  const supabaseStorageOrigin = supabaseHostname.endsWith(".supabase.co") && supabaseProjectRef
    ? `https://${supabaseProjectRef}.storage.supabase.co`
    : null;
  const s3Bucket = process.env.WS_BUCKET_NAME || process.env.AWS_S3_BUCKET || "";
  const s3Region = process.env.AWS_S3_REGION || process.env.AWS_REGION || "";
  const s3Endpoint = s3Bucket && s3Region ? `https://${s3Bucket}.s3.${s3Region}.amazonaws.com` : null;

  const imgSrc = ["'self'", "data:", "blob:"];
  const connectSrc = ["'self'"];
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "https://va.vercel-scripts.com",
  ];

  if (!isPreviewDeployment) {
    scriptSrc.push("'strict-dynamic'");
  }

  if (isPreviewDeployment) {
    scriptSrc.push("https://vercel.live");
    connectSrc.push("https://vercel.live", "wss://vercel.live");
  }

  if (isDev) {
    scriptSrc.push("'unsafe-eval'");
  }

  if (supabaseOrigin) {
    imgSrc.push(supabaseOrigin);
    connectSrc.push(supabaseOrigin);
  }

  if (supabaseWsOrigin) {
    connectSrc.push(supabaseWsOrigin);
  }

  if (supabaseStorageOrigin) {
    connectSrc.push(supabaseStorageOrigin);
  }

  if (s3Endpoint) {
    connectSrc.push(s3Endpoint);
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com data:",
    `img-src ${imgSrc.join(" ")}`,
    `connect-src ${connectSrc.join(" ")}`,
    "frame-src 'self' https://accounts.google.com https://vercel.live",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });

  return to;
}

function appendVaryHeader(response: NextResponse, value: string) {
  const existing = response.headers.get("Vary");
  const varyValues = new Set(
    (existing || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );

  varyValues.add(value);
  response.headers.set("Vary", Array.from(varyValues).join(", "));

  return response;
}

function applyResponseHeaders(
  response: NextResponse,
  pathname: string,
  nonce: string,
  rateLimit?: RateLimitCheck
) {
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  response.headers.set("x-vercel-id", "");

  if (pathname.startsWith("/api/")) {
    response.headers.set("Access-Control-Allow-Origin", API_ALLOWED_ORIGIN);
    appendVaryHeader(response, "Origin");
  }

  if (rateLimit) {
    applyRateLimitHeaders(response, rateLimit);
  }

  return response;
}

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID()).replace(/=+$/g, "");
  const cspHeader = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const { response, user } = await updateSupabaseSession(request, requestHeaders);
  const pathname = request.nextUrl.pathname;

  const isApiRoute = pathname.startsWith("/api/");
  const isPublicApiRoute = matchesPrefix(pathname, PUBLIC_API_PREFIXES);

  let rateLimit: RateLimitCheck | undefined;
  if (isApiRoute && request.method !== "OPTIONS") {
    rateLimit = await checkApiRateLimit(request, {
      isPublic: isPublicApiRoute,
      userId: user?.id,
    });

    if (!rateLimit.success) {
      return applyResponseHeaders(
        copyCookies(
          response,
          NextResponse.json({ error: "Limite de requisições excedido. Tente novamente em instantes." }, { status: 429 })
        ),
        pathname,
        nonce,
        rateLimit
      );
    }
  }

  if (isPublicApiRoute) {
    return applyResponseHeaders(response, pathname, nonce, rateLimit);
  }

  if (isApiRoute) {
    if (user) {
      return applyResponseHeaders(response, pathname, nonce, rateLimit);
    }

    return applyResponseHeaders(
      copyCookies(
        response,
        NextResponse.json({ error: "Sua sessão expirou. Entre novamente para continuar." }, { status: 401 })
      ),
      pathname,
      nonce,
      rateLimit
    );
  }

  if (matchesPrefix(pathname, PUBLIC_PATH_PREFIXES)) {
    if (user && pathname === "/login") {
      return applyResponseHeaders(copyCookies(response, NextResponse.redirect(new URL("/", request.url))), pathname, nonce);
    }

    return applyResponseHeaders(response, pathname, nonce);
  }

  if (user) {
    return applyResponseHeaders(response, pathname, nonce);
  }

  return applyResponseHeaders(copyCookies(response, NextResponse.redirect(new URL("/login", request.url))), pathname, nonce);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};