import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Upload presigned legado desativado. Use /api/gallery/upload." },
    { status: 410 }
  );
}
