import type { SupabaseClient } from "@supabase/supabase-js";
import { optimizeImageBuffer, type OptimizedImageAsset } from "@/lib/server/imageOptimization";
import { createSignedStorageUrl } from "@/lib/server/storageUrls";
import {
  STORAGE_BUCKETS,
  buildClientImageStoragePath,
  buildStorageObjectReference,
  uploadPrivateBuffer,
} from "@/lib/server/storageUpload";

export type GalleryPhotoCategory = "antes" | "depois" | "referencia";

export type StoredClientImage = {
  bucket: string;
  storagePath: string;
  optimizedStoragePath: string;
  thumbnailStoragePath: string;
  signedUrl: string | null;
  thumbnailSignedUrl: string | null;
  asset: OptimizedImageAsset;
};

export function normalizeGalleryCategory(value?: string | null): GalleryPhotoCategory {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "antes" || normalized === "depois") {
    return normalized;
  }

  return "referencia";
}

export async function storeOptimizedClientImage(input: {
  storageClient: SupabaseClient;
  clientId: string;
  category: string;
  fileBuffer: Buffer;
  mimeType?: string | null;
}) {
  const category = normalizeGalleryCategory(input.category);
  const asset = await optimizeImageBuffer({
    buffer: input.fileBuffer,
    mimeType: input.mimeType,
    maxWidth: 2000,
    thumbnailWidth: 480,
  });

  const storagePath = buildClientImageStoragePath({
    clientId: input.clientId,
    category,
    mimeType: asset.mimeType,
    variant: "main",
  });
  const thumbnailStoragePath = buildClientImageStoragePath({
    clientId: input.clientId,
    category,
    mimeType: asset.thumbnailMimeType,
    variant: "thumb",
  });

  await uploadPrivateBuffer(input.storageClient, {
    bucket: STORAGE_BUCKETS.gallery,
    path: storagePath,
    buffer: asset.optimizedBuffer,
    contentType: asset.mimeType,
  });
  await uploadPrivateBuffer(input.storageClient, {
    bucket: STORAGE_BUCKETS.gallery,
    path: thumbnailStoragePath,
    buffer: asset.thumbnailBuffer,
    contentType: asset.thumbnailMimeType,
  });

  return {
    bucket: STORAGE_BUCKETS.gallery,
    storagePath,
    optimizedStoragePath: storagePath,
    thumbnailStoragePath,
    signedUrl: await createSignedStorageUrl(input.storageClient, {
      storageBucket: STORAGE_BUCKETS.gallery,
      storagePath,
    }),
    thumbnailSignedUrl: await createSignedStorageUrl(input.storageClient, {
      storageBucket: STORAGE_BUCKETS.gallery,
      storagePath: thumbnailStoragePath,
    }),
    asset,
  } satisfies StoredClientImage;
}

export async function insertClientPhoto(input: {
  dbClient: SupabaseClient;
  clientId: string;
  category: GalleryPhotoCategory;
  caption?: string | null;
  storedImage: StoredClientImage;
}) {
  const { storedImage } = input;
  const { data, error } = await input.dbClient
    .from("client_photos")
    .insert({
      cliente_id: input.clientId,
      url: buildStorageObjectReference(storedImage.bucket, storedImage.storagePath),
      type: input.category,
      categoria: input.category,
      caption: input.caption || null,
      storage_bucket: storedImage.bucket,
      storage_path: storedImage.storagePath,
      optimized_storage_path: storedImage.optimizedStoragePath,
      thumbnail_storage_path: storedImage.thumbnailStoragePath,
      mime_type: storedImage.asset.mimeType,
      original_mime_type: storedImage.asset.originalMimeType,
      tamanho_original_bytes: storedImage.asset.originalBytes,
      tamanho_otimizado_bytes: storedImage.asset.optimizedBytes,
      largura: storedImage.asset.width,
      altura: storedImage.asset.height,
      formato_final: storedImage.asset.finalFormat,
      migration_status: "native",
      original_storage_provider: "supabase-storage",
      migrated_from: null,
      migrated_at: null,
      migration_error: null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error || new Error("Nao foi possivel registrar a foto.");
  }

  return {
    ...data,
    url: storedImage.signedUrl,
    thumbnail_url: storedImage.thumbnailSignedUrl,
  };
}
