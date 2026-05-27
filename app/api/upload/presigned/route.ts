import { NextRequest, NextResponse } from "next/server";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { requireAuthorizedStaff, requireClientAccess } from "@/lib/server/tenantAccess";
import { buildS3ObjectKey, buildS3ProxyUrl, createS3Client, getS3Config, getS3StorageBucketLabel } from "@/lib/server/s3";

export async function POST(req: NextRequest) {
  const authContext = await requireAuthorizedStaff(req, {
    forbiddenMessage: "Seu acesso nao permite fazer upload.",
  });
  if (authContext instanceof NextResponse) return authContext;

  try {
    const body = await req.json();
    const clienteId = (body.clienteId as string)?.trim();
    const originalName = (body.originalName as string)?.trim() || "photo.jpg";
    const mimeType = (body.mimeType as string)?.trim() || "image/jpeg";
    const storageCategory = (body.storageCategory as string)?.trim() || body.category;

    if (!clienteId) {
      return NextResponse.json({ error: "Missing required field: clienteId" }, { status: 400 });
    }

    const access = await requireClientAccess(
      authContext,
      clienteId,
      "Seu acesso nao permite enviar arquivos para este paciente.",
      "Cliente invalido para esta operacao."
    );
    if (access.response) return access.response;

    const objectKey = buildS3ObjectKey(clienteId, originalName, mimeType, storageCategory);
    const proxyUrl = buildS3ProxyUrl(objectKey);

    const client = createS3Client();
    const { bucket } = getS3Config();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: mimeType,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const presignedUrl = await getSignedUrl(client as any, command, { expiresIn: 900 });

    return NextResponse.json({
      presignedUrl,
      objectKey,
      proxyUrl,
      bucket: getS3StorageBucketLabel(),
    });
  } catch (error) {
    console.error("Presigned URL error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar URL de upload." },
      { status: 500 }
    );
  }
}
