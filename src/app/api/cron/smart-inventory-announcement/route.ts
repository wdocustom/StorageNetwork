import { NextRequest, NextResponse } from "next/server";
import { processSmartInventoryAnnouncement } from "@/app/actions/smart-inventory-announcement";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/cron/smart-inventory-announcement — the Smart Inventory email, to
// each tote plan buyer 4–5 days after they bought. Safe to re-run
// (plan_buyer_campaigns dedupes).
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processSmartInventoryAnnouncement();
    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...result, errors: result.errors.length ? result.errors : undefined });
  } catch (error) {
    console.error("[Cron] Smart Inventory announcement failed:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
