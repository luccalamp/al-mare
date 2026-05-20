import { google } from "googleapis";
import { Readable } from "stream";
import { createSupabaseAdminClient } from "./supabaseAdmin";

const GOOGLE_DRIVE_FOLDER_PREFIX = "almare-clinica";

export interface DriveUploadResult {
  driveFileId: string;
  driveWebViewLink: string;
  driveThumbnailLink: string | null;
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

function getDriveFolderStructure(clienteId: string): string {
  return `${GOOGLE_DRIVE_FOLDER_PREFIX}/clientes/${clienteId}/fotos`;
}

async function getGoogleDriveClient() {
  const credentialsJson = process.env.GOOGLE_DRIVE_CREDENTIALS;
  if (!credentialsJson) {
    throw new Error("GOOGLE_DRIVE_CREDENTIALS environment variable is not set");
  }

  const credentials = JSON.parse(credentialsJson);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  return google.drive({ version: "v3", auth });
}

async function ensureFolderExists(drive: ReturnType<typeof google.drive>, folderPath: string): Promise<string> {
  const parts = folderPath.split("/");
  let parentId = "root";

  for (const part of parts) {
    const existing = await drive.files.list({
      q: `name='${part}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
      fields: "files(id, name)",
      spaces: "drive",
    });

    if (existing.data.files && existing.data.files.length > 0) {
      parentId = existing.data.files[0].id;
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

      parentId = folder.data.id;
    }
  }

  return parentId;
}

export async function uploadToGoogleDrive(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  clienteId: string
): Promise<DriveUploadResult> {
  const drive = await getGoogleDriveClient();
  const folderPath = getDriveFolderStructure(clienteId);
  const parentId = await ensureFolderExists(drive, folderPath);

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

export async function deleteFromGoogleDrive(driveFileId: string): Promise<void> {
  const drive = await getGoogleDriveClient();

  await drive.files.delete({
    fileId: driveFileId,
  });
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
  const folderPath = getDriveFolderStructure(clienteId);

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
      drive_folder_path: folderPath,
      sync_status: "synced",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save Drive reference: ${error.message}`);
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

export async function softDeleteDriveFile(fileId: string, userId: string, reason?: string) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("google_drive_files")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
      delete_reason: reason || "Manual deletion",
      sync_status: "deleted",
    })
    .eq("id", fileId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to soft delete Drive file: ${error.message}`);
  }

  return data;
}
