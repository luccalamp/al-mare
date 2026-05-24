import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import crypto from "crypto";
import { readServerEnv } from "./supabaseAdmin";

export interface CloudinaryUploadResult {
  publicId: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

const CLOUDINARY_RESOURCE_TYPE = "image";
const CLOUDINARY_DELIVERY_TYPE = "authenticated";

function getCloudinaryConfig() {
  const cloudName = readServerEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = readServerEnv("CLOUDINARY_API_KEY");
  const apiSecret = readServerEnv("CLOUDINARY_API_SECRET");

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET são obrigatórios."
    );
  }

  return { cloudName, apiKey, apiSecret };
}

function configureCloudinary() {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

export async function uploadToCloudinary(
  fileBuffer: Buffer,
  filename: string,
  folder: string
): Promise<CloudinaryUploadResult> {
  configureCloudinary();

  const fileStem = filename.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "").slice(0, 16) || "img";
  const publicId = `${Date.now()}_${crypto.randomUUID().replace(/-/g, "")}_${fileStem}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: CLOUDINARY_RESOURCE_TYPE,
        type: CLOUDINARY_DELIVERY_TYPE,
        overwrite: false,
        unique_filename: true,
        use_filename: false,
        allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"],
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
        } else if (!result) {
          reject(new Error("Cloudinary upload returned no result"));
        } else {
          resolve({
            publicId: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
          });
        }
      }
    );

    const bufferStream = new Readable();
    bufferStream.push(fileBuffer);
    bufferStream.push(null);
    bufferStream.pipe(uploadStream);
  });
}

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  configureCloudinary();

  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(
      publicId,
      {
        resource_type: CLOUDINARY_RESOURCE_TYPE,
        type: CLOUDINARY_DELIVERY_TYPE,
        invalidate: true,
      },
      (error) => {
        if (error) {
          reject(new Error(`Cloudinary delete failed: ${error.message}`));
        } else {
          resolve();
        }
      }
    );
  });
}

export function getCloudinarySignedUrl(
  publicId: string,
  _options?: { expiresInSeconds?: number }
): string {
  configureCloudinary();
  const expires = Math.floor(Date.now() / 1000) + 120;

  return cloudinary.url(publicId, {
    resource_type: CLOUDINARY_RESOURCE_TYPE,
    type: CLOUDINARY_DELIVERY_TYPE,
    sign_url: true,
    expires_at: expires,
    secure: true,
  });
}

export function buildCloudinaryProxyUrl(publicId: string): string {
  return `/api/media/${encodeURIComponent(publicId.trim())}`;
}

export function buildCloudinaryFolder(
  clienteId: string,
  clientName?: string | null,
  category?: string
): string {
  void clientName;
  const safeClientRef = crypto.createHash("sha256").update(clienteId).digest("hex").slice(0, 18);
  const categoryFolder = category || "referencia";
  return `almare/clientes/${safeClientRef}/${categoryFolder}`;
}
