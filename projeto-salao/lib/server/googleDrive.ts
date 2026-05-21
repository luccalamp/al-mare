import { google } from "googleapis";
import { Readable } from "stream";
import { createSupabaseAdminClient, readServerEnv } from "./supabaseAdmin";
import { BRANDING_CONFIG_PREFERENCE_KEY, DEFAULT_BRANDING_CONFIG, mergeBrandingConfig } from "../brandingConfig";

const GOOGLE_DRIVE_FOLDER_ROOT = "al mare";
const GOOGLE_DRIVE_PROXY_BASE_PATH = "/api/google-drive/files";
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_DRIVE_CREDENTIAL_ENV_KEYS = [
  "GOOGLE_DRIVE_CREDENTIALS",
  "GOOGLE_SERVICE_ACCOUNT_CREDENTIALS",
  "GOOGLE_SERVICE_ACCOUNT",
  "GOOGLE_APPLICATION_CREDENTIALS_JSON",
] as const;

export interface DriveUploadResult {
  driveFileId: string;
  driveWebViewLink: string;
  driveThumbnailLink: string | null;
  driveFolderPath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  md5Checksum: string;
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  md5Checksum: string;
  webViewLink: string;
  thumbnailLink?: string;
  createdTime: string;
}

export type DriveDownloadResult = {
  buffer: Buffer;
  mimeType: string;
  originalFilename: string;
};

export type DriveSyncStatus = "pending" | "synced" | "failed" | "deleted";

type DriveFolderOptions = {
  userId?: string;
  clientName?: string | null;
  category?: string;
};

function sanitizeDriveFolderSegment(value: string | null | undefined, fallback: string) {
  const normalized = (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"'/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/g, "");

  return normalized || fallback;
}

function normalizeDriveFolderId(rawValue: string | null | undefined) {
  const trimmedValue = rawValue?.trim();
  if (!trimmedValue) {
    return undefined;
  }

  const folderMatch = trimmedValue.match(/\/folders\/([a-zA-Z0-9_-]+)/i);
  if (folderMatch?.[1]) {
    return folderMatch[1];
  }

  const queryMatch = trimmedValue.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
  if (queryMatch?.[1]) {
    return queryMatch[1];
  }

  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmedValue)) {
    return trimmedValue;
  }

  throw new Error("GOOGLE_DRIVE_FOLDER_ID precisa ser o id da pasta ou um link valido do Google Drive.");
}

function getConfiguredDriveRootFolderId() {
  return normalizeDriveFolderId(readServerEnv("GOOGLE_DRIVE_FOLDER_ID"));
}

function buildClientFolderName(clienteId: string, clientName?: string | null) {
  const shortClientId = clienteId.slice(0, 8);
  const readableName = sanitizeDriveFolderSegment(clientName, `cliente-${shortClientId}`);
  return sanitizeDriveFolderSegment(`${readableName} - ${shortClientId}`, `cliente-${shortClientId}`);
}

async function getDriveOwnerContext(userId?: string) {
  const fallbackEmail = userId ? `usuario-${userId.slice(0, 8)}` : "usuario-sem-email";
  const fallbackClinicName = sanitizeDriveFolderSegment(DEFAULT_BRANDING_CONFIG.clinicName, "organizacao-padrao");

  if (!userId) {
    return {
      ownerEmail: fallbackEmail,
      clinicName: fallbackClinicName,
    };
  }

  const supabase = createSupabaseAdminClient();

  const [userResult, brandingResult] = await Promise.all([
    supabase.auth.admin.getUserById(userId),
    supabase
      .from("clinic_preferences")
      .select("payload")
      .eq("user_id", userId)
      .eq("preference_key", BRANDING_CONFIG_PREFERENCE_KEY)
      .maybeSingle(),
  ]);

  if (userResult.error) {
    console.error("[google-drive] Failed to load auth user for folder structure:", userResult.error);
  }

  if (brandingResult.error) {
    console.error("[google-drive] Failed to load clinic branding for folder structure:", brandingResult.error);
  }

  const ownerEmail = sanitizeDriveFolderSegment(userResult.data.user?.email, fallbackEmail).toLowerCase();
  const clinicName = sanitizeDriveFolderSegment(
    brandingResult.data?.payload ? mergeBrandingConfig(brandingResult.data.payload).clinicName : DEFAULT_BRANDING_CONFIG.clinicName,
    fallbackClinicName
  );

  return {
    ownerEmail,
    clinicName,
  };
}

async function getDriveFolderStructure(clienteId: string, options?: DriveFolderOptions) {
  const ownerContext = await getDriveOwnerContext(options?.userId);
  const categoryFolder = sanitizeDriveFolderSegment(options?.category, "referencia");

  return [
    GOOGLE_DRIVE_FOLDER_ROOT,
    ownerContext.ownerEmail,
    ownerContext.clinicName,
    "clientes",
    buildClientFolderName(clienteId, options?.clientName),
    "fotos",
    categoryFolder,
  ].join("/");
}

export function buildDriveFileProxyUrl(driveFileId: string) {
  const normalizedDriveFileId = driveFileId.trim();
  if (!normalizedDriveFileId) {
    return "";
  }

  return `${GOOGLE_DRIVE_PROXY_BASE_PATH}/${encodeURIComponent(normalizedDriveFileId)}`;
}

function normalizeServiceAccountCredentials(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const clientEmail = typeof candidate.client_email === "string" ? candidate.client_email.trim() : "";
  const privateKey = typeof candidate.private_key === "string" ? candidate.private_key.replace(/\\n/g, "\n").trim() : "";

  if (!clientEmail || !privateKey) {
    return null;
  }

  return {
    ...candidate,
    client_email: clientEmail,
    private_key: privateKey,
  };
}

function getServiceAccountCredentials() {
  const clientEmail = readServerEnv("GOOGLE_DRIVE_CLIENT_EMAIL");
  const privateKey = readServerEnv("GOOGLE_DRIVE_PRIVATE_KEY");

  if (clientEmail && privateKey) {
    return {
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, "\n").trim(),
    };
  }

  let lastParseError: Error | null = null;

  for (const envName of GOOGLE_DRIVE_CREDENTIAL_ENV_KEYS) {
    const raw = readServerEnv(envName);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const normalized = normalizeServiceAccountCredentials(parsed);
      if (normalized) {
        return normalized;
      }
    } catch (error) {
      lastParseError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (lastParseError) {
    throw new Error(
      `Credenciais inválidas do Google Drive. Revise GOOGLE_DRIVE_CLIENT_EMAIL + GOOGLE_DRIVE_PRIVATE_KEY ou uma destas variáveis JSON: ${GOOGLE_DRIVE_CREDENTIAL_ENV_KEYS.join(", ")}.`
    );
  }

  return null;
}

async function getGoogleDriveClient() {
  const credentials = getServiceAccountCredentials();

  if (!credentials) {
    throw new Error(
      `Configure GOOGLE_DRIVE_CLIENT_EMAIL + GOOGLE_DRIVE_PRIVATE_KEY ou uma Service Account JSON em: ${GOOGLE_DRIVE_CREDENTIAL_ENV_KEYS.join(", ")}.`
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [GOOGLE_DRIVE_SCOPE],
  });

  return google.drive({ version: "v3", auth });
}

async function ensureFolderExists(drive: ReturnType<typeof google.drive>, folderPath: string, rootFolderId?: string): Promise<string> {
  const parts = folderPath.split("/");
  let parentId = rootFolderId || "root";
  const startIndex = rootFolderId ? 1 : 0;

  for (let i = startIndex; i < parts.length; i++) {
    const part = parts[i];
    const existing = await drive.files.list({
      q: `name='${part}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
      fields: "files(id, name)",
      spaces: "drive",
    });

    if (existing.data.files && existing.data.files.length > 0) {
      const foundId = existing.data.files[0].id;
      if (foundId) parentId = foundId;
    } else {
      const folderMetadata = {
        name: part,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      };

      const folder = await drive.files.create({
        requestBody: folderMetadata,
        fields: "id",
      });

      const folderId = folder.data.id;
      if (folderId) {
        parentId = folderId;
      }
    }
  }

  return parentId;
}

export async function uploadToGoogleDrive(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  clienteId: string,
  options?: DriveFolderOptions
): Promise<DriveUploadResult> {
  const drive = await getGoogleDriveClient();
  const folderPath = await getDriveFolderStructure(clienteId, options);
  const rootFolderId = getConfiguredDriveRootFolderId();
  const parentId = await ensureFolderExists(drive, folderPath, rootFolderId);

  const timestamp = Date.now();
  const uniqueFilename = `${timestamp}_${filename}`;

  const fileMetadata = {
    name: uniqueFilename,
    parents: [parentId],
  };

  const bufferStream = new Readable();
  bufferStream.push(fileBuffer);
  bufferStream.push(null);

  const media = {
    mimeType,
    body: bufferStream,
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: "id, name, mimeType, size, md5Checksum, webViewLink, thumbnailLink, createdTime",
  });

  const file = response.data;

  return {
    driveFileId: file.id!,
    driveWebViewLink: file.webViewLink || "",
    driveThumbnailLink: file.thumbnailLink || null,
    driveFolderPath: folderPath,
    originalFilename: filename,
    mimeType: file.mimeType || mimeType,
    sizeBytes: parseInt(file.size || "0", 10),
    md5Checksum: file.md5Checksum || "",
  };
}

export async function getDriveFileThumbnail(driveFileId: string, width = 400): Promise<string | null> {
  const drive = await getGoogleDriveClient();

  try {
    const response = await drive.files.get({
      fileId: driveFileId,
      fields: "thumbnailLink",
    });

    if (response.data.thumbnailLink) {
      return response.data.thumbnailLink
        .replace("=s220", `=s${width}`)
        .replace("=s400", `=s${width}`);
    }

    return null;
  } catch {
    return null;
  }
}

export async function getDriveFileUrl(driveFileId: string): Promise<string> {
  const drive = await getGoogleDriveClient();
  const response = await drive.files.get({
    fileId: driveFileId,
    fields: "webViewLink",
  });

  return response.data.webViewLink || "";
}

export async function deleteFromGoogleDrive(driveFileId: string): Promise<void> {
  const drive = await getGoogleDriveClient();

  await drive.files.delete({
    fileId: driveFileId,
  });
}

export async function downloadFromGoogleDrive(driveFileId: string): Promise<DriveDownloadResult> {
  const drive = await getGoogleDriveClient();

  const metadataResponse = await drive.files.get({
    fileId: driveFileId,
    fields: "name,mimeType",
  });

  const mediaResponse = await drive.files.get(
    {
      fileId: driveFileId,
      alt: "media",
    },
    {
      responseType: "arraybuffer",
    }
  );

  return {
    buffer: Buffer.from(mediaResponse.data as ArrayBuffer),
    mimeType: metadataResponse.data.mimeType || "application/octet-stream",
    originalFilename: metadataResponse.data.name || driveFileId,
  };
}

export async function saveDriveReferenceToSupabase(
  userId: string,
  clienteId: string,
  driveResult: DriveUploadResult,
  metadata: {
    category?: string;
    caption?: string;
    anotacaoTecnica?: string;
    capturedAt?: string;
  }
) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("google_drive_files")
    .insert({
      user_id: userId,
      cliente_id: clienteId,
      drive_file_id: driveResult.driveFileId,
      drive_web_view_link: driveResult.driveWebViewLink,
      drive_thumbnail_link: driveResult.driveThumbnailLink,
      original_filename: driveResult.originalFilename,
      mime_type: driveResult.mimeType,
      size_bytes: driveResult.sizeBytes,
      md5_checksum: driveResult.md5Checksum,
      category: metadata.category || "referencia",
      caption: metadata.caption,
      anotacao_tecnica: metadata.anotacaoTecnica,
      captured_at: metadata.capturedAt || new Date().toISOString(),
      drive_folder_path: driveResult.driveFolderPath,
      sync_status: "synced",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save Drive reference: ${error.message}`);
  }

  return data;
}

export async function saveClientPhotoToSupabase(
  clienteId: string,
  driveResult: DriveUploadResult,
  metadata: {
    category?: string;
    caption?: string;
    anotacaoTecnica?: string;
    capturedAt?: string;
  }
) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("client_photos")
    .insert({
      cliente_id: clienteId,
      url: buildDriveFileProxyUrl(driveResult.driveFileId),
      type: metadata.category || "referencia",
      categoria: metadata.category || "referencia",
      caption: metadata.caption,
      anotacao_tecnica: metadata.anotacaoTecnica,
      captured_at: metadata.capturedAt || new Date().toISOString(),
      storage_bucket: "google-drive",
      storage_path: driveResult.driveFileId,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to save client photo reference: ${error?.message || "Unknown error"}`);
  }

  return data;
}

export async function getOwnedDriveClient(clienteId: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nome")
    .eq("id", clienteId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate Drive client access: ${error.message}`);
  }

  return data;
}

export async function getClientDriveFiles(
  clienteId: string,
  userId: string,
  options?: {
    category?: string;
    limit?: number;
    offset?: number;
  }
) {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("google_drive_files")
    .select("*")
    .eq("cliente_id", clienteId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("captured_at", { ascending: false });

  if (options?.category) {
    query = query.eq("category", options.category);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, (options.offset + (options.limit || 20)) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch Drive files: ${error.message}`);
  }

  return data;
}

export async function softDeleteDriveFile(
  fileId: string,
  userId: string,
  reason?: string,
  syncStatus: DriveSyncStatus = "deleted"
) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("google_drive_files")
    .update({
      deleted_at: now,
      deleted_by: userId,
      delete_reason: reason || "Manual deletion",
      sync_status: syncStatus,
      last_sync_at: now,
    })
    .eq("id", fileId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to soft delete Drive file: ${error.message}`);
  }

  return data;
}

export async function softDeleteDriveFileByDriveFileId(
  driveFileId: string,
  userId: string,
  reason?: string,
  syncStatus: DriveSyncStatus = "deleted"
) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("google_drive_files")
    .select("id")
    .eq("drive_file_id", driveFileId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id) {
    return null;
  }

  return softDeleteDriveFile(data.id, userId, reason, syncStatus);
}

export async function updateDriveFileSyncStatus(
  fileId: string,
  userId: string,
  syncStatus: DriveSyncStatus,
  deleteReason?: string
) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const updatePayload: {
    sync_status: DriveSyncStatus;
    last_sync_at: string;
    delete_reason?: string;
  } = {
    sync_status: syncStatus,
    last_sync_at: now,
  };

  if (deleteReason) {
    updatePayload.delete_reason = deleteReason;
  }

  const { data, error } = await supabase
    .from("google_drive_files")
    .update(updatePayload)
    .eq("id", fileId)
    .eq("user_id", userId)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update Drive sync status: ${error.message}`);
  }

  return data;
}
