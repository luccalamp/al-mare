import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import { readServerEnv } from "./supabaseAdmin";

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

const SIGNED_URL_DEFAULT_EXPIRY = 86_400; // 24h

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

  const timestamp = Date.now();
  const publicId = `${timestamp}_${filename.replace(/\.[^.]+$/, "")}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: "image",
        type: "authenticated",
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
        } else if (!result) {
          reject(new Error("Cloudinary upload returned no result"));
        } else {
          resolve({
            publicId: result.public_id,
            url: result.url,
            secureUrl: result.secure_url,
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
    cloudinary.uploader.destroy(publicId, (error) => {
      if (error) {
        reject(new Error(`Cloudinary delete failed: ${error.message}`));
      } else {
        resolve();
      }
    });
  });
}

export function getCloudinarySignedUrl(
  publicId: string,
  options?: { expiresInSeconds?: number }
): string {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const expiresAt = options?.expiresInSeconds ?? SIGNED_URL_DEFAULT_EXPIRY;
  const expires = Math.floor(Date.now() / 1000) + expiresAt;

  const signature = cloudinary.utils.api_sign_request(
    { public_id: publicId, expires_at: expires, type: "authenticated" },
    apiSecret
  );

  const encodedId = publicId.split("/").map(encodeURIComponent).join("/");
  return `https://res.cloudinary.com/${cloudName}/image/authenticated/${encodedId}?expires_at=${expires}&signature=${signature}&api_key=${apiKey}`;
}

export function buildCloudinaryFolder(
  clienteId: string,
  clientName?: string | null,
  category?: string
): string {
  const shortId = clienteId.slice(0, 8);
  const safeName = (clientName || `cliente-${shortId}`)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 50);
  const categoryFolder = category || "referencia";
  return `almare/clientes/${safeName}-${shortId}/${categoryFolder}`;
}
