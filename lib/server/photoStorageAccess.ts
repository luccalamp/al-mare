import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

export type StoredPhotoRecord = {
  id: string;
  clientId: string;
  storageBucket: string;
  storagePath: string;
};

function decodePathFragment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function buildUniqueCandidates(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );
}

function buildStoragePathCandidates(storagePath: string) {
  const normalizedPath = storagePath.trim();
  if (!normalizedPath) {
    return [];
  }

  let decodedPath = normalizedPath;
  for (let index = 0; index < 2; index += 1) {
    const nextValue = decodePathFragment(decodedPath);
    if (nextValue === decodedPath) {
      break;
    }
    decodedPath = nextValue;
  }

  const segmentEncodedPath = decodedPath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return buildUniqueCandidates([
    normalizedPath,
    decodedPath,
    segmentEncodedPath,
    encodeURIComponent(decodedPath),
  ]);
}

function buildUrlCandidates(proxyUrl: string) {
  const normalizedUrl = proxyUrl.trim();
  if (!normalizedUrl) {
    return [];
  }

  const decodedUrl = decodePathFragment(normalizedUrl);
  const mediaPrefix = "/api/media/";

  if (!decodedUrl.startsWith(mediaPrefix)) {
    return buildUniqueCandidates([normalizedUrl, decodedUrl]);
  }

  const suffix = decodedUrl.slice(mediaPrefix.length);
  const decodedSuffix = decodePathFragment(suffix);
  const segmentEncodedSuffix = decodedSuffix
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return buildUniqueCandidates([
    normalizedUrl,
    decodedUrl,
    `${mediaPrefix}${segmentEncodedSuffix}`,
    `${mediaPrefix}${encodeURIComponent(decodedSuffix)}`,
  ]);
}

function mapStoredPhotoRecord(data?: {
  id?: string | null;
  cliente_id?: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
} | null) {
  if (!data?.id || !data?.cliente_id || !data.storage_bucket || !data.storage_path) {
    return null;
  }

  return {
    id: data.id,
    clientId: data.cliente_id,
    storageBucket: data.storage_bucket,
    storagePath: data.storage_path,
  } satisfies StoredPhotoRecord;
}

export async function findPhotoRecordByUrl(proxyUrl: string) {
  const urlCandidates = buildUrlCandidates(proxyUrl);
  if (!urlCandidates.length) {
    return { data: null, error: null };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("client_photos")
    .select("id, cliente_id, storage_bucket, storage_path")
    .in("url", urlCandidates)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const mappedRecord = mapStoredPhotoRecord(data || undefined);
  if (error || !mappedRecord) {
    return {
      data: null,
      error,
    };
  }

  return {
    data: mappedRecord,
    error: null,
  };
}

export async function findPhotoRecordByStoragePath(storagePath: string) {
  const pathCandidates = buildStoragePathCandidates(storagePath);
  if (!pathCandidates.length) {
    return { data: null, error: null };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("client_photos")
    .select("id, cliente_id, storage_bucket, storage_path")
    .in("storage_path", pathCandidates)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const mappedRecord = mapStoredPhotoRecord(data || undefined);
  if (error || !mappedRecord) {
    return {
      data: null,
      error,
    };
  }

  return {
    data: mappedRecord,
    error: null,
  };
}