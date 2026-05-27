const MAX_UPLOADED_IMAGE_EDGE = 4000;
const MAX_UPLOADED_IMAGE_PIXELS = 15_000_000;
const MAX_IMAGE_QUALITY = 0.96;
const MIN_IMAGE_QUALITY = 0.85;
const DEFAULT_IMAGE_QUALITY = 0.92;
const MIN_EFFECTIVE_SAVING_RATIO = 0.08;
const WEBP_MIME_TYPE = "image/webp";
const JPEG_MIME_TYPE = "image/jpeg";

function getNormalizedImageName(file: File) {
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return `${baseName || "image"}.jpg`;
}

function getNormalizedImageNameByMime(file: File, mimeType: string) {
  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  const extension = mimeType === WEBP_MIME_TYPE ? "webp" : "jpg";
  return `${baseName}.${extension}`;
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nao foi possivel preparar a imagem para envio."));
    image.src = source;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function roundQuality(value: number) {
  return Math.max(MIN_IMAGE_QUALITY, Math.min(MAX_IMAGE_QUALITY, Math.round(value * 100) / 100));
}

function getTargetUploadBytes(originalBytes: number, width: number, height: number) {
  const megaPixels = (width * height) / 1_000_000;
  const targetByMegapixel =
    megaPixels <= 4 ? 2_500_000 :
    megaPixels <= 8 ? 3_500_000 :
    megaPixels <= 12 ? 5_000_000 :
    megaPixels <= 20 ? 7_000_000 :
    10_000_000;

  if (originalBytes <= targetByMegapixel) return originalBytes;
  return Math.max(targetByMegapixel, Math.round(originalBytes * 0.7));
}

function getResizeScale(width: number, height: number) {
  const edgeScale = Math.min(1, MAX_UPLOADED_IMAGE_EDGE / Math.max(width, height));
  const pixelScale = Math.min(1, Math.sqrt(MAX_UPLOADED_IMAGE_PIXELS / (width * height)));
  return Math.min(edgeScale, pixelScale);
}

async function generateAdaptiveCompressedBlob(
  canvas: HTMLCanvasElement,
  originalBytes: number,
  targetBytes: number
) {
  const webpDefault = await canvasToBlob(canvas, WEBP_MIME_TYPE, DEFAULT_IMAGE_QUALITY);
  const webpSupported = Boolean(webpDefault && webpDefault.type === WEBP_MIME_TYPE);
  const mimeType = webpSupported ? WEBP_MIME_TYPE : JPEG_MIME_TYPE;

  let bestBlob = await canvasToBlob(canvas, mimeType, DEFAULT_IMAGE_QUALITY);
  if (!bestBlob) return null;

  if (bestBlob.size > targetBytes) {
    let low = MIN_IMAGE_QUALITY;
    let high = DEFAULT_IMAGE_QUALITY;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const mid = roundQuality((low + high) / 2);
      const candidate = await canvasToBlob(canvas, mimeType, mid);
      if (!candidate) break;
      bestBlob = candidate;

      if (candidate.size > targetBytes) {
        high = mid - 0.01;
      } else {
        low = mid + 0.01;
      }
    }
  }

  const sizeReducedEnough = bestBlob.size < originalBytes * (1 - MIN_EFFECTIVE_SAVING_RATIO);
  if (!sizeReducedEnough) return null;

  return bestBlob;
}

export async function normalizeImageFileForUpload(file: File) {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  if (typeof window === "undefined" || typeof document === "undefined") return file;

  const source = URL.createObjectURL(file);

  try {
    const image = await loadImage(source);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    if (!width || !height) {
      return file;
    }

    const scale = getResizeScale(width, height);
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) return file;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const targetBytes = getTargetUploadBytes(file.size, width, height);
    const adaptiveBlob = await generateAdaptiveCompressedBlob(canvas, file.size, targetBytes);
    if (adaptiveBlob) {
      return new File([adaptiveBlob], getNormalizedImageNameByMime(file, adaptiveBlob.type), { type: adaptiveBlob.type });
    }

    if (targetWidth === width && targetHeight === height) {
      return file;
    }

    const fallbackJpegBlob = await canvasToBlob(canvas, JPEG_MIME_TYPE, DEFAULT_IMAGE_QUALITY);
    if (!fallbackJpegBlob || fallbackJpegBlob.size >= file.size) return file;

    return new File([fallbackJpegBlob], getNormalizedImageName(file), { type: JPEG_MIME_TYPE });
  } catch (error) {
    console.warn("Nao foi possivel reduzir a imagem antes do envio.", error);
    return file;
  } finally {
    URL.revokeObjectURL(source);
  }
}
