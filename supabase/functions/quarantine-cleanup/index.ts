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

    let retentionHours = 48;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        retentionHours = body.retention_hours ?? 48;
      } catch {
        // Use default retention.
      }
    }

    const { data: candidates, error: candidatesError } = await supabase.rpc("list_quarantine_storage_candidates", {
      p_retention_hours: retentionHours,
    });
    if (candidatesError) {
      throw new Error(`list_quarantine_storage_candidates: ${candidatesError.message}`);
    }

    const groupedCandidates = new Map<string, string[]>();
    for (const candidate of Array.isArray(candidates) ? candidates : []) {
      const bucketName = typeof candidate.bucket_name === "string" ? candidate.bucket_name : "";
      const objectName = typeof candidate.object_name === "string" ? candidate.object_name : "";
      if (!bucketName || !objectName) continue;
      const bucketEntries = groupedCandidates.get(bucketName) ?? [];
      bucketEntries.push(objectName);
      groupedCandidates.set(bucketName, bucketEntries);
    }

    const storageData: Array<{ bucket_name: string; deleted_count: number; error_message: string | null }> = [];
    for (const [bucketName, objectNames] of groupedCandidates.entries()) {
      let deletedCount = 0;
      let errorMessage: string | null = null;

      for (let index = 0; index < objectNames.length; index += 100) {
        const chunk = objectNames.slice(index, index + 100);
        const { error } = await supabase.storage.from(bucketName).remove(chunk);
        if (error) {
          errorMessage = error.message;
          break;
        }
        deletedCount += chunk.length;
      }

      storageData.push({
        bucket_name: bucketName,
        deleted_count: deletedCount,
        error_message: errorMessage,
      });
    }

    const { data: dbData, error: dbError } = await supabase.rpc("cleanup_quarantine_db_records", {
      p_retention_hours: retentionHours,
    });
    if (dbError) {
      throw new Error(`cleanup_quarantine_db_records: ${dbError.message}`);
    }

    const { data: statsData, error: statsError } = await supabase.rpc("get_quarantine_stats");
    if (statsError) {
      throw new Error(`get_quarantine_stats: ${statsError.message}`);
    }

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
