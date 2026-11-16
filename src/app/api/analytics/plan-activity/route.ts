import { NextRequest, NextResponse } from "next/server";
import { isBot } from "@/lib/bot-detection";
import { detectInAppBrowser } from "@/lib/in-app-browser";
import { isClientPlanActivity } from "@/lib/plan-activity";
import { activityOwnerByToken, recordPlanActivity } from "@/lib/server/plan-activity";
import { enforceActionRateLimit, RateLimitError } from "@/lib/server/action-rate-limit";

export const dynamic = "force-dynamic";

// POST /api/analytics/plan-activity: one thing a buyer did with their plan
// (see @/lib/plan-activity). Only browser-side events, only for a real
// purchase token; bots and automated browsers are dropped.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (!isClientPlanActivity(body.event)) return NextResponse.json({ ok: false }, { status: 400 });
    const ua = req.headers.get("user-agent");
    if (body.automated === true || isBot(ua)) return NextResponse.json({ ok: true });

    try {
      await enforceActionRateLimit({ action: "plan-activity", limit: 240, window: "60 s", identify: "ip" });
    } catch (err) {
      if (err instanceof RateLimitError) return NextResponse.json({ ok: false }, { status: 429 });
      throw err;
    }

    const owner = await activityOwnerByToken(body.token);
    if (!owner) return NextResponse.json({ ok: false }, { status: 404 });

    const inApp = detectInAppBrowser(ua ?? "");
    await recordPlanActivity(owner, body.event, {
      detail: body.detail as string | null,
      value: body.value as number | null,
      total: body.total as number | null,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
      inApp: inApp ? `${inApp.app}-${inApp.os}` : null,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
