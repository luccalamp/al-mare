import { google } from "googleapis";
import { Readable } from "stream";

interface DriveCredentials {
  client_email: string;
  private_key: string;
}

interface UploadResult {
  fileId: string;
  webViewLink: string;
  thumbnailLink: string | null;
}

interface UploadMetadata {
  folderPath?: string[];
  description?: string;
}

function getCredentials(): DriveCredentials {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error(
      "GOOGLE_DRIVE_CLIENT_EMAIL e GOOGLE_DRIVE_PRIVATE_KEY são obrigatórios."
    );
  }

  return {
    client_email: clientEmail.trim(),
    private_key: privateKey.replace(/\\n/g, "\n").trim(),
  };
}

function getFolderId(): string {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!folderId || folderId === "." || folderId === "..") {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID é obrigatório e deve ser um ID válido.");
  }

  return folderId.trim();
}

async function getDriveClient() {
  const credentials = getCredentials();

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  return google.drive({ version: "v3", auth });
}

async function ensureFolderPath(drive: ReturnType<typeof google.drive>, folderPath: string[]): Promise<string> {
  let targetFolderId = getFolderId();

  for (const folderName of folderPath) {
    const existing = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${targetFolderId}' in parents and trashed=false`,
      fields: "files(id)",
      spaces: "drive",
    });

    if (existing.data.files && existing.data.files.length > 0) {
      targetFolderId = existing.data.files[0].id!;
    } else {
      const newFolder = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: "application/vnd.google-apps.folder",
          parents: [targetFolderId],
        },
        fields: "id",
      });

      targetFolderId = newFolder.data.id!;
    }
  }

  return targetFolderId;
}

export async function uploadImageToDrive(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  metadata?: UploadMetadata
): Promise<UploadResult> {
  const drive = await getDriveClient();

  const targetFolderId = metadata?.folderPath
    ? await ensureFolderPath(drive, metadata.folderPath)
    : getFolderId();

  const timestamp = Date.now();
  const uniqueFilename = `${timestamp}_${filename}`;

  const bufferStream = new Readable();
  bufferStream.push(fileBuffer);
  bufferStream.push(null);

  const response = await drive.files.create({
    requestBody: {
      name: uniqueFilename,
      parents: [targetFolderId],
      description: metadata?.description,
    },
    media: {
      mimeType,
      body: bufferStream,
    },
    fields: "id, webViewLink, thumbnailLink",
  });

  return {
    fileId: response.data.id!,
    webViewLink: response.data.webViewLink || "",
    thumbnailLink: response.data.thumbnailLink || null,
  };
}

export async function deleteImageFromDrive(fileId: string): Promise<void> {
  const drive = await getDriveClient();

  await drive.files.delete({
    fileId,
  });
}

export async function getImageUrl(fileId: string): Promise<string> {
  const drive = await getDriveClient();

  const response = await drive.files.get({
    fileId,
    fields: "webViewLink",
  });

  return response.data.webViewLink || "";
}
