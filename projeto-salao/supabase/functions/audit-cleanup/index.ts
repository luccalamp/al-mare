import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

    // Parse body for optional retention days
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

    // Purge old audit entries
    const purgeResult = await fetch(`${supabaseUrl}/rest/v1/rpc/purge_old_audit_entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseServiceKey,
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Prefer": "return=representation",
      },
      body: JSON.stringify({ p_retention_days: auditRetentionDays }),
    });

    const purgeData = await purgeResult.json();

    // Purge old archive entries
    const archiveResult = await fetch(`${supabaseUrl}/rest/v1/rpc/purge_old_audit_archive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseServiceKey,
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Prefer": "return=representation",
      },
      body: JSON.stringify({ p_retention_days: archiveRetentionDays }),
    });

    const archiveData = await archiveResult.json();

    // Get current audit stats
    const statsResult = await fetch(`${supabaseUrl}/rest/v1/rpc/get_audit_stats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseServiceKey,
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Prefer": "return=representation",
      },
      body: JSON.stringify({}),
    });

    const statsData = await statsResult.json();

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
