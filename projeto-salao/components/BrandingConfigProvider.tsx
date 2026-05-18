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
import { supabase } from "@/lib/supabaseClient";

type BrandingConfigContextValue = {
  config: BrandingConfig;
  loading: boolean;
  saving: boolean;
  saveConfig: (nextConfig: BrandingConfig) => Promise<BrandingConfig>;
};

const BrandingConfigContext = createContext<BrandingConfigContextValue | null>(null);

export function BrandingConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<BrandingConfig>(() => readBrandingConfigCache(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const syncRemoteConfig = async ({ background = false }: { background?: boolean } = {}) => {
      if (!background) {
        setLoading(true);
      }

      setConfig(readBrandingConfigCache(null));

      try {
        const remoteConfig = await fetchBrandingConfigFromSupabase(null);
        if (!active) {
          return;
        }

        if (remoteConfig) {
          setConfig(remoteConfig);
          writeBrandingConfigCache(remoteConfig, null);
          return;
        }

        const cachedConfig = readBrandingConfigCache(null);
        setConfig(cachedConfig);
        writeBrandingConfigCache(cachedConfig, null);
      } catch (error) {
        console.error(error);
        if (active) {
          const cachedConfig = readBrandingConfigCache(null);
          setConfig(cachedConfig.clinicName ? cachedConfig : { ...DEFAULT_BRANDING_CONFIG });
        }
      } finally {
        if (active && !background) {
          setLoading(false);
        }
      }
    };

    void syncRemoteConfig();

    const channel = supabase
      .channel(`branding-config-sync-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "clinic_preferences",
        },
        () => {
          if (refreshTimer) {
            clearTimeout(refreshTimer);
          }

          refreshTimer = setTimeout(() => {
            refreshTimer = null;
            void syncRemoteConfig({ background: true });
          }, 300);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "clinic_preferences",
        },
        () => {
          if (refreshTimer) {
            clearTimeout(refreshTimer);
          }

          refreshTimer = setTimeout(() => {
            refreshTimer = null;
            void syncRemoteConfig({ background: true });
          }, 300);
        }
      );

    if (channel) {
      channel.subscribe();
    }

    return () => {
      active = false;
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  const saveConfig = useCallback(
    async (nextConfig: BrandingConfig) => {
      const mergedConfig = mergeBrandingConfig(nextConfig);
      setSaving(true);

      try {
        await saveBrandingConfigToSupabase(mergedConfig, null);
        setConfig(mergedConfig);
        writeBrandingConfigCache(mergedConfig, null);
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
      --color-accent: ${config.themeColorPrimary || "#8c5a2d"};
      --color-brand-accent: ${config.themeColorPrimary || "#8c5a2d"};
      --color-brand-deep: ${config.themeColorPrimary || "#7a4921"};
      --color-text: ${config.themeColorText || "#4f2f19"};
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
      background: ${
        config.themeColorBackground ||
        "linear-gradient(135deg, rgba(255, 251, 247, 0.78), rgba(244, 230, 211, 0.88))"
      } !important;
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