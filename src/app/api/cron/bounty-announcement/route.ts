import { NextRequest, NextResponse } from "next/server";
import { processBountyAnnouncement } from "@/app/actions/bounty-announcement";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Allow up to 2 minutes for batch processing

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/cron/bounty-announcement
// One-time email blast: Referral/bounty passive income education.
// Safe to re-run — uses bounty_email_mar2026_sent flag to dedupe.
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const result = await processBountyAnnouncement();

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      bountyAnnouncement: {
        processed: result.processed,
        emailsSent: result.sent,
        skipped: result.skipped,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    };

    console.log("[Cron] Bounty announcement job completed:", response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Cron] Bounty announcement job failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
