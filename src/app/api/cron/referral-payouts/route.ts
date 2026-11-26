import { NextRequest, NextResponse } from "next/server";
import { processDueCommissions, PAYOUT_HOLD_DAYS } from "@/lib/server/referral-partners";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/cron/referral-payouts — the daily referral partner payout pass
// (lib/server/referral-partners). Pays every partner cut whose deposit is at
// least PAYOUT_HOLD_DAYS old and has cleared, voids cuts on cancelled or
// refunded jobs (handing a collected cut back to the installer), and leaves
// disputed ones held. Safe to re-run: every step claims its row first.
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processDueCommissions();
    console.log("[Cron] Referral payouts:", result);
    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), holdDays: PAYOUT_HOLD_DAYS, ...result });
  } catch (error) {
    console.error("[Cron] Referral payouts failed:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
