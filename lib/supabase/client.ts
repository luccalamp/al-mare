import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export function createBrowserSupabaseClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabasePublicConfig();

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Supabase public config is missing.");
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
