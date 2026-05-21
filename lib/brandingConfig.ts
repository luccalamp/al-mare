export type BrandingConfig = {
  clinicName: string;
  clinicSubtitle: string;
  dashboardLabel: string;
  documentsLabel: string;
  documentsTitle: string;
  documentsDescription: string;
  preConsultationTitle: string;
  preConsultationIntro: string;
  clinicalRecordLabel: string;
  // SaaS Multi-tenant Customization
  logoUrl?: string; // URL da logo customizada
  themeColorPrimary?: string; // Cor principal de destaque
  themeColorBackground?: string; // Cor ou gradiente de fundo
  themeColorText?: string; // Cor principal do texto
  themeGlassOpacity?: number; // Nível de opacidade do efeito "glass"
  themeBorderRadius?: "sharp" | "rounded" | "pill"; // Estilo das bordas
};

export const BRANDING_CONFIG_STORAGE_KEY = "almare.branding.config.v1";
export const BRANDING_CONFIG_PREFERENCE_KEY = "branding-config";

function getBrandingConfigCacheKey(organizationId: string | null) {
  return organizationId ? `${BRANDING_CONFIG_STORAGE_KEY}:${organizationId}` : null;
}

export const DEFAULT_BRANDING_CONFIG: BrandingConfig = {
  clinicName: "Al'maré",
  clinicSubtitle: "Saúde Capilar",
  dashboardLabel: "Financeiro",
  documentsLabel: "Arquivos",
  documentsTitle: "Central de arquivos",
  documentsDescription:
    "Guarde contratos, relatórios, modelos e arquivos internos em uma pasta própria, separada das fichas das pacientes.",
  preConsultationTitle: "Triagem clínica antes da sessão",
  preConsultationIntro:
    "Este formulário é restrito à coleta inicial de informações. Ele não dá acesso ao restante da plataforma da clínica.",
  clinicalRecordLabel: "Prontuário clínico",
  // Defaults para personalização visual
  themeColorPrimary: "#8c5a2d",
  themeColorBackground: "linear-gradient(135deg, rgba(255, 251, 247, 0.78), rgba(244, 230, 211, 0.88))",
  themeColorText: "#4f2f19",
  themeGlassOpacity: 0.62,
  themeBorderRadius: "rounded",
};

function readConfigValue(rawValue: unknown, fallback: string) {
  if (typeof rawValue !== "string") {
    return fallback;
  }

  const trimmedValue = rawValue.trim();
  return trimmedValue || fallback;
}

export function mergeBrandingConfig(raw: unknown): BrandingConfig {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_BRANDING_CONFIG };
  }

  const candidate = raw as Partial<Record<keyof BrandingConfig, unknown>>;

  return {
    clinicName: readConfigValue(candidate.clinicName, DEFAULT_BRANDING_CONFIG.clinicName),
    clinicSubtitle: readConfigValue(candidate.clinicSubtitle, DEFAULT_BRANDING_CONFIG.clinicSubtitle),
    dashboardLabel: readConfigValue(candidate.dashboardLabel, DEFAULT_BRANDING_CONFIG.dashboardLabel),
    documentsLabel: readConfigValue(candidate.documentsLabel, DEFAULT_BRANDING_CONFIG.documentsLabel),
    documentsTitle: readConfigValue(candidate.documentsTitle, DEFAULT_BRANDING_CONFIG.documentsTitle),
    documentsDescription: readConfigValue(candidate.documentsDescription, DEFAULT_BRANDING_CONFIG.documentsDescription),
    preConsultationTitle: readConfigValue(candidate.preConsultationTitle, DEFAULT_BRANDING_CONFIG.preConsultationTitle),
    preConsultationIntro: readConfigValue(candidate.preConsultationIntro, DEFAULT_BRANDING_CONFIG.preConsultationIntro),
    clinicalRecordLabel: readConfigValue(candidate.clinicalRecordLabel, DEFAULT_BRANDING_CONFIG.clinicalRecordLabel),
    logoUrl: typeof candidate.logoUrl === "string" ? candidate.logoUrl : DEFAULT_BRANDING_CONFIG.logoUrl,
    themeColorPrimary: typeof candidate.themeColorPrimary === "string" ? candidate.themeColorPrimary : DEFAULT_BRANDING_CONFIG.themeColorPrimary,
    themeColorBackground: typeof candidate.themeColorBackground === "string" ? candidate.themeColorBackground : DEFAULT_BRANDING_CONFIG.themeColorBackground,
    themeColorText: typeof candidate.themeColorText === "string" ? candidate.themeColorText : DEFAULT_BRANDING_CONFIG.themeColorText,
    themeGlassOpacity: typeof candidate.themeGlassOpacity === "number" ? candidate.themeGlassOpacity : DEFAULT_BRANDING_CONFIG.themeGlassOpacity,
    themeBorderRadius:
      typeof candidate.themeBorderRadius === "string" && ["sharp", "rounded", "pill"].includes(candidate.themeBorderRadius)
        ? (candidate.themeBorderRadius as BrandingConfig["themeBorderRadius"])
        : DEFAULT_BRANDING_CONFIG.themeBorderRadius,
  };
}

export function readBrandingConfigCache(organizationId: string | null): BrandingConfig {
  if (typeof window === "undefined") {
    return { ...DEFAULT_BRANDING_CONFIG };
  }

  const cacheKey = getBrandingConfigCacheKey(organizationId);
  if (!cacheKey) {
    return { ...DEFAULT_BRANDING_CONFIG };
  }

  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) {
      return { ...DEFAULT_BRANDING_CONFIG };
    }

    return mergeBrandingConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_BRANDING_CONFIG };
  }
}

export function writeBrandingConfigCache(config: BrandingConfig, organizationId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const cacheKey = getBrandingConfigCacheKey(organizationId);
  if (!cacheKey) {
    return;
  }

  window.localStorage.setItem(cacheKey, JSON.stringify(mergeBrandingConfig(config)));
}

export function getBrandDisplayTitle(config: BrandingConfig) {
  return [config.clinicName, config.clinicSubtitle].filter(Boolean).join(" ").trim();
}

export async function fetchBrandingConfigFromSupabase(organizationId: string | null): Promise<BrandingConfig | null> {
  if (!organizationId) {
    return null;
  }

  const res = await fetch(
    `/api/clinic-preferences?key=${encodeURIComponent(BRANDING_CONFIG_PREFERENCE_KEY)}`,
    { method: "GET", cache: "no-store" }
  );

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as Record<string, unknown>)["error"])
        : "Falha ao buscar configuração de personalização.";
    throw new Error(message);
  }

  const payload = await res.json().catch(() => null);
  if (!payload || payload.payload == null) return null;
  return mergeBrandingConfig(payload.payload);
}

export async function saveBrandingConfigToSupabase(config: BrandingConfig, organizationId: string | null) {
  if (!organizationId) {
    return;
  }
  const payload = mergeBrandingConfig(config);

  const res = await fetch(`/api/clinic-preferences`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ key: BRANDING_CONFIG_PREFERENCE_KEY, payload }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as Record<string, unknown>)["error"])
        : "Não foi possível salvar as preferências.";
    throw new Error(message);
  }
}