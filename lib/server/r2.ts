import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import { Readable } from "stream";
import { readServerEnv } from "@/lib/server/supabaseAdmin";

export interface R2UploadResult {
  objectKey: string;
  bytes: number;
  contentType: string;
}

const R2_STORAGE_BUCKET = "r2";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

function getR2Config(): R2Config {
  const accountId = readServerEnv("R2_ACCOUNT_ID");
  const accessKeyId = readServerEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = readServerEnv("R2_SECRET_ACCESS_KEY");
  const bucket = readServerEnv("R2_BUCKET");

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY e R2_BUCKET sao obrigatorios."
    );
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
  };
}

function createR2Client() {
  const config = getR2Config();

  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

function sanitizeObjectStem(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "")
    .slice(0, 20) || "img";
}

function sanitizeCategory(category?: string | null) {
  const normalized = (category || "referencia")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^-+|-+$/g, "");

  return normalized || "referencia";
}

function getExtensionFromMime(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/avif") return "avif";
  return "jpg";
}

export function buildR2ObjectKey(clienteId: string, fileName: string, contentType: string, category?: string | null) {
  const safeClientRef = crypto.createHash("sha256").update(clienteId).digest("hex").slice(0, 18);
  const objectStem = sanitizeObjectStem(fileName);
  const extension = getExtensionFromMime(contentType);
  const randomSuffix = crypto.randomUUID().replace(/-/g, "");
  const now = Date.now();
  const categoryFolder = sanitizeCategory(category);

  return `almare/clientes/${safeClientRef}/${categoryFolder}/${now}_${randomSuffix}_${objectStem}.${extension}`;
}

export async function uploadToR2(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  clienteId: string,
  category?: string | null
): Promise<R2UploadResult> {
  const client = createR2Client();
  const { bucket } = getR2Config();
  const objectKey = buildR2ObjectKey(clienteId, fileName, contentType, category);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: fileBuffer,
      ContentType: contentType,
    })
  );

  return {
    objectKey,
    bytes: fileBuffer.byteLength,
    contentType,
  };
}

async function streamToBuffer(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function downloadFromR2(objectKey: string) {
  const client = createR2Client();
  const { bucket } = getR2Config();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    })
  );

  const body = response.Body;
  if (!body) {
    throw new Error("Objeto R2 sem payload.");
  }

  let buffer: Buffer;
  if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === "function") {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    buffer = Buffer.from(bytes);
  } else if (body instanceof Readable) {
    buffer = await streamToBuffer(body);
  } else {
    throw new Error("Formato de stream R2 nao suportado.");
  }

  return {
    buffer,
    contentType: response.ContentType || "application/octet-stream",
  };
}

export async function deleteFromR2(objectKey: string) {
  const client = createR2Client();
  const { bucket } = getR2Config();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    })
  );
}

export function buildR2ProxyUrl(objectKey: string) {
  const encoded = objectKey
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `/api/media/${encoded}`;
}

export function getR2StorageBucketLabel() {
  return R2_STORAGE_BUCKET;
}
