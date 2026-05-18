import { NextRequest, NextResponse } from "next/server";
import { sweepUnresolvedWaitlistMatches } from "@/app/actions/demand-signals";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/cron/waitlist-activation
//
// Safety-net sweep for waitlist demand signals. activateDemandSignals() fires
// inline from updateInstallerProfile(), but admin-edited or DB-edited
// service_zips bypass that path. This cron scans every unresolved waitlist
// signal and emails the customer when any installer's service_zips now
// covers their ZIP.
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const result = await sweepUnresolvedWaitlistMatches();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err) {
    console.error("[Cron:waitlist-activation] Failed:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
