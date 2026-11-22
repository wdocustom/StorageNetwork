import { NextRequest, NextResponse } from "next/server";
import { processPlanCheckIns } from "@/app/actions/plan-check-ins";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/cron/plan-check-ins — "here's your link" to plan buyers who haven't
// opened their plans, at 14 and 30 days. Safe to re-run (claims before sending).
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processPlanCheckIns();
    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...result, errors: result.errors.length ? result.errors : undefined });
  } catch (error) {
    console.error("[Cron] Plan check-ins failed:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
