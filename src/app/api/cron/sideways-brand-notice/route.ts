import { NextRequest, NextResponse } from "next/server";
import { sendSidewaysBrandNotices } from "@/lib/server/sideways-brand-notice";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/cron/sideways-brand-notice — one-time notice to DIY plan buyers
// whose sideways plans were cut for HDX before the brand choice existed
// (lib/server/sideways-brand-notice). Each person is emailed once; after the
// first run this is a no-op and the job can be removed from cron-jobs.ts.
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await sendSidewaysBrandNotices();
    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...result });
  } catch (error) {
    console.error("[Cron] Sideways brand notice failed:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
