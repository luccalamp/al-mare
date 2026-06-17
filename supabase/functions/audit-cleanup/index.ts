import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let auditRetentionDays = 30;
    let archiveRetentionDays = 90;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        auditRetentionDays = body.audit_retention_days ?? 30;
        archiveRetentionDays = body.archive_retention_days ?? 90;
      } catch {
        // Use defaults
      }
    }

    const { data: purgeData, error: purgeError } = await supabase.rpc("purge_old_audit_entries", {
      p_retention_days: auditRetentionDays,
    });
    if (purgeError) {
      throw new Error(`purge_old_audit_entries: ${purgeError.message}`);
    }

    const { data: archiveData, error: archiveError } = await supabase.rpc("purge_old_audit_archive", {
      p_retention_days: archiveRetentionDays,
    });
    if (archiveError) {
      throw new Error(`purge_old_audit_archive: ${archiveError.message}`);
    }

    const { data: statsData, error: statsError } = await supabase.rpc("get_audit_stats");
    if (statsError) {
      throw new Error(`get_audit_stats: ${statsError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        executed_at: new Date().toISOString(),
        audit_retention_days: auditRetentionDays,
        archive_retention_days: archiveRetentionDays,
        audit_purge: purgeData,
        archive_purge: archiveData,
        current_stats: statsData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executed_at: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
