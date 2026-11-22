import { NextRequest, NextResponse } from "next/server";
import { processPlanReviewRequests } from "@/app/actions/plan-review-requests";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/cron/plan-review-requests — the DIY plan review email (7 days after
// buying) and its one reminder. Safe to re-run (each send claims its row).
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processPlanReviewRequests();
    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...result, errors: result.errors.length ? result.errors : undefined });
  } catch (error) {
    console.error("[Cron] Plan review requests failed:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
