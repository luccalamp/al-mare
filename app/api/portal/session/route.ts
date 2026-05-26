import { NextResponse } from "next/server";
import { encodeStoragePathForRoute } from "@/lib/server/mediaProxy";
import { isManagedPhotoBucket } from "@/lib/server/photoStorage";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { buildStorageObjectPublicUrl } from "@/lib/server/storageUrls";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMissingColumnError(message?: string) {
  return /column .* does not exist/i.test(message || "");
}

function buildPortalMediaProxyUrl(storagePath: string, token: string) {
  return `/api/portal/media/${encodeStoragePathForRoute(storagePath)}?token=${encodeURIComponent(token)}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();

  if (!token) {
    return NextResponse.json({ status: "not_found", message: "Token ausente." }, { status: 200 });
  }

  if (!UUID_PATTERN.test(token)) {
    return NextResponse.json(
      { status: "not_found", message: "Link não encontrado ou expirado." },
      { status: 200 }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data: linkData, error: linkError } = await supabase
      .from("clientes")
      .select("id, nome, portal_token, portal_active, token_pre_consulta, link_ativo, pre_consulta_respondida_em")
      .eq("portal_token", token)
      .is("deleted_at", null)
      .single();

    if (linkError) {
      if (isMissingColumnError(linkError.message)) {
        return NextResponse.json(
          { status: "migration_required", message: "O portal ainda não está disponível." },
          { status: 200 }
        );
      }

      if (linkError.code === "PGRST116") {
        return NextResponse.json(
          { status: "not_found", message: "Link não encontrado ou expirado." },
          { status: 200 }
        );
      }

      console.error("[portal] Link lookup error:", JSON.stringify(linkError));
      return NextResponse.json(
        { status: "error", message: "Erro ao validar o link." },
        { status: 200 }
      );
    }

    if (!linkData || linkData.portal_active === false) {
      return NextResponse.json(
        { status: "inactive", message: "Link encerrado pela clínica." },
        { status: 200 }
      );
    }

    const clientId = linkData.id;
    const clientName = linkData.nome;

    const [homecareRes, galleryRes] = await Promise.all([
      supabase
        .from("manutencao_homecare")
        .select("*")
        .eq("cliente_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("client_photos")
        .select("*")
        .eq("cliente_id", clientId)
        .is("deleted_at", null)
        .order("captured_at", { ascending: false }),
    ]);

    if (homecareRes.error) console.error("[portal] homecare error:", JSON.stringify(homecareRes.error));
    if (galleryRes.error) console.error("[portal] gallery error:", JSON.stringify(galleryRes.error));

    const signedGallery = (galleryRes.data ?? []).map((photo) => ({
      ...photo,
      url:
        isManagedPhotoBucket(photo.storage_bucket) && typeof photo.storage_path === "string"
          ? buildPortalMediaProxyUrl(photo.storage_path, token)
          : buildStorageObjectPublicUrl(photo.storage_bucket, photo.storage_path) || photo.url,
    }));

    return NextResponse.json({
      status: "ready",
      clientId,
      clientName,
      homecare: homecareRes.data ?? [],
      gallery: signedGallery,
      preConsulta: {
        linkActive: linkData.link_ativo ?? false,
        respondedAt: linkData.pre_consulta_respondida_em ?? null,
      },
    });
  } catch (err) {
    console.error("[portal] Unexpected error:", err);
    return NextResponse.json(
      { status: "error", message: "Erro interno ao carregar o portal." },
      { status: 200 }
    );
  }
}
