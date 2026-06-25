import fs from "fs";
import path from "path";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const GALLERY_BUCKET = "anamnese-fotos";
const MAX_IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_INPUT_PIXELS = 48_000_000;
const ACCEPTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);

type ClientPhotoRow = Record<string, any> & {
  id: string;
  cliente_id: string;
  url?: string | null;
  type?: string | null;
  categoria?: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  optimized_storage_path?: string | null;
  thumbnail_storage_path?: string | null;
  migration_status?: string | null;
  legacy_s3_bucket?: string | null;
  legacy_s3_key?: string | null;
  s3_bucket?: string | null;
  s3_key?: string | null;
};

type MigrationCandidate = {
  row: ClientPhotoRow;
  source: {
    kind: "s3" | "url";
    bucket?: string;
    key?: string;
    url?: string;
  };
};

type OptimizedImage = {
  optimizedBuffer: Buffer;
  thumbnailBuffer: Buffer;
  mimeType: string;
  thumbnailMimeType: string;
  originalMimeType: string;
  optimizedBytes: number;
  thumbnailBytes: number;
  width: number | null;
  height: number | null;
  finalFormat: "avif" | "webp";
  thumbnailFormat: "avif" | "webp";
};

function readDotenvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadLocalEnv() {
  const cwd = process.cwd();
  [".env.local", ".env", path.join("..", ".env.local"), path.join("..", ".env")].forEach((fileName) =>
    readDotenvFile(path.resolve(cwd, fileName))
  );
}

function readLinkedProjectRef() {
  const direct = readEnv("SUPABASE_PROJECT_REF");
  if (direct) return direct;

  const linkedProjectRefPath = path.resolve(process.cwd(), "supabase", ".temp", "project-ref");
  if (!fs.existsSync(linkedProjectRefPath)) return null;

  return fs.readFileSync(linkedProjectRefPath, "utf8").trim() || null;
}

function readSupabaseUrl() {
  const directUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  if (directUrl) return directUrl;

  const projectRef = readLinkedProjectRef();
  return projectRef ? `https://${projectRef}.supabase.co` : null;
}

function requireMigrationRuntimeEnv() {
  const missing: string[] = [];
  const supabaseUrl = readSupabaseUrl();
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_PROJECT_REF/link Supabase");
  }

  if (!serviceRoleKey) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (missing.length > 0) {
    throw new Error(`Variaveis obrigatorias ausentes para dry-run: ${missing.join(", ")}.`);
  }

  return { supabaseUrl: supabaseUrl as string, serviceRoleKey: serviceRoleKey as string };
}

function readEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

function parseArgs() {
  const args = new Map<string, string | boolean>();
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    args.set(key, rest.length > 0 ? rest.join("=") : true);
  }

  return {
    dryRun: args.has("dry-run") || !args.has("execute"),
    limit: typeof args.get("limit") === "string" ? Number(args.get("limit")) : undefined,
    onlyId: typeof args.get("id") === "string" ? String(args.get("id")) : undefined,
    inventoryPath: typeof args.get("inventory") === "string" ? String(args.get("inventory")) : undefined,
    verbose: args.has("verbose"),
  };
}

function normalizeMimeType(mimeType?: string | null) {
  const normalized = mimeType?.split(";")[0]?.trim().toLowerCase() || "";
  return normalized === "image/jpg" ? "image/jpeg" : normalized;
}

function mimeTypeFromSharpFormat(format?: string) {
  if (format === "jpeg" || format === "jpg") return "image/jpeg";
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  if (format === "avif") return "image/avif";
  if (format === "heif") return "image/heif";
  return null;
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/avif") return "avif";
  if (mimeType === "image/webp") return "webp";
  return "bin";
}

function assertSupportedImage(mimeType: string, byteLength: number) {
  if (byteLength <= 0) throw new Error("Arquivo vazio.");
  if (byteLength > MAX_IMAGE_UPLOAD_BYTES) throw new Error("Imagem muito grande para migracao.");
  if (HEIC_MIME_TYPES.has(mimeType)) {
    throw new Error("Esta foto está em HEIC/HEIF. Envie em JPG, PNG ou WebP.");
  }
  if (mimeType && !ACCEPTED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error(`Formato nao suportado: ${mimeType}`);
  }
}

async function renderOptimizedImage(buffer: Buffer, maxWidth: number, avifQuality: number, webpQuality: number) {
  const base = sharp(buffer, { failOn: "warning", limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true });

  try {
    return {
      buffer: await base.clone().avif({ quality: avifQuality, effort: 4 }).toBuffer(),
      mimeType: "image/avif",
      format: "avif" as const,
    };
  } catch {
    return {
      buffer: await base.clone().webp({ quality: webpQuality, effort: 4 }).toBuffer(),
      mimeType: "image/webp",
      format: "webp" as const,
    };
  }
}

async function optimizeImage(buffer: Buffer, sourceMimeType?: string | null): Promise<OptimizedImage> {
  const providedMimeType = normalizeMimeType(sourceMimeType);
  assertSupportedImage(providedMimeType, buffer.byteLength);

  const metadata = await sharp(buffer, { failOn: "warning", limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  const detectedMimeType = mimeTypeFromSharpFormat(metadata.format);
  if (detectedMimeType) {
    assertSupportedImage(detectedMimeType, buffer.byteLength);
  }

  const originalMimeType = providedMimeType || detectedMimeType || "application/octet-stream";
  if (!ACCEPTED_IMAGE_MIME_TYPES.has(originalMimeType)) {
    throw new Error(`Formato nao suportado: ${originalMimeType}`);
  }

  const optimized = await renderOptimizedImage(buffer, 2000, 62, 78);
  const thumbnail = await renderOptimizedImage(buffer, 480, 50, 70);
  const outputMetadata = await sharp(optimized.buffer).metadata().catch(() => null);

  return {
    optimizedBuffer: optimized.buffer,
    thumbnailBuffer: thumbnail.buffer,
    mimeType: optimized.mimeType,
    thumbnailMimeType: thumbnail.mimeType,
    originalMimeType,
    optimizedBytes: optimized.buffer.byteLength,
    thumbnailBytes: thumbnail.buffer.byteLength,
    width: outputMetadata?.width ?? null,
    height: outputMetadata?.height ?? null,
    finalFormat: optimized.format,
    thumbnailFormat: thumbnail.format,
  };
}

function sanitizeStorageSegment(value?: string | null) {
  return (
    (value || "referencia")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "referencia"
  );
}

function isAwsUrl(value?: string | null) {
  if (!value) return false;
  return /amazonaws\.com|s3[.-][a-z0-9-]+\.amazonaws\.com|^s3:\/\//i.test(value);
}

function parseS3Url(value: string) {
  if (value.startsWith("s3://")) {
    const withoutScheme = value.slice("s3://".length);
    const slashIndex = withoutScheme.indexOf("/");
    if (slashIndex > 0) {
      return {
        bucket: withoutScheme.slice(0, slashIndex),
        key: decodeURIComponent(withoutScheme.slice(slashIndex + 1)),
      };
    }
  }

  try {
    const parsed = new URL(value);
    const hostParts = parsed.hostname.split(".");
    if (hostParts[1] === "s3" || hostParts[0].startsWith("s3-")) {
      const [, bucket, ...keyParts] = parsed.pathname.split("/");
      return { bucket, key: decodeURIComponent(keyParts.join("/")) };
    }
    if (hostParts[0]) {
      return { bucket: hostParts[0], key: decodeURIComponent(parsed.pathname.replace(/^\/+/, "")) };
    }
  } catch {
    return null;
  }

  return null;
}

function resolveSource(row: ClientPhotoRow): MigrationCandidate["source"] | null {
  const bucket = row.legacy_s3_bucket || row.s3_bucket;
  const key = row.legacy_s3_key || row.s3_key;
  if (bucket && key) {
    return { kind: "s3", bucket, key };
  }

  if (isAwsUrl(row.url)) {
    const parsedS3Url = row.url ? parseS3Url(row.url) : null;
    if (parsedS3Url?.bucket && parsedS3Url.key) {
      return { kind: "s3", bucket: parsedS3Url.bucket, key: parsedS3Url.key };
    }

    return { kind: "url", url: row.url || "" };
  }

  return null;
}

function buildTargetPaths(row: ClientPhotoRow, image: OptimizedImage) {
  const category = sanitizeStorageSegment(row.categoria || row.type || "referencia");
  const mainExtension = extensionForMimeType(image.mimeType);
  const thumbnailExtension = extensionForMimeType(image.thumbnailMimeType);
  const basePath = `${row.cliente_id}/${category}/migrated/${row.id}`;

  return {
    optimizedPath: `${basePath}.${mainExtension}`,
    thumbnailPath: `${row.cliente_id}/${category}/thumbs/migrated/${row.id}.${thumbnailExtension}`,
  };
}

function createS3Client() {
  const region = readEnv("MIGRATION_AWS_REGION", "AWS_REGION", "BACKUP_S3_REGION");
  const accessKeyId = readEnv("MIGRATION_AWS_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID", "BACKUP_S3_ACCESS_KEY_ID");
  const secretAccessKey = readEnv("MIGRATION_AWS_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY", "BACKUP_S3_SECRET_ACCESS_KEY");
  const endpoint = readEnv("MIGRATION_AWS_ENDPOINT", "AWS_ENDPOINT", "BACKUP_S3_ENDPOINT");
  const forcePathStyle = readEnv("MIGRATION_AWS_FORCE_PATH_STYLE", "BACKUP_S3_FORCE_PATH_STYLE") === "true";

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("Credenciais AWS ausentes para baixar s3_bucket/s3_key legado.");
  }

  return new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function streamToBuffer(body: any) {
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function downloadSource(source: MigrationCandidate["source"]) {
  if (source.kind === "url") {
    const response = await fetch(source.url || "");
    if (!response.ok) {
      throw new Error(`Falha ao baixar URL AWS: HTTP ${response.status}`);
    }
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get("content-type"),
    };
  }

  const s3 = createS3Client();
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: source.bucket,
      Key: source.key,
    })
  );

  return {
    buffer: await streamToBuffer(response.Body),
    mimeType: response.ContentType,
  };
}

function sanitizeError(error: unknown) {
  let message = error instanceof Error ? error.message : String(error || "Erro desconhecido");
  const secretValues = [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.MIGRATION_AWS_SECRET_ACCESS_KEY,
    process.env.AWS_SECRET_ACCESS_KEY,
    process.env.BACKUP_S3_SECRET_ACCESS_KEY,
  ].filter(Boolean) as string[];

  for (const secret of secretValues) {
    message = message.split(secret).join("[redacted]");
  }

  return message.slice(0, 500);
}

async function fetchPhotoRows(supabase: any, onlyId?: string) {
  const rows: ClientPhotoRow[] = [];
  const pageSize = 1000;

  if (onlyId) {
    const { data, error } = await supabase.from("client_photos").select("*").eq("id", onlyId).maybeSingle();
    if (error) throw error;
    return data ? [data as ClientPhotoRow] : [];
  }

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("client_photos")
      .select("*")
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    const batch = (data || []) as ClientPhotoRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  return rows;
}

function buildInventory(rows: ClientPhotoRow[], limit?: number) {
  const candidates = rows
    .filter((row) => row.migration_status !== "migrated")
    .map((row) => {
      const source = resolveSource(row);
      return source ? { row, source } : null;
    })
    .filter((item): item is MigrationCandidate => Boolean(item));

  return typeof limit === "number" && limit > 0 ? candidates.slice(0, limit) : candidates;
}

async function main() {
  loadLocalEnv();
  const options = parseArgs();
  const { supabaseUrl, serviceRoleKey } = requireMigrationRuntimeEnv();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rows = await fetchPhotoRows(supabase, options.onlyId);
  const candidates = buildInventory(rows, options.limit);
  const inventory = candidates.map(({ row, source }) => ({
    id: row.id,
    cliente_id: row.cliente_id,
    source,
    current_storage_path: row.storage_path || null,
    target_prefix: `${row.cliente_id}/${sanitizeStorageSegment(row.categoria || row.type)}/migrated/${row.id}`,
  }));

  const sourceSummary = candidates.reduce<Record<string, number>>((summary, candidate) => {
    summary[candidate.source.kind] = (summary[candidate.source.kind] || 0) + 1;
    return summary;
  }, {});

  console.log(JSON.stringify({
    mode: options.dryRun ? "dry-run" : "execute",
    totalCandidates: candidates.length,
    sourceSummary,
    ...(options.verbose ? { inventory } : {}),
  }, null, 2));

  if (options.inventoryPath) {
    fs.writeFileSync(path.resolve(process.cwd(), options.inventoryPath), JSON.stringify(inventory, null, 2));
  }

  if (options.dryRun) {
    console.log("Dry-run concluido. Nenhum arquivo foi baixado, enviado ou alterado no banco.");
    return;
  }

  let migrated = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const { row, source } = candidate;
    try {
      const downloaded = await downloadSource(source);
      const optimized = await optimizeImage(downloaded.buffer, downloaded.mimeType);
      const paths = buildTargetPaths(row, optimized);

      await supabase.storage.from(GALLERY_BUCKET).upload(paths.optimizedPath, optimized.optimizedBuffer, {
        contentType: optimized.mimeType,
        upsert: true,
      });
      await supabase.storage.from(GALLERY_BUCKET).upload(paths.thumbnailPath, optimized.thumbnailBuffer, {
        contentType: optimized.thumbnailMimeType,
        upsert: true,
      });

      const { error } = await supabase
        .from("client_photos")
        .update({
          url: `supabase://${GALLERY_BUCKET}/${paths.optimizedPath}`,
          storage_bucket: GALLERY_BUCKET,
          storage_path: paths.optimizedPath,
          optimized_storage_path: paths.optimizedPath,
          thumbnail_storage_path: paths.thumbnailPath,
          mime_type: optimized.mimeType,
          original_mime_type: optimized.originalMimeType,
          tamanho_original_bytes: downloaded.buffer.byteLength,
          tamanho_otimizado_bytes: optimized.optimizedBytes,
          largura: optimized.width,
          altura: optimized.height,
          formato_final: optimized.finalFormat,
          migrated_from: "aws-s3",
          migrated_at: new Date().toISOString(),
          migration_status: "migrated",
          migration_error: null,
          original_storage_provider: "aws-s3",
          legacy_s3_bucket: source.kind === "s3" ? source.bucket : row.legacy_s3_bucket || row.s3_bucket || null,
          legacy_s3_key: source.kind === "s3" ? source.key : row.legacy_s3_key || row.s3_key || null,
        })
        .eq("id", row.id);

      if (error) throw error;
      migrated += 1;
      console.log(`migrated ${row.id} -> ${paths.optimizedPath}`);
    } catch (error) {
      failed += 1;
      const migrationError = sanitizeError(error);
      await supabase
        .from("client_photos")
        .update({
          migration_status: "error",
          migration_error: migrationError,
        })
        .eq("id", row.id);
      console.error(`error ${row.id}: ${migrationError}`);
    }
  }

  console.log(JSON.stringify({ migrated, failed }, null, 2));
}

main().catch((error) => {
  console.error(sanitizeError(error));
  process.exitCode = 1;
});
