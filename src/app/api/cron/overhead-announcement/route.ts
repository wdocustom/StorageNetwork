import { NextRequest, NextResponse } from "next/server";
import { processOverheadAnnouncement } from "@/app/actions/overhead-announcement";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Allow up to 2 minutes for batch processing

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/cron/overhead-announcement
// One-time email blast: Overhead ceiling storage launch announcement.
// Safe to re-run — uses overhead_email_mar2026_sent flag to dedupe.
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
    const result = await processOverheadAnnouncement();

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      overheadAnnouncement: {
        processed: result.processed,
        emailsSent: result.sent,
        skipped: result.skipped,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    };

    console.log("[Cron] Overhead announcement job completed:", response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Cron] Overhead announcement job failed:", error);
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
