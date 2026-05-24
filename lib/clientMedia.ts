import { Client } from "@/types";

function isRenderableImageUrl(value: string | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("blob:")
  );
}

export function getClientAvatarUrl(client: Client): string | undefined {
  if (isRenderableImageUrl(client.profile.photoUrl)) return client.profile.photoUrl;

  const preferredReference = client.gallery.find(
    (photo) => String(photo.type || "").toLowerCase().includes("refer") && isRenderableImageUrl(photo.url)
  );
  if (preferredReference) return preferredReference.url;

  const firstValidGalleryPhoto = client.gallery.find((photo) => isRenderableImageUrl(photo.url));
  return firstValidGalleryPhoto?.url;
}
