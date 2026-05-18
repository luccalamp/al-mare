import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

const PUBLIC_PATH_PREFIXES = ["/login", "/pre-consulta", "/portal", "/google-calendar-callback"];
const PUBLIC_API_PREFIXES = ["/api/pre-consultation", "/api/access/request", "/api/access/check", "/api/auth/2fa", "/api/portal", "/api/google-calendar/callback"];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });

  return to;
}

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSupabaseSession(request);
  const pathname = request.nextUrl.pathname;

  if (matchesPrefix(pathname, PUBLIC_API_PREFIXES)) {
    return response;
  }

  if (pathname.startsWith("/api/")) {
    if (user) {
      return response;
    }

    return copyCookies(
      response,
      NextResponse.json({ error: "Sua sessão expirou. Entre novamente para continuar." }, { status: 401 })
    );
  }

  if (matchesPrefix(pathname, PUBLIC_PATH_PREFIXES)) {
    if (user && pathname === "/login") {
      return copyCookies(response, NextResponse.redirect(new URL("/", request.url)));
    }

    return response;
  }

  if (user) {
    return response;
  }

  return copyCookies(response, NextResponse.redirect(new URL("/login", request.url)));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};