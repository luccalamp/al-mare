import type { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis/cloudflare";

type RateLimitProfile = {
  kind: "public" | "private";
  limit: number;
  windowMs: number;
  duration: `${number} ${"s" | "m" | "h"}`;
  prefix: string;
};

export type RateLimitCheck = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

export type LegacyRateLimitCheck = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

const PUBLIC_API_RATE_LIMIT: RateLimitProfile = {
  kind: "public",
  limit: 30,
  windowMs: 60_000,
  duration: "1 m",
  prefix: "rl:api:public",
};

const PRIVATE_API_RATE_LIMIT: RateLimitProfile = {
  kind: "private",
  limit: 300,
  windowMs: 60_000,
  duration: "1 m",
  prefix: "rl:api:private",
};

const hasUpstashConfig = Boolean(
  process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
);

const redis = hasUpstashConfig ? Redis.fromEnv() : null;

const limiters = redis
  ? {
      public: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(PUBLIC_API_RATE_LIMIT.limit, PUBLIC_API_RATE_LIMIT.duration),
        analytics: false,
        prefix: PUBLIC_API_RATE_LIMIT.prefix,
      }),
      private: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(PRIVATE_API_RATE_LIMIT.limit, PRIVATE_API_RATE_LIMIT.duration),
        analytics: false,
        prefix: PRIVATE_API_RATE_LIMIT.prefix,
      }),
    }
  : null;

const inMemoryRateLimits = new Map<string, { count: number; reset: number }>();

function getClientIdentifier(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",");
    if (firstIp?.trim()) {
      return firstIp.trim();
    }
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "anonymous";
}

function getProfile(isPublic: boolean) {
  return isPublic ? PUBLIC_API_RATE_LIMIT : PRIVATE_API_RATE_LIMIT;
}

function runInMemoryRateLimit(key: string, config: { limit: number; windowMs: number }): RateLimitCheck {
  const now = Date.now();
  const current = inMemoryRateLimits.get(key);

  if (!current || current.reset <= now) {
    const nextWindow = {
      count: 1,
      reset: now + config.windowMs,
    };

    inMemoryRateLimits.set(key, nextWindow);
    return {
      success: true,
      limit: config.limit,
      remaining: Math.max(config.limit - nextWindow.count, 0),
      reset: nextWindow.reset,
    };
  }

  current.count += 1;
  inMemoryRateLimits.set(key, current);

  return {
    success: current.count <= config.limit,
    limit: config.limit,
    remaining: Math.max(config.limit - current.count, 0),
    reset: current.reset,
  };
}

async function runRateLimit(key: string, profile: RateLimitProfile): Promise<RateLimitCheck> {
  if (!limiters) {
    return runInMemoryRateLimit(key, profile);
  }

  const limiter = profile.kind === "public" ? limiters.public : limiters.private;
  const result = await limiter.limit(key);

  return {
    success: result.success,
    limit: result.limit ?? profile.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

export async function checkApiRateLimit(
  request: NextRequest,
  input: { isPublic: boolean; userId?: string | null }
): Promise<RateLimitCheck> {
  const profile = getProfile(input.isPublic);
  const identifier = input.userId?.trim() || getClientIdentifier(request.headers);
  return runRateLimit(`${profile.prefix}:${identifier}`, profile);
}

export function checkRateLimit(
  request: Request,
  options?: { limit?: number; windowMs?: number }
): LegacyRateLimitCheck {
  const limit = options?.limit ?? PUBLIC_API_RATE_LIMIT.limit;
  const windowMs = options?.windowMs ?? PUBLIC_API_RATE_LIMIT.windowMs;
  const result = runInMemoryRateLimit(`rl:legacy:${limit}:${windowMs}:${getClientIdentifier(request.headers)}`, {
    limit,
    windowMs,
  });

  return {
    allowed: result.success,
    remaining: result.remaining,
    resetAt: result.reset,
  };
}

export function applyRateLimitHeaders(response: NextResponse, rateLimit: RateLimitCheck) {
  response.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
  response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
  response.headers.set("X-RateLimit-Reset", String(rateLimit.reset));

  if (!rateLimit.success) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.reset - Date.now()) / 1000));
    response.headers.set("Retry-After", String(retryAfterSeconds));
  }

  return response;
}
