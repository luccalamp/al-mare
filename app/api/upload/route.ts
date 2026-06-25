import { NextResponse } from "next/server";

const LEGACY_UPLOAD_DISABLED_MESSAGE =
  "Upload legado desativado. Use /api/gallery/upload ou /api/documents/upload.";

export async function POST() {
  return NextResponse.json({ error: LEGACY_UPLOAD_DISABLED_MESSAGE }, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json({ error: LEGACY_UPLOAD_DISABLED_MESSAGE }, { status: 410 });
}
