import sharp, { type Metadata } from "sharp";
import { extensionForMimeType } from "@/lib/server/storageUpload";

export const ACCEPTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);
const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_INPUT_PIXELS = 48_000_000;

export class ImageValidationError extends Error {
  status = 400;
}

export type OptimizedImageAsset = {
  optimizedBuffer: Buffer;
  thumbnailBuffer: Buffer;
  mimeType: string;
  thumbnailMimeType: string;
  originalMimeType: string;
  originalBytes: number;
  optimizedBytes: number;
  thumbnailBytes: number;
  width: number | null;
  height: number | null;
  finalFormat: "avif" | "webp";
  thumbnailFormat: "avif" | "webp";
  extension: string;
  thumbnailExtension: string;
};

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

function assertSupportedMimeType(mimeType: string) {
  if (HEIC_MIME_TYPES.has(mimeType)) {
    throw new ImageValidationError("Esta foto está em HEIC/HEIF. Envie em JPG, PNG ou WebP.");
  }

  if (mimeType && !ACCEPTED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new ImageValidationError("Formato de imagem nao suportado. Envie em JPG, PNG, WebP ou AVIF.");
  }
}

function assertImageSize(byteLength: number) {
  if (byteLength <= 0) {
    throw new ImageValidationError("Arquivo de imagem vazio.");
  }

  if (byteLength > MAX_IMAGE_UPLOAD_BYTES) {
    throw new ImageValidationError("Imagem muito grande. Envie um arquivo de ate 20 MB.");
  }
}

async function renderOptimizedImage(input: {
  buffer: Buffer;
  maxWidth: number;
  avifQuality: number;
  webpQuality: number;
}) {
  const base = sharp(input.buffer, { failOn: "warning", limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({ width: input.maxWidth, withoutEnlargement: true });

  try {
    return {
      buffer: await base.clone().avif({ quality: input.avifQuality, effort: 4 }).toBuffer(),
      mimeType: "image/avif",
      format: "avif" as const,
    };
  } catch {
    return {
      buffer: await base.clone().webp({ quality: input.webpQuality, effort: 4 }).toBuffer(),
      mimeType: "image/webp",
      format: "webp" as const,
    };
  }
}

export async function optimizeImageBuffer(input: {
  buffer: Buffer;
  mimeType?: string | null;
  maxWidth?: number;
  thumbnailWidth?: number;
}) {
  const providedMimeType = normalizeMimeType(input.mimeType);
  assertImageSize(input.buffer.byteLength);
  assertSupportedMimeType(providedMimeType);

  let metadata: Metadata;
  try {
    metadata = await sharp(input.buffer, { failOn: "warning", limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new ImageValidationError("Nao foi possivel ler esta imagem. Envie em JPG, PNG, WebP ou AVIF.");
  }

  const detectedMimeType = mimeTypeFromSharpFormat(metadata.format);
  if (detectedMimeType) {
    assertSupportedMimeType(detectedMimeType);
  }

  const originalMimeType = providedMimeType || detectedMimeType || "application/octet-stream";
  if (!ACCEPTED_IMAGE_MIME_TYPES.has(originalMimeType)) {
    throw new ImageValidationError("Formato de imagem nao suportado. Envie em JPG, PNG, WebP ou AVIF.");
  }

  const optimized = await renderOptimizedImage({
    buffer: input.buffer,
    maxWidth: input.maxWidth ?? 2000,
    avifQuality: 62,
    webpQuality: 78,
  });

  const thumbnail = await renderOptimizedImage({
    buffer: input.buffer,
    maxWidth: input.thumbnailWidth ?? 480,
    avifQuality: 50,
    webpQuality: 70,
  });

  const outputMetadata = await sharp(optimized.buffer).metadata().catch(() => null);

  return {
    optimizedBuffer: optimized.buffer,
    thumbnailBuffer: thumbnail.buffer,
    mimeType: optimized.mimeType,
    thumbnailMimeType: thumbnail.mimeType,
    originalMimeType,
    originalBytes: input.buffer.byteLength,
    optimizedBytes: optimized.buffer.byteLength,
    thumbnailBytes: thumbnail.buffer.byteLength,
    width: outputMetadata?.width ?? null,
    height: outputMetadata?.height ?? null,
    finalFormat: optimized.format,
    thumbnailFormat: thumbnail.format,
    extension: extensionForMimeType(optimized.mimeType),
    thumbnailExtension: extensionForMimeType(thumbnail.mimeType),
  } satisfies OptimizedImageAsset;
}
