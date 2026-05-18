import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

type RequiredEnvKey = "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY";

function createSecretKeySafeFetch(apiKey: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    const authorizationHeader = headers.get("Authorization");

    if (authorizationHeader === `Bearer ${apiKey}` || authorizationHeader === "") {
      headers.delete("Authorization");
    }

    if (!headers.has("apikey")) {
      headers.set("apikey", apiKey);
    }

    return fetch(input, { ...init, headers });
  };
}

function readEnvFromDotenv(name: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "projeto salao", ".env.local"),
    path.resolve(process.cwd(), "projeto-salao", ".env.local"),
    path.resolve(__dirname, "..", "..", ".env.local"),
    path.resolve(__dirname, "..", ".env.local"),
  ];

    for (const p of candidates) {
      try {
        if (!fs.existsSync(p)) continue;
        const content = fs.readFileSync(p, "utf8");
        const re = new RegExp(`^${name.replace(/[\\-\\/\\^$*+?.()|[\\]{}]/g, "\\$&")}\\s*=\\s*(.*)$`, "mi");
        const m = content.match(re);
        if (m && m[1]) {
          let v = m[1].trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          return v;
        }
      } catch {
        // ignore and try next
      }
    }

  return null;
}

export function readServerEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  if (value) return value;

  const fromDotenv = readEnvFromDotenv(name);
  return fromDotenv?.trim() || null;
}

function readRequiredEnv(name: RequiredEnvKey) {
  const value = readServerEnv(name);
  if (value) return value;

  throw new Error(`Missing required environment variable: ${name}`);
}

export function createSupabaseAdminClient() {
  const supabaseUrl = readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const isSecretKey = serviceKey.startsWith("sb_secret_");

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    ...(isSecretKey
      ? {
          global: {
            fetch: createSecretKeySafeFetch(serviceKey),
            headers: {
              Authorization: "",
            },
          },
        }
      : {}),
  });
}

export function getAdminOperationsToken() {
  return process.env.ADMIN_OPERATIONS_TOKEN?.trim() || null;
}

export function getCronSecret() {
  return process.env.CRON_SECRET?.trim() || null;
}

export function getOptionalS3Config() {
  const region = process.env.BACKUP_S3_REGION?.trim();
  const bucket = process.env.BACKUP_S3_BUCKET?.trim();
  const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY?.trim();
  const endpoint = process.env.BACKUP_S3_ENDPOINT?.trim();
  const prefix = process.env.BACKUP_S3_PREFIX?.trim() || "salon-clinical";
  const forcePathStyle = process.env.BACKUP_S3_FORCE_PATH_STYLE === "true";

  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    endpoint: endpoint || undefined,
    prefix,
    forcePathStyle,
  };
}
