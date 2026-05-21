import { NextRequest, NextResponse } from "next/server";
import { downloadFromGoogleDrive } from "@/lib/server/googleDrive";
import { requireAuthorizedStaff } from "@/lib/server/tenantAccess";

export async function GET(request: NextRequest, { params }: { params: { driveFileId: string } }) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso nao permite visualizar arquivos do Drive.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const driveFileId = decodeURIComponent(params.driveFileId || "").trim();
  if (!driveFileId) {
    return NextResponse.json({ error: "driveFileId invalido." }, { status: 400 });
  }

  try {
    const file = await downloadFromGoogleDrive(driveFileId);
    const safeFilename = file.originalFilename.replace(/"/g, "'");
    const responseBody = new Blob([new Uint8Array(file.buffer)], {
      type: file.mimeType,
    });

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        "content-type": file.mimeType,
        "content-disposition": `inline; filename="${safeFilename}"`,
        "cache-control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Google Drive preview error:", error);
    const message = error instanceof Error ? error.message : "Falha ao carregar o arquivo do Drive.";
    const status = /not found|does not exist|unknown file/i.test(message) ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}