import { NextRequest, NextResponse } from "next/server";
import { getAdminOperationsToken } from "@/lib/server/supabaseAdmin";
import {
  uploadToGoogleDrive,
  saveDriveReferenceToSupabase,
  getClientDriveFiles,
  getOwnedDriveClient,
  softDeleteDriveFile,
  deleteFromGoogleDrive,
  updateDriveFileSyncStatus,
} from "@/lib/server/googleDrive";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DRIVE_CATEGORIES = new Set(["antes", "depois", "referencia", "anamnese", "documento"]);

function isAuthenticated(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const adminToken = getAdminOperationsToken();
  return !!token && !!adminToken && token === adminToken;
}

function readTrimmedString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: FormDataEntryValue | null) {
  const trimmed = readTrimmedString(value);
  return trimmed || undefined;
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function isValidDriveCategory(category?: string) {
  return !category || DRIVE_CATEGORIES.has(category);
}

function parseNonNegativeInteger(value: string | null) {
  if (value === null) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const fileEntry = formData.get("file");
    const file = fileEntry instanceof File ? fileEntry : null;
    const clienteId = readTrimmedString(formData.get("clienteId"));
    const userId = readTrimmedString(formData.get("userId"));
    const category = readOptionalString(formData.get("category"));
    const caption = readOptionalString(formData.get("caption"));
    const anotacaoTecnica = readOptionalString(formData.get("anotacaoTecnica"));
    const capturedAt = readOptionalString(formData.get("capturedAt"));

    if (!file || !clienteId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields: file, clienteId, userId" },
        { status: 400 }
      );
    }

    if (!isUuid(clienteId) || !isUuid(userId)) {
      return NextResponse.json({ error: "clienteId e userId devem ser UUIDs válidos." }, { status: 400 });
    }

    if (!isValidDriveCategory(category)) {
      return NextResponse.json({ error: "Categoria inválida para o Google Drive." }, { status: 400 });
    }

    const ownedClient = await getOwnedDriveClient(clienteId, userId);
    if (!ownedClient) {
      return NextResponse.json({ error: "Cliente não encontrado para o usuário informado." }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!buffer.byteLength) {
      return NextResponse.json({ error: "O arquivo enviado está vazio." }, { status: 400 });
    }

    const mimeType = file.type || "image/jpeg";
    const filename = file.name || `photo_${Date.now()}.jpg`;

    const driveResult = await uploadToGoogleDrive(buffer, filename, mimeType, clienteId);

    let dbRecord;
    try {
      dbRecord = await saveDriveReferenceToSupabase(userId, clienteId, driveResult, {
        category,
        caption,
        anotacaoTecnica,
        capturedAt,
      });
    } catch (error) {
      try {
        await deleteFromGoogleDrive(driveResult.driveFileId);
      } catch (cleanupError) {
        console.error("Google Drive rollback error:", cleanupError);
      }

      throw error;
    }

    return NextResponse.json({
      success: true,
      drive: driveResult,
      database: dbRecord,
    });
  } catch (error) {
    console.error("Google Drive upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const clienteId = searchParams.get("clienteId")?.trim() || "";
    const userId = searchParams.get("userId")?.trim() || "";
    const category = searchParams.get("category")?.trim() || undefined;
    const limit = parseNonNegativeInteger(searchParams.get("limit"));
    const offset = parseNonNegativeInteger(searchParams.get("offset"));

    if (!clienteId || !userId) {
      return NextResponse.json(
        { error: "Missing required params: clienteId, userId" },
        { status: 400 }
      );
    }

    if (!isUuid(clienteId) || !isUuid(userId)) {
      return NextResponse.json({ error: "clienteId e userId devem ser UUIDs válidos." }, { status: 400 });
    }

    if (!isValidDriveCategory(category)) {
      return NextResponse.json({ error: "Categoria inválida para o Google Drive." }, { status: 400 });
    }

    if (limit === null || offset === null) {
      return NextResponse.json({ error: "limit e offset devem ser inteiros não negativos." }, { status: 400 });
    }

    const ownedClient = await getOwnedDriveClient(clienteId, userId);
    if (!ownedClient) {
      return NextResponse.json({ error: "Cliente não encontrado para o usuário informado." }, { status: 404 });
    }

    const files = await getClientDriveFiles(clienteId, userId, { category, limit, offset });

    return NextResponse.json({ success: true, files });
  } catch (error) {
    console.error("Google Drive fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fetch failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const fileId = typeof body.fileId === "string" ? body.fileId.trim() : "";
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const alsoDeleteFromDrive = body.alsoDeleteFromDrive === true;

    if (!fileId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields: fileId, userId" },
        { status: 400 }
      );
    }

    if (!isUuid(fileId) || !isUuid(userId)) {
      return NextResponse.json({ error: "fileId e userId devem ser UUIDs válidos." }, { status: 400 });
    }

    let softDeleted = await softDeleteDriveFile(
      fileId,
      userId,
      "Manual deletion via API",
      alsoDeleteFromDrive ? "pending" : "deleted"
    );

    if (!softDeleted) {
      return NextResponse.json({ error: "Arquivo não encontrado para este usuário." }, { status: 404 });
    }

    let warning: string | undefined;

    if (alsoDeleteFromDrive && softDeleted.drive_file_id) {
      try {
        await deleteFromGoogleDrive(softDeleted.drive_file_id);
        softDeleted = (await updateDriveFileSyncStatus(fileId, userId, "deleted")) || softDeleted;
      } catch (error) {
        const driveDeleteMessage = error instanceof Error ? error.message : "Unknown Google Drive delete error";
        warning = "Arquivo arquivado no banco, mas a exclusão no Google Drive falhou. Verifique o driveFileId manualmente.";
        console.error("Google Drive external delete error:", error);

        try {
          softDeleted =
            (await updateDriveFileSyncStatus(
              fileId,
              userId,
              "failed",
              `${softDeleted.delete_reason || "Manual deletion via API"} | Drive removal pending: ${driveDeleteMessage}`
            )) || softDeleted;
        } catch (statusError) {
          console.error("Google Drive sync status update error:", statusError);
        }
      }
    }

    return NextResponse.json({ success: true, file: softDeleted, warning });
  } catch (error) {
    console.error("Google Drive delete error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 }
    );
  }
}
