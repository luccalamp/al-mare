import { Client } from "@/types";

export function getClientAvatarUrl(client: Client): string | undefined {
  if (client.profile.photoUrl) return client.profile.photoUrl;

  const preferredReference = client.gallery.find(
    (photo) => photo.type === "referencia" || photo.type === "referência"
  );
  if (preferredReference) return preferredReference.url;

  return client.gallery[0]?.url;
}