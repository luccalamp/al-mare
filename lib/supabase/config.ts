type SupabasePublicConfig = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

function readSupabasePublicConfig(): SupabasePublicConfig {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";

  return {
    supabaseUrl,
    supabasePublishableKey,
  };
}

export function isSupabasePublicConfigConfigured() {
  const config = readSupabasePublicConfig();
  return Boolean(config.supabaseUrl && config.supabasePublishableKey);
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  const config = readSupabasePublicConfig();

  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "Credenciais de conexão ausentes. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY)."
      );
    }
  }

  return config;
}
