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

    const retentionHours = 48;

    // Call the SQL function to clean quarantine storage objects
    const storageResult = await fetch(`${supabaseUrl}/rest/v1/rpc/cleanup_quarantine_files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseServiceKey,
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Prefer": "return=representation",
      },
      body: JSON.stringify({ p_retention_hours: retentionHours }),
    });

    const storageData = await storageResult.json();

    // Call the SQL function to clean DB quarantine references
    const dbResult = await fetch(`${supabaseUrl}/rest/v1/rpc/cleanup_quarantine_db_records`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseServiceKey,
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Prefer": "return=representation",
      },
      body: JSON.stringify({ p_retention_hours: retentionHours }),
    });

    const dbData = await dbResult.json();

    // Call the SQL function to get quarantine stats
    const statsResult = await fetch(`${supabaseUrl}/rest/v1/rpc/get_quarantine_stats`, {
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
        retention_hours: retentionHours,
        storage_cleanup: storageData,
        db_cleanup: dbData,
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
