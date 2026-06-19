import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encodeStoragePathForRoute } from "@/lib/server/mediaProxy";
import { isManagedPhotoBucket } from "@/lib/server/photoStorage";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { buildStorageUnavailablePlaceholder, createSignedStorageUrl } from "@/lib/server/storageUrls";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PORTAL_TOKEN_COOKIE = "portal_session_token";
const PORTAL_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

function isMissingColumnError(message?: string) {
  return /column .* does not exist/i.test(message || "");
}

function buildPortalMediaProxyUrl(storagePath: string) {
  return `/api/portal/media/${encodeStoragePathForRoute(storagePath)}`;
}

function readTokenFromCookie(): string | null {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(PORTAL_TOKEN_COOKIE)?.value;
    return token?.trim() || null;
  } catch {
    return null;
  }
}

async function validateAndLoadPortal(token: string) {
  if (!UUID_PATTERN.test(token)) {
    return { status: "not_found" as const, message: "Link não encontrado ou expirado." };
  }

  const supabase = createSupabaseAdminClient();

  const { data: linkData, error: linkError } = await supabase
    .from("clientes")
    .select("id, nome, portal_token, portal_active, token_pre_consulta, link_ativo, pre_consulta_respondida_em")
    .eq("portal_token", token)
    .is("deleted_at", null)
    .single();

  if (linkError) {
    if (isMissingColumnError(linkError.message)) {
      return { status: "migration_required" as const, message: "O portal ainda não está disponível." };
    }

    if (linkError.code === "PGRST116") {
      return { status: "not_found" as const, message: "Link não encontrado ou expirado." };
    }

    return { status: "error" as const, message: "Erro ao validar o link." };
  }

  if (!linkData || linkData.portal_active === false) {
    return { status: "inactive" as const, message: "Link encerrado pela clínica." };
  }

  const clientId = linkData.id;
  const clientName = linkData.nome;

  const [homecareRes, galleryRes] = await Promise.all([
    supabase
      .from("manutencao_homecare")
      .select("id, created_at, produtos_recomendados, data_retorno_sugerida, obs_cuidados, valor_total, forma_pagamento, parcelas, pago, confirmado_em")
      .eq("cliente_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("client_photos")
      .select("id, captured_at, type, url, caption, storage_bucket, storage_path")
      .eq("cliente_id", clientId)
      .is("deleted_at", null)
      .order("captured_at", { ascending: false }),
  ]);

  const signedGallery = await Promise.all(
    (galleryRes.data ?? []).map(async (photo) => ({
      id: photo.id,
      captured_at: photo.captured_at,
      type: photo.type,
      caption: photo.caption,
      url:
        (isManagedPhotoBucket(photo.storage_bucket) && typeof photo.storage_path === "string"
          ? buildPortalMediaProxyUrl(photo.storage_path)
          : await createSignedStorageUrl(supabase, {
              storageBucket: photo.storage_bucket,
              storagePath: photo.storage_path,
              fallbackUrl: photo.url,
            })) || buildStorageUnavailablePlaceholder(),
    }))
  );

  return {
    status: "ready" as const,
    clientId,
    clientName,
    homecare: homecareRes.data ?? [],
    gallery: signedGallery,
    preConsulta: {
      linkActive: linkData.link_ativo ?? false,
      respondedAt: linkData.pre_consulta_respondida_em ?? null,
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = body?.token?.trim();

    if (!token) {
      return NextResponse.json({ status: "not_found", message: "Token ausente." }, { status: 400 });
    }

    if (!UUID_PATTERN.test(token)) {
      return NextResponse.json(
        { status: "not_found", message: "Link não encontrado ou expirado." },
        { status: 400 }
      );
    }

    // Validate the token exists in the database
    const result = await validateAndLoadPortal(token);

    if (result.status === "not_found" || result.status === "inactive" || result.status === "error" || result.status === "migration_required") {
      return NextResponse.json(result, { status: 400 });
    }

    // Set the token as an httpOnly cookie
    const response = NextResponse.json(result);
    response.cookies.set(PORTAL_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: PORTAL_TOKEN_MAX_AGE,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { status: "error", message: "Erro interno ao carregar o portal." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenFromQuery = searchParams.get("token")?.trim();
  const tokenFromCookie = readTokenFromCookie();

  // Prefer query param, fall back to cookie
  const token = tokenFromQuery || tokenFromCookie;

  if (!token) {
    return NextResponse.json({ status: "not_found", message: "Token ausente." }, { status: 200 });
  }

  try {
    const result = await validateAndLoadPortal(token);

    // If loaded via cookie and token was valid, ensure cookie is set
    if (!tokenFromQuery && tokenFromCookie && result.status === "ready") {
      const response = NextResponse.json(result);
      response.cookies.set(PORTAL_TOKEN_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: PORTAL_TOKEN_MAX_AGE,
        path: "/",
      });
      return response;
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { status: "error", message: "Erro interno ao carregar o portal." },
      { status: 200 }
    );
  }
}
