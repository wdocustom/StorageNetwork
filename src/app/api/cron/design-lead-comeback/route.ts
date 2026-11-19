import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { processDesignLeadComeback } from "@/lib/server/design-lead-comeback";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/cron/design-lead-comeback — one come-back email to each person
// who emailed themselves a design and hasn't bought (their price + free jig
// plans). Safe to re-run (plan_buyer_campaigns dedupes).
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processDesignLeadComeback(getServiceClient());
    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...result, errors: result.errors.length ? result.errors : undefined });
  } catch (error) {
    console.error("[Cron] Design lead come-back failed:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
