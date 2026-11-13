import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { isBot } from "@/lib/bot-detection";
import { isPlanEvent } from "@/lib/plan-events";

export const dynamic = "force-dynamic";

// POST /api/analytics/plan-event — one designer event (see lib/plan-events).
// Unknown events, bots and automated browsers are dropped.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      event?: unknown;
      detail?: unknown;
      visitorId?: unknown;
      sessionId?: unknown;
      inApp?: unknown;
      automated?: unknown;
    };
    if (!isPlanEvent(body.event)) return NextResponse.json({ ok: false }, { status: 400 });
    if (body.automated === true || isBot(req.headers.get("user-agent"))) return NextResponse.json({ ok: true });
    const str = (v: unknown, n: number) => (typeof v === "string" && v ? v.slice(0, n) : null);
    const { error } = await getServiceClient().from("plan_events").insert({
      event: body.event,
      detail: str(body.detail, 80),
      visitor_id: str(body.visitorId, 64),
      session_id: str(body.sessionId, 64),
      in_app: str(body.inApp, 32),
    });
    if (error) console.error("[PlanEvent] insert failed:", error.message);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
