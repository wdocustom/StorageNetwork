import { NextRequest, NextResponse } from "next/server";
import { processFeatureAnnouncement } from "@/app/actions/feature-announcement";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Allow up to 2 minutes for batch processing

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/cron/feature-announcement
// One-time email blast: March 2026 platform feature announcement.
// Safe to re-run — uses feature_email_mar2026_sent flag to dedupe.
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
    const result = await processFeatureAnnouncement();

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      featureAnnouncement: {
        processed: result.processed,
        emailsSent: result.sent,
        skipped: result.skipped,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    };

    console.log("[Cron] Feature announcement job completed:", response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Cron] Feature announcement job failed:", error);
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
