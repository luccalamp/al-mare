import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import { Readable } from "stream";
import { readServerEnv } from "@/lib/server/supabaseAdmin";

export interface S3UploadResult {
  objectKey: string;
  bytes: number;
  contentType: string;
}

export interface S3MoveResult {
  moved: boolean;
  sourceKey: string;
  targetKey: string;
}

const S3_STORAGE_BUCKET = "s3";

type S3Config = {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

function readFirstServerEnv(names: string[]) {
  for (const name of names) {
    const value = readServerEnv(name);
    if (value) {
      return value;
    }
  }

  return null;
}

function getS3Config(): S3Config {
  const region = readFirstServerEnv(["AWS_S3_REGION", "AWS_REGION"]);
  const accessKeyId = readServerEnv("AWS_ACCESS_KEY_ID");
  const secretAccessKey = readServerEnv("AWS_SECRET_ACCESS_KEY");
  const bucket = readFirstServerEnv(["AWS_S3_BUCKET", "WS_BUCKET_NAME", "AWS_BUCKET_NAME"]);

  if (!region || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY sao obrigatorios. Para a regiao, use AWS_S3_REGION ou AWS_REGION. Para o bucket, use AWS_S3_BUCKET, WS_BUCKET_NAME ou AWS_BUCKET_NAME."
    );
  }

  return {
    region,
    accessKeyId,
    secretAccessKey,
    bucket,
  };
}

function createS3Client() {
  const config = getS3Config();

  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
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

export function buildS3ObjectKey(clienteId: string, fileName: string, contentType: string, category?: string | null) {
  const safeClientRef = crypto.createHash("sha256").update(clienteId).digest("hex").slice(0, 18);
  const objectStem = sanitizeObjectStem(fileName);
  const extension = getExtensionFromMime(contentType);
  const randomSuffix = crypto.randomUUID().replace(/-/g, "");
  const now = Date.now();
  const categoryFolder = sanitizeCategory(category);

  return `almare/clientes/${safeClientRef}/${categoryFolder}/${now}_${randomSuffix}_${objectStem}.${extension}`;
}

export async function uploadToS3(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  clienteId: string,
  category?: string | null
): Promise<S3UploadResult> {
  const client = createS3Client();
  const { bucket } = getS3Config();
  const objectKey = buildS3ObjectKey(clienteId, fileName, contentType, category);

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

async function uploadS3ObjectByKey(
  client: S3Client,
  bucket: string,
  objectKey: string,
  fileBuffer: Buffer,
  contentType?: string
) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: fileBuffer,
      ContentType: contentType,
    })
  );
}

async function streamToBuffer(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function isS3ObjectMissingError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    name?: string;
    code?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };

  const names = [candidate.name, candidate.code, candidate.Code]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return names.includes("nosuchkey")
    || names.includes("notfound")
    || candidate.$metadata?.httpStatusCode === 404;
}

async function downloadS3ObjectByKey(client: S3Client, bucket: string, objectKey: string) {
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    })
  );

  const body = response.Body;
  if (!body) {
    throw new Error("Objeto S3 sem payload.");
  }

  let buffer: Buffer;
  if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === "function") {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    buffer = Buffer.from(bytes);
  } else if (body instanceof Readable) {
    buffer = await streamToBuffer(body);
  } else {
    throw new Error("Formato de stream S3 nao suportado.");
  }

  return {
    buffer,
    contentType: response.ContentType || "application/octet-stream",
    resolvedObjectKey: objectKey,
  };
}

function buildFallbackObjectKeys(objectKey: string) {
  if (/\.[a-z0-9]{2,5}$/i.test(objectKey)) {
    return [];
  }

  return ["jpg", "jpeg", "png", "webp", "avif"].map((extension) => `${objectKey}.${extension}`);
}

export async function downloadFromS3(objectKey: string) {
  const client = createS3Client();
  const { bucket } = getS3Config();

  try {
    return await downloadS3ObjectByKey(client, bucket, objectKey);
  } catch (error) {
    if (!isS3ObjectMissingError(error)) {
      throw error;
    }

    for (const fallbackObjectKey of buildFallbackObjectKeys(objectKey)) {
      try {
        return await downloadS3ObjectByKey(client, bucket, fallbackObjectKey);
      } catch (fallbackError) {
        if (!isS3ObjectMissingError(fallbackError)) {
          throw fallbackError;
        }
      }
    }

    throw error;
  }
}

export async function deleteFromS3(objectKey: string) {
  const client = createS3Client();
  const { bucket } = getS3Config();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    })
  );
}

export async function moveWithinS3(sourceKey: string, targetKey: string): Promise<S3MoveResult> {
  const normalizedSourceKey = sourceKey.trim();
  const normalizedTargetKey = targetKey.trim();

  if (!normalizedSourceKey || !normalizedTargetKey) {
    throw new Error("Origem e destino sao obrigatorios para mover objeto no S3.");
  }

  if (normalizedSourceKey === normalizedTargetKey) {
    return {
      moved: false,
      sourceKey: normalizedSourceKey,
      targetKey: normalizedTargetKey,
    };
  }

  const client = createS3Client();
  const { bucket } = getS3Config();

  try {
    const downloaded = await downloadFromS3(normalizedSourceKey);
    await uploadS3ObjectByKey(
      client,
      bucket,
      normalizedTargetKey,
      downloaded.buffer,
      downloaded.contentType
    );

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: downloaded.resolvedObjectKey,
      })
    );

    return {
      moved: true,
      sourceKey: downloaded.resolvedObjectKey,
      targetKey: normalizedTargetKey,
    };
  } catch (error) {
    if (isS3ObjectMissingError(error)) {
      return {
        moved: false,
        sourceKey: normalizedSourceKey,
        targetKey: normalizedTargetKey,
      };
    }

    throw error;
  }
}

export function buildS3ProxyUrl(objectKey: string) {
  const encoded = objectKey
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `/api/media/${encoded}`;
}

export function getS3StorageBucketLabel() {
  return S3_STORAGE_BUCKET;
}