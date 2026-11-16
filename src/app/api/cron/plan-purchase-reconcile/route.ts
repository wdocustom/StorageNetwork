import { NextRequest, NextResponse } from "next/server";
import { reconcilePlanPurchases } from "@/app/actions/plan-purchase-reconcile";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/cron/plan-purchase-reconcile — record and email any paid plan
// checkout from the last 3 days that has no purchase row yet.
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await reconcilePlanPurchases();
    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...result });
  } catch (error) {
    console.error("[Cron] Plan purchase reconcile failed:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
