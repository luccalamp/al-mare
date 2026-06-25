import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthorizedStaff } from "@/lib/server/tenantAccess";
import { applyStoredTokensCookie, createCalendarEventServer } from "@/lib/server/googleCalendarAuth";

const eventSchema = z.object({
  summary: z.string().min(1),
  description: z.string().optional(),
  start: z.string(),
  end: z.string(),
  timeZone: z.string().optional(),
});

export async function POST(request: Request) {
  const authContext = await requireAuthorizedStaff(request);
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const body = await request.json().catch(() => null);
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    console.error("[gcal-event-api] Validation error:", parsed.error);
    return NextResponse.json({ error: "Dados do evento inválidos." }, { status: 400 });
  }

  console.log("[gcal-event-api] Creating event:", parsed.data.summary);

  try {
    const result = await createCalendarEventServer(parsed.data);
    console.log("[gcal-event-api] Event created:", result.event.id);
    const response = NextResponse.json(result.event);
    if (result.refreshedTokens) {
      response.headers.set("X-GCal-Token-Refreshed", "true");
      applyStoredTokensCookie(response, result.refreshedTokens);
    }
    return response;
  } catch (err) {
    console.error("[gcal-event-api] Error:", err);
    const message = err instanceof Error ? err.message : "Não foi possível criar o evento no Google Calendar.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
