import {
  buildAppUrl,
  getConfiguredTrustedOrigin,
  parseTrustedOrigin,
  trimTrailingSlash,
} from "@/lib/trustedOrigin";

function getRequestOrigin(request?: Request) {
  if (!request) {
    return null;
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();
  const host = request.headers.get("host")?.trim();

  if ((forwardedHost || host) && forwardedProto) {
    return parseTrustedOrigin(`${forwardedProto}://${forwardedHost || host}`);
  }

  if (host) {
    const protocol = new URL(request.url).protocol || (process.env.NODE_ENV === "production" ? "https:" : "http:");
    return parseTrustedOrigin(`${protocol}//${host}`);
  }

  return parseTrustedOrigin(new URL(request.url).origin);
}

export function getTrustedAppOrigin(request?: Request) {
  const configuredOrigin = getConfiguredTrustedOrigin(process.env);
  if (configuredOrigin) {
    return configuredOrigin;
  }

  const requestOrigin = getRequestOrigin(request);
  if (requestOrigin) {
    return trimTrailingSlash(requestOrigin);
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }

  throw new Error("Configure NEXT_PUBLIC_BASE_URL, BASE_URL, NEXT_PUBLIC_APP_URL ou SITE_URL.");
}

export function buildTrustedAppUrl(path: string, request?: Request) {
  return buildAppUrl(path, getTrustedAppOrigin(request));
}
