type EnvLike = Record<string, string | undefined>;

const TRUSTED_ORIGIN_ENV_KEYS = [
  "NEXT_PUBLIC_BASE_URL",
  "BASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "SITE_URL",
] as const;

export function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function parseTrustedOrigin(value?: string | null) {
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

function parseCommaSeparatedOrigins(value?: string | null) {
  return (value || "")
    .split(",")
    .map((item) => parseTrustedOrigin(item))
    .filter((origin): origin is string => Boolean(origin));
}

export function getConfiguredTrustedOrigin(env: EnvLike = process.env) {
  for (const key of TRUSTED_ORIGIN_ENV_KEYS) {
    const origin = parseTrustedOrigin(env[key]);
    if (origin) {
      return origin;
    }
  }

  const vercelUrl = env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return parseTrustedOrigin(`https://${vercelUrl}`);
  }

  return null;
}

export function getConfiguredTrustedOrigins(env: EnvLike = process.env) {
  const origins = new Set<string>();
  const primaryOrigin = getConfiguredTrustedOrigin(env);
  if (primaryOrigin) {
    origins.add(primaryOrigin);
  }

  for (const key of TRUSTED_ORIGIN_ENV_KEYS) {
    const origin = parseTrustedOrigin(env[key]);
    if (origin) {
      origins.add(origin);
    }
  }

  const vercelUrl = env.VERCEL_URL?.trim();
  if (vercelUrl) {
    const origin = parseTrustedOrigin(`https://${vercelUrl}`);
    if (origin) {
      origins.add(origin);
    }
  }

  parseCommaSeparatedOrigins(env.TRUSTED_APP_ORIGINS).forEach((origin) => origins.add(origin));
  parseCommaSeparatedOrigins(env.NEXT_PUBLIC_TRUSTED_APP_ORIGINS).forEach((origin) => origins.add(origin));

  return origins;
}

export function getBrowserTrustedAppOrigin() {
  const configuredOrigin = getConfiguredTrustedOrigin({
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_TRUSTED_APP_ORIGINS: process.env.NEXT_PUBLIC_TRUSTED_APP_ORIGINS,
  });

  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "";
}

export function buildAppUrl(path: string, origin: string) {
  return new URL(path, origin).toString();
}
