import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, getAdminOperationsToken } from "@/lib/server/supabaseAdmin";
import {
  uploadToGoogleDrive,
  saveDriveReferenceToSupabase,
  getClientDriveFiles,
  softDeleteDriveFile,
  deleteFromGoogleDrive,
} from "@/lib/server/googleDrive";

function isAuthenticated(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const adminToken = getAdminOperationsToken();
  return !!token && token === adminToken;
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const clienteId = formData.get("clienteId") as string;
    const userId = formData.get("userId") as string;
    const category = formData.get("category") as string | undefined;
    const caption = formData.get("caption") as string | undefined;
    const anotacaoTecnica = formData.get("anotacaoTecnica") as string | undefined;

    if (!file || !clienteId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields: file, clienteId, userId" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "image/jpeg";
    const filename = file.name || `photo_${Date.now()}.jpg`;

    const driveResult = await uploadToGoogleDrive(buffer, filename, mimeType, clienteId);

    const dbRecord = await saveDriveReferenceToSupabase(userId, clienteId, driveResult, {
      category,
      caption,
      anotacaoTecnica,
    });

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
    const clienteId = searchParams.get("clienteId");
    const userId = searchParams.get("userId");
    const category = searchParams.get("category") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : undefined;

    if (!clienteId || !userId) {
      return NextResponse.json(
        { error: "Missing required params: clienteId, userId" },
        { status: 400 }
      );
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
    const { fileId, userId, alsoDeleteFromDrive } = await req.json();

    if (!fileId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields: fileId, userId" },
        { status: 400 }
      );
    }

    const softDeleted = await softDeleteDriveFile(fileId, userId, "Manual deletion via API");

    if (alsoDeleteFromDrive && softDeleted.drive_file_id) {
      await deleteFromGoogleDrive(softDeleted.drive_file_id);
    }

    return NextResponse.json({ success: true, file: softDeleted });
  } catch (error) {
    console.error("Google Drive delete error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 }
    );
  }
}
