const MAX_UPLOADED_IMAGE_EDGE = 6000;
const MAX_UPLOADED_IMAGE_PIXELS = 40_000_000;

const JPEG_MIME_TYPE = "image/jpeg";

function getNormalizedImageName(file: File) {
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return `${baseName || "image"}.jpg`;
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

function getResizeScale(width: number, height: number) {
  const edgeScale = Math.min(1, MAX_UPLOADED_IMAGE_EDGE / Math.max(width, height));
  const pixelScale = Math.min(1, Math.sqrt(MAX_UPLOADED_IMAGE_PIXELS / (width * height)));
  return Math.min(edgeScale, pixelScale);
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

    if (scale >= 1) {
      return file;
    }

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

    const blob = await canvasToBlob(canvas, JPEG_MIME_TYPE, 0.98);
    if (!blob) return file;

    return new File([blob], getNormalizedImageName(file), { type: JPEG_MIME_TYPE });
  } catch (error) {
    console.warn("Nao foi possivel preparar a imagem para envio.", error);
    return file;
  } finally {
    URL.revokeObjectURL(source);
  }
}
