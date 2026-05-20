import {
  deleteFromGoogleDrive as removeDriveFile,
  getDriveFileUrl as resolveDriveFileUrl,
  uploadToGoogleDrive,
} from "./googleDrive";

export async function uploadImageToDrive(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  clienteId: string,
  options?: {
    userId?: string;
    clientName?: string | null;
    category?: string;
  }
): Promise<string> {
  const result = await uploadToGoogleDrive(fileBuffer, filename, mimeType, clienteId, options);
  return result.driveFileId;
}

export async function deleteFromGoogleDrive(driveFileId: string): Promise<void> {
  await removeDriveFile(driveFileId);
}

export async function getDriveFileUrl(driveFileId: string): Promise<string> {
  return resolveDriveFileUrl(driveFileId);
}
