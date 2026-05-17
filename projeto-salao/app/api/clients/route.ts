import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildJsonError,
  isMissingColumnError,
  requireClientAccess,
  requireAuthorizedStaff,
} from "@/lib/server/tenantAccess";

const nullableTrimmedString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") {
      return null;
    }

    const trimmedValue = value.trim();
    return trimmedValue || null;
  });

const optionalNullableTrimmedString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const trimmedValue = value.trim();
    return trimmedValue || null;
  });

const createClientSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().trim().min(1),
  whatsapp: z.string().trim().min(1),
  instagramHandle: nullableTrimmedString,
  dataAniversario: nullableTrimmedString,
  photoUrl: nullableTrimmedString,
  acquisitionChannel: nullableTrimmedString,
  perfilComplementar: z.unknown().optional().default({}),
});

const updateClientSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().trim().min(1),
  whatsapp: z.string().trim().min(1),
  instagramHandle: nullableTrimmedString,
  dataAniversario: nullableTrimmedString,
  photoUrl: nullableTrimmedString,
  acquisitionChannel: nullableTrimmedString,
  perfilComplementar: z.unknown().optional().default({}),
  profilePhotoStorageBucket: optionalNullableTrimmedString,
  profilePhotoStoragePath: optionalNullableTrimmedString,
});

function buildClientMutationError(error: { message?: string } | null | undefined, fallback: string) {
  const message = error?.message || "";

  if (isMissingColumnError(message)) {
    return buildJsonError("O cadastro de pacientes ainda não está disponível neste ambiente.", 503);
  }

  if (/duplicate key value|already exists/i.test(message)) {
    return buildJsonError("Já existe um cadastro com esse identificador.", 409);
  }

  console.error("Failed to mutate client:", error);
  return buildJsonError(fallback, 500);
}

export async function POST(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso não permite cadastrar pacientes.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const parsedBody = createClientSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return buildJsonError("Dados do paciente inválidos para cadastro.", 400);
  }

  const { data, error } = await authContext.admin
    .from("clientes")
    .insert({
      id: parsedBody.data.id,
      user_id: authContext.userId,
      nome: parsedBody.data.nome,
      whatsapp: parsedBody.data.whatsapp,
      instagram_handle: parsedBody.data.instagramHandle,
      data_aniversario: parsedBody.data.dataAniversario,
      photo_url: parsedBody.data.photoUrl,
      canal_aquisicao: parsedBody.data.acquisitionChannel,
      perfil_complementar: parsedBody.data.perfilComplementar,
    })
    .select("id")
    .single();

  if (error || !data) {
    return buildClientMutationError(error, "Não foi possível cadastrar o paciente agora.");
  }

  return NextResponse.json({ id: data.id });
}

export async function PUT(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso não permite atualizar pacientes.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const parsedBody = updateClientSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return buildJsonError("Dados do paciente inválidos para atualização.", 400);
  }

  const { response } = await requireClientAccess(authContext, parsedBody.data.id, "Seu acesso não permite atualizar este paciente.");
  if (response) {
    return response || buildJsonError("Cliente inválido para esta operação.", 404);
  }

  const updatePayload = {
    nome: parsedBody.data.nome,
    whatsapp: parsedBody.data.whatsapp,
    instagram_handle: parsedBody.data.instagramHandle,
    data_aniversario: parsedBody.data.dataAniversario,
    photo_url: parsedBody.data.photoUrl,
    canal_aquisicao: parsedBody.data.acquisitionChannel,
    perfil_complementar: parsedBody.data.perfilComplementar,
    updated_at: new Date().toISOString(),
    ...(parsedBody.data.profilePhotoStorageBucket !== undefined
      ? { profile_photo_storage_bucket: parsedBody.data.profilePhotoStorageBucket }
      : {}),
    ...(parsedBody.data.profilePhotoStoragePath !== undefined
      ? { profile_photo_storage_path: parsedBody.data.profilePhotoStoragePath }
      : {}),
  };

  const { data, error } = await authContext.admin
    .from("clientes")
    .update(updatePayload)
    .eq("id", parsedBody.data.id)
    .eq("user_id", authContext.userId)
    .select("id")
    .single();

  if (error || !data) {
    return buildClientMutationError(error, "Não foi possível atualizar o paciente agora.");
  }

  return NextResponse.json({ id: data.id });
}