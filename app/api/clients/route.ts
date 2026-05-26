import { NextResponse } from "next/server";
import { z } from "zod";
import { buildCloudinaryProxyUrl } from "@/lib/server/cloudinary";
import { buildR2ProxyUrl, getR2StorageBucketLabel } from "@/lib/server/r2";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { createSignedStorageUrl } from "@/lib/server/storageUrls";
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

function buildClientReadError(error: { message?: string } | null | undefined) {
  const message = error?.message || "";

  if (isMissingColumnError(message)) {
    return buildJsonError("O cadastro de pacientes ainda não está disponível neste ambiente.", 503);
  }

  console.error("Failed to load clients:", error);
  return buildJsonError("Não foi possível carregar os pacientes agora.", 500);
}

type ClientMediaPhotoRow = {
  deleted_at?: string | null;
  url?: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  [key: string]: unknown;
};

type ClientMediaRow = {
  photo_url?: string | null;
  profile_photo_storage_bucket?: string | null;
  profile_photo_storage_path?: string | null;
  client_photos?: ClientMediaPhotoRow[] | null;
  [key: string]: unknown;
};

function resolveMediaUrl(
  bucket: string | null | undefined,
  path: string | null | undefined
): string | null {
  const normalizedBucket = bucket?.trim().toLowerCase();
  if (normalizedBucket === "cloudinary" && path) {
    return buildCloudinaryProxyUrl(path);
  }
  if (normalizedBucket === getR2StorageBucketLabel() && path) {
    return buildR2ProxyUrl(path);
  }
  return null;
}

async function signClientMediaUrls(rows: ClientMediaRow[]) {
  const storageAdmin = createSupabaseAdminClient();

  return Promise.all(
    rows.map(async (row) => {
      const profilePhotoUrl = resolveMediaUrl(
        row.profile_photo_storage_bucket,
        row.profile_photo_storage_path
      ) ?? await createSignedStorageUrl(storageAdmin, {
        storageBucket: row.profile_photo_storage_bucket,
        storagePath: row.profile_photo_storage_path,
        fallbackUrl: row.photo_url,
      });

      const signedGallery = Array.isArray(row.client_photos)
        ? await Promise.all(
            row.client_photos
              .filter((photo) => !photo.deleted_at)
              .map(async (photo) => ({
              ...photo,
              url: resolveMediaUrl(
                photo.storage_bucket,
                photo.storage_path
              ) ?? await createSignedStorageUrl(storageAdmin, {
                storageBucket: photo.storage_bucket,
                storagePath: photo.storage_path,
                fallbackUrl: photo.url,
              }),
              }))
          )
        : row.client_photos;

      return {
        ...row,
        photo_url: profilePhotoUrl,
        client_photos: signedGallery,
      };
    })
  );
}

export async function GET(request: Request) {
  const authContext = await requireAuthorizedStaff(request, {
    forbiddenMessage: "Seu acesso não permite carregar pacientes.",
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const { data, error } = await authContext.admin
    .from("clientes")
    .select(`
      *,
      diagnostico_capilar (*),
      historico_procedimentos (*),
      manutencao_homecare (*),
      client_photos (*),
      agendamentos (*),
      ficha_anamnese_capilar (*)
    `)
    .eq("user_id", authContext.userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return buildClientReadError(error);
  }

  const signedClients = await signClientMediaUrls(Array.isArray(data) ? data : []);

  return NextResponse.json({ clients: signedClients });
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

  const { data: existingClient, error: existingClientError } = await authContext.admin
    .from("clientes")
    .select("photo_url, profile_photo_storage_bucket, profile_photo_storage_path")
    .eq("id", parsedBody.data.id)
    .eq("user_id", authContext.userId)
    .single();

  if (existingClientError || !existingClient) {
    return buildClientMutationError(existingClientError, "Não foi possível validar a foto do paciente agora.");
  }

  const resolvedPhotoUrl =
    parsedBody.data.photoUrl !== undefined
      ? parsedBody.data.photoUrl
      : existingClient.photo_url;

  const updatePayload = {
    nome: parsedBody.data.nome,
    whatsapp: parsedBody.data.whatsapp,
    instagram_handle: parsedBody.data.instagramHandle,
    data_aniversario: parsedBody.data.dataAniversario,
    photo_url: resolvedPhotoUrl,
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
