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
  const config = getCloudinaryConfig();
  cloudinary.config(config);
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
        transformation: [{ quality: "auto", fetch_format: "auto" }],
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
