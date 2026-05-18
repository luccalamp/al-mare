import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export function createBrowserSupabaseClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabasePublicConfig();

  return createBrowserClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      get(name) {
        if (typeof document === "undefined") return undefined;
        const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
        return match?.[2] ?? undefined;
      },
      set(name, value, options) {
        if (typeof document === "undefined") return;
        let cookie = `${name}=${value}`;
        if (options?.path) cookie += `; path=${options.path}`;
        if (options?.maxAge) cookie += `; max-age=${options.maxAge}`;
        if (options?.expires) cookie += `; expires=${options.expires.toUTCString()}`;
        if (options?.secure) cookie += `; secure`;
        if (options?.sameSite) cookie += `; samesite=${options.sameSite}`;
        document.cookie = cookie;
      },
      remove(name, options) {
        if (typeof document === "undefined") return;
        document.cookie = `${name}=; path=${options?.path ?? "/"}; max-age=0`;
      },
    },
  });
}