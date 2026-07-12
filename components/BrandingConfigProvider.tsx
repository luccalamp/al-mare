"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import {
  BrandingConfig,
  DEFAULT_BRANDING_CONFIG,
  fetchBrandingConfigFromSupabase,
  mergeBrandingConfig,
  readBrandingConfigCache,
  saveBrandingConfigToSupabase,
  writeBrandingConfigCache,
} from "@/lib/brandingConfig";
import { isSupabasePublicConfigConfigured } from "@/lib/supabase/config";

const BRANDING_CONFIG_BACKGROUND_REFRESH_MS = 60_000;

type BrandingConfigContextValue = {
  config: BrandingConfig;
  loading: boolean;
  saving: boolean;
  saveConfig: (nextConfig: BrandingConfig) => Promise<BrandingConfig>;
};

const BrandingConfigContext = createContext<BrandingConfigContextValue | null>(null);

export function BrandingConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<BrandingConfig>(() => readBrandingConfigCache());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canUseSupabase = isSupabasePublicConfigConfigured();

  useEffect(() => {
    if (!canUseSupabase) {
      setConfig(readBrandingConfigCache());
      setLoading(false);
      return;
    }

    let active = true;

    const applyCachedConfig = () => {
      if (!active) return;
      setConfig(readBrandingConfigCache());
      setLoading(false);
    };

    const syncRemoteConfig = async ({ background = false }: { background?: boolean } = {}) => {
      if (!background) {
        setLoading(true);
      }

      try {
        const remoteConfig = await fetchBrandingConfigFromSupabase();
        if (!active) return;

        const nextConfig = remoteConfig || readBrandingConfigCache();
        setConfig(nextConfig);
        writeBrandingConfigCache(nextConfig);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[branding] Remote refresh failed", error);
        }
        if (active) {
          const cachedConfig = readBrandingConfigCache();
          setConfig(cachedConfig.clinicName ? cachedConfig : { ...DEFAULT_BRANDING_CONFIG });
        }
      } finally {
        if (active && !background) {
          setLoading(false);
        }
      }
    };

    const refreshIfAuthorized = async ({ background = false }: { background?: boolean } = {}) => {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.twoFactorVerified) {
          if (!background) applyCachedConfig();
          return;
        }

        await syncRemoteConfig({ background });
      } catch {
        if (!background) applyCachedConfig();
      }
    };

    const refreshInBackground = () => {
      if (document.visibilityState === "visible") {
        void refreshIfAuthorized({ background: true });
      }
    };

    void refreshIfAuthorized();
    const intervalId = window.setInterval(
      refreshInBackground,
      BRANDING_CONFIG_BACKGROUND_REFRESH_MS
    );
    window.addEventListener("focus", refreshInBackground);
    window.addEventListener("almare:data-changed", refreshInBackground);
    window.addEventListener("almare:auth-changed", refreshInBackground);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshInBackground);
      window.removeEventListener("almare:data-changed", refreshInBackground);
      window.removeEventListener("almare:auth-changed", refreshInBackground);
    };
  }, [canUseSupabase]);

  const saveConfig = useCallback(
    async (nextConfig: BrandingConfig) => {
      const mergedConfig = mergeBrandingConfig(nextConfig);
      setSaving(true);

      try {
        await saveBrandingConfigToSupabase(mergedConfig);
        setConfig(mergedConfig);
        writeBrandingConfigCache(mergedConfig);
        window.dispatchEvent(new CustomEvent("almare:data-changed"));
        return mergedConfig;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const value = useMemo(
    () => ({
      config,
      loading,
      saving,
      saveConfig,
    }),
    [config, loading, saving, saveConfig]
  );

  const cssVariables = `
    :root {
      --color-accent: ${config.themeColorPrimary || "#527b63"};
      --color-brand-accent: ${config.themeColorPrimary || "#527b63"};
      --color-brand-deep: ${config.themeColorPrimary || "#315c48"};
      --color-text: ${config.themeColorText || "#1d1d1f"};
      --color-glass-bg: rgba(255, 255, 255, ${config.themeGlassOpacity ?? 0.62});
      --theme-border-radius: ${
        config.themeBorderRadius === "sharp"
          ? "0px"
          : config.themeBorderRadius === "pill"
          ? "9999px"
          : "12px"
      };
    }
    body {
      transition: background 0.3s ease;
    }
    .input-light {
      border-radius: var(--theme-border-radius) !important;
    }
    .glass, .glass-dark {
      border-radius: calc(var(--theme-border-radius) * 1.5) !important;
    }
    button[class*="rounded"] {
      border-radius: var(--theme-border-radius) !important;
    }
  `;

  return (
    <BrandingConfigContext.Provider value={value}>
      <style dangerouslySetInnerHTML={{ __html: cssVariables }} suppressHydrationWarning />
      {children}
    </BrandingConfigContext.Provider>
  );
}

export function useBrandingConfig() {
  const context = useContext(BrandingConfigContext);

  if (!context) {
    throw new Error("useBrandingConfig must be used within BrandingConfigProvider.");
  }

  return context;
}
