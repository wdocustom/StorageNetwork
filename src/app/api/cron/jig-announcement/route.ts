import { NextRequest, NextResponse } from "next/server";
import { processJigAnnouncement } from "@/app/actions/jig-announcement";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Allow up to 2 minutes for batch processing

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/cron/jig-announcement
// One-time email blast: Jig plans ($9) + custom material pricing announcement.
// Safe to re-run — uses jig_email_mar2026_sent flag to dedupe.
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
    const result = await processJigAnnouncement();

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      jigAnnouncement: {
        processed: result.processed,
        emailsSent: result.sent,
        skipped: result.skipped,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    };

    console.log("[Cron] Jig announcement job completed:", response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Cron] Jig announcement job failed:", error);
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
