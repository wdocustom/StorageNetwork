import { NextRequest, NextResponse } from "next/server";
import { runRepeatOrderCampaign } from "@/lib/server/repeat-order-campaign";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/cron/repeat-order-campaign
//
// One-time "order another rack" email to past paying customers. Manually
// triggered (NOT in vercel.json crons). Requires CRON_SECRET — unlike the
// installer announcements this refuses to run if the secret is unset.
//
//   (no params)            dry run: counts + masked sample, sends nothing
//   ?testTo=you@x.com      sends ONE "[TEST]" email to that address only; links
//                          work end to end (test campaign, never the real one)
//   ?send=1&limit=100      really sends up to `limit` (max 200) per call;
//                          safe to repeat — each customer is emailed once
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ success: false, error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(parseInt(sp.get("limit") || "100", 10) || 100, 1), 200);

  try {
    const result = await runRepeatOrderCampaign({
      send: sp.get("send") === "1",
      limit,
      testTo: sp.get("testTo") || undefined,
    });
    console.log("[Cron] Repeat-order campaign:", { ...result, sample: undefined });
    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...result });
  } catch (error) {
    console.error("[Cron] Repeat-order campaign failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Intentionally no GET handler: a link prefetcher must never trigger a send.
