import { NextRequest, NextResponse } from "next/server";
import { requireCronOrAdminRequest } from "@/lib/server/requestGuards";
import { safeErrorMessage } from "@/lib/server/safeError";

export async function POST(req: NextRequest) {
  const authResponse = requireCronOrAdminRequest(req);
  if (authResponse) return authResponse;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Missing Supabase configuration" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/quarantine-cleanup`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
      }
    );

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Quarantine cleanup cron error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Cleanup failed") },
      { status: 500 }
    );
  }
}
