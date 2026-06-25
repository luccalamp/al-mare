import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Confirmacao de upload legado desativada. Use /api/gallery/upload." },
    { status: 410 }
  );
}
