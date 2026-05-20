import { google } from "googleapis";
import { Readable } from "stream";

const GOOGLE_DRIVE_FOLDER_PREFIX = "almare-clinica";

function getServiceAccountCredentials() {
  const candidates = [
    process.env.GOOGLE_DRIVE_CREDENTIALS,
    process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS,
    process.env.GOOGLE_SERVICE_ACCOUNT,
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed.client_email && parsed.private_key) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function getGoogleDriveClient() {
  const serviceAccount = getServiceAccountCredentials();

  if (serviceAccount) {
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    return google.drive({ version: "v3", auth });
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Configure GOOGLE_DRIVE_CREDENTIALS (Service Account JSON) no Vercel, ou defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET"
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_id: clientId,
      client_secret: clientSecret,
    },
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
      const foundId = existing.data.files[0].id;
      if (foundId) parentId = foundId;
    } else {
      const folder = await drive.files.create({
        requestBody: {
          name: part,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentId],
        },
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

export async function uploadImageToDrive(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  clienteId: string
): Promise<string> {
  const drive = getGoogleDriveClient();
  const folderPath = `${GOOGLE_DRIVE_FOLDER_PREFIX}/clientes/${clienteId}/fotos`;
  const parentId = await ensureFolderExists(drive, folderPath);

  const uniqueFilename = `${Date.now()}_${filename}`;

  const bufferStream = new Readable();
  bufferStream.push(fileBuffer);
  bufferStream.push(null);

  const response = await drive.files.create({
    requestBody: {
      name: uniqueFilename,
      parents: [parentId],
    },
    media: {
      mimeType,
      body: bufferStream,
    },
    fields: "id",
  });

  if (!response.data.id) {
    throw new Error("Falha ao obter o ID do arquivo no Google Drive");
  }

  return response.data.id;
}

export async function deleteFromGoogleDrive(driveFileId: string): Promise<void> {
  const drive = getGoogleDriveClient();
  await drive.files.delete({ fileId: driveFileId });
}

export async function getDriveFileUrl(driveFileId: string): Promise<string> {
  const drive = getGoogleDriveClient();
  const response = await drive.files.get({
    fileId: driveFileId,
    fields: "webViewLink, thumbnailLink",
  });

  return response.data.webViewLink || "";
}
