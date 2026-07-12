import { NextResponse, type NextRequest } from "next/server";
import { checkApiRateLimit, applyRateLimitHeaders, type RateLimitCheck } from "@/lib/server/rateLimit";
import { getTrustedAppOrigin } from "@/lib/server/trustedOrigin";
import { getConfiguredTrustedOrigins, parseTrustedOrigin } from "@/lib/trustedOrigin";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { updateSupabaseSession } from "@/lib/supabase/middleware";
import {
  isTwoFactorVerificationValid,
  TWO_FACTOR_VERIFIED_COOKIE,
} from "@/lib/twoFactorVerification";

const PUBLIC_PATH_PREFIXES = ["/login", "/portal", "/google-calendar-callback", "/auth/v1/callback", "/auth/callback", "/auth/confirm"];
const PUBLIC_API_PREFIXES = [
  "/api/access/request",
  "/api/access/check",
  "/api/auth/2fa",
  "/api/auth/oauth",
  "/api/auth/password",
  "/api/auth/session",
  "/api/auth/signout",
  "/api/portal",
  "/api/google-calendar/callback",
];
const UNSAFE_API_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV !== "production";
  const isPreviewDeployment = process.env.VERCEL_ENV === "preview";
  const { supabaseUrl } = getSupabasePublicConfig();
  let supabaseParsedUrl: URL | null = null;
  try {
    supabaseParsedUrl = supabaseUrl ? new URL(supabaseUrl) : null;
  } catch {
    supabaseParsedUrl = null;
  }
  const supabaseOrigin = supabaseParsedUrl?.origin || null;
  const supabaseHostname = supabaseParsedUrl?.hostname || "";
  const supabaseWsOrigin = supabaseOrigin?.replace(/^http/i, "ws") || null;
  const supabaseProjectRef = supabaseHostname.split(".")[0] || null;
  const supabaseStorageOrigin = supabaseHostname.endsWith(".supabase.co") && supabaseProjectRef
    ? `https://${supabaseProjectRef}.storage.supabase.co`
    : null;
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

function normalizeOrigin(value?: string | null) {
  return parseTrustedOrigin(value);
}

function getCurrentRequestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();
  const host = request.headers.get("host")?.trim();

  if ((forwardedHost || host) && forwardedProto) {
    return normalizeOrigin(`${forwardedProto}://${forwardedHost || host}`);
  }

  if (host) {
    const protocol = request.nextUrl.protocol || (process.env.NODE_ENV === "production" ? "https:" : "http:");
    return normalizeOrigin(`${protocol}//${host}`);
  }

  return normalizeOrigin(request.nextUrl.origin);
}

function getAllowedApiOrigins(request: NextRequest) {
  const origins = getConfiguredTrustedOrigins(process.env);

  const currentRequestOrigin = getCurrentRequestOrigin(request);
  if (currentRequestOrigin) {
    origins.add(currentRequestOrigin);
  }

  if (process.env.NODE_ENV !== "production") {
    origins.add(request.nextUrl.origin);
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }

  return origins;
}

function resolveApiCorsOrigin(request: NextRequest) {
  const requestOrigin = getBrowserRequestOrigin(request);
  if (requestOrigin && getAllowedApiOrigins(request).has(requestOrigin)) {
    return requestOrigin;
  }

  return getCurrentRequestOrigin(request) || getTrustedAppOrigin(request);
}

function getBrowserRequestOrigin(request: NextRequest) {
  const origin = normalizeOrigin(request.headers.get("origin"));
  if (origin) return origin;

  const referer = request.headers.get("referer");
  return normalizeOrigin(referer);
}

function hasAllowedApiOrigin(request: NextRequest) {
  const secFetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (secFetchSite === "cross-site") {
    return false;
  }

  const origin = getBrowserRequestOrigin(request);
  if (!origin) {
    return true;
  }

  const currentRequestOrigin = getCurrentRequestOrigin(request);
  if (currentRequestOrigin && origin === currentRequestOrigin) {
    return true;
  }

  return getAllowedApiOrigins(request).has(origin);
}

function buildTrustedRedirectUrl(pathname: string, request: NextRequest) {
  return new URL(pathname, getTrustedAppOrigin(request));
}

function shouldRedirectToCanonicalAppOrigin(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  if (!["GET", "HEAD"].includes(request.method)) {
    return false;
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return false;
  }

  const currentOrigin = getCurrentRequestOrigin(request);
  if (!currentOrigin) {
    return false;
  }

  const currentUrl = new URL(currentOrigin);
  const trustedOrigin = getTrustedAppOrigin(request);
  const trustedUrl = new URL(trustedOrigin);

  if (currentUrl.origin === trustedUrl.origin) {
    return false;
  }

  return currentUrl.hostname.endsWith(".vercel.app");
}

function buildCanonicalAppUrl(request: NextRequest) {
  const trustedOrigin = getTrustedAppOrigin(request);
  const target = new URL(request.nextUrl.pathname, trustedOrigin);
  target.search = request.nextUrl.search;
  return target;
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
  request: NextRequest,
  pathname: string,
  cspHeader: string,
  rateLimit?: RateLimitCheck
) {
  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("x-vercel-id", "");

  if (pathname.startsWith("/api/")) {
    response.headers.set("Access-Control-Allow-Origin", resolveApiCorsOrigin(request));
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token, X-Cron-Secret, X-Admin-Actor");
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
  const pathname = request.nextUrl.pathname;

  if (shouldRedirectToCanonicalAppOrigin(request)) {
    return applyResponseHeaders(NextResponse.redirect(buildCanonicalAppUrl(request), 308), request, pathname, cspHeader);
  }

  const { response, user, sessionId } = await updateSupabaseSession(request, requestHeaders);
  const twoFactorVerified = user
    ? await isTwoFactorVerificationValid(
        request.cookies.get(TWO_FACTOR_VERIFIED_COOKIE)?.value,
        user.id,
        sessionId
      )
    : false;

  const isApiRoute = pathname.startsWith("/api/");
  const isPublicApiRoute = matchesPrefix(pathname, PUBLIC_API_PREFIXES);

  if (isApiRoute && request.method === "OPTIONS") {
    return applyResponseHeaders(new NextResponse(null, { status: 204 }), request, pathname, cspHeader);
  }

  if (isApiRoute && UNSAFE_API_METHODS.has(request.method) && !hasAllowedApiOrigin(request)) {
    return applyResponseHeaders(
      copyCookies(
        response,
        NextResponse.json({ error: "Origem da requisicao nao autorizada." }, { status: 403 })
      ),
      request,
      pathname,
      cspHeader
    );
  }

  let rateLimit: RateLimitCheck | undefined;
  if (isApiRoute && request.method !== "OPTIONS") {
    rateLimit = await checkApiRateLimit(request, {
      isPublic: isPublicApiRoute,
      userId: twoFactorVerified ? user?.id : undefined,
    });

    if (!rateLimit.success) {
      return applyResponseHeaders(
        copyCookies(
          response,
          NextResponse.json({ error: "Limite de requisições excedido. Tente novamente em instantes." }, { status: 429 })
        ),
        request,
        pathname,
        cspHeader,
        rateLimit
      );
    }
  }

  if (isPublicApiRoute) {
    return applyResponseHeaders(response, request, pathname, cspHeader, rateLimit);
  }

  if (isApiRoute) {
    if (user && twoFactorVerified) {
      return applyResponseHeaders(response, request, pathname, cspHeader, rateLimit);
    }

    return applyResponseHeaders(
      copyCookies(
        response,
        NextResponse.json({ error: "Sua sessão expirou. Entre novamente para continuar." }, { status: 401 })
      ),
      request,
      pathname,
      cspHeader,
      rateLimit
    );
  }

  if (matchesPrefix(pathname, PUBLIC_PATH_PREFIXES)) {
    const loginMode = request.nextUrl.searchParams.get("mode");
    const allowsLoginSession = loginMode === "setup-password" || loginMode === "reset-password";

    if (user && twoFactorVerified && pathname === "/login" && !allowsLoginSession) {
      return applyResponseHeaders(copyCookies(response, NextResponse.redirect(buildTrustedRedirectUrl("/", request))), request, pathname, cspHeader);
    }

    return applyResponseHeaders(response, request, pathname, cspHeader);
  }

  if (user && twoFactorVerified) {
    return applyResponseHeaders(response, request, pathname, cspHeader);
  }

  const loginPath = user ? "/login?status=2fa-required" : "/login";
  return applyResponseHeaders(copyCookies(response, NextResponse.redirect(buildTrustedRedirectUrl(loginPath, request))), request, pathname, cspHeader);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};
