const DEFAULT_APP_ORIGIN = "https://jakoliveira.com.br";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function parseOrigin(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  try {
    return trimTrailingSlash(new URL(normalized).origin);
  } catch {
    return null;
  }
}

export function getTrustedAppOrigin(request?: Request) {
  const configuredOrigin =
    parseOrigin(process.env.NEXT_PUBLIC_BASE_URL) ||
    parseOrigin(process.env.BASE_URL) ||
    parseOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    parseOrigin(process.env.SITE_URL);

  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (process.env.NODE_ENV !== "production" && request) {
    return new URL(request.url).origin;
  }

  return DEFAULT_APP_ORIGIN;
}

export function buildTrustedAppUrl(path: string, request?: Request) {
  return new URL(path, getTrustedAppOrigin(request)).toString();
}
