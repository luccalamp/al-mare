import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type BrowserSupabaseClient = ReturnType<typeof createBrowserSupabaseClient>;

let supabaseClient: BrowserSupabaseClient | null = null;
let realtimeAuthBound = false;

function bindRealtimeAuth(client: BrowserSupabaseClient) {
	if (realtimeAuthBound || typeof window === "undefined") {
		return;
	}

	realtimeAuthBound = true;

	void client.auth.getSession().then(({ data }) => {
		void client.realtime.setAuth(data.session?.access_token ?? null);
	});

	client.auth.onAuthStateChange((_event, session) => {
		void client.realtime.setAuth(session?.access_token ?? null);
	});
}

export function getSupabaseBrowserClient(): BrowserSupabaseClient {
	if (!supabaseClient) {
		supabaseClient = createBrowserSupabaseClient();
	}

	bindRealtimeAuth(supabaseClient);

	return supabaseClient;
}

export const supabase = new Proxy({} as BrowserSupabaseClient, {
	get(_target, property) {
		const client = getSupabaseBrowserClient();
		const value = Reflect.get(client, property, client);

		return typeof value === "function" ? value.bind(client) : value;
	},
});
