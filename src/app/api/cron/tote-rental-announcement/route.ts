import { NextRequest, NextResponse } from "next/server";
import { processToteRentalAnnouncement } from "@/app/actions/tote-rental-announcement";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/cron/tote-rental-announcement
// One-time email blast: realtor closing-gift tote-rental program launch.
// Safe to re-run — uses tote_rental_announcement_sent_at flag to dedupe.
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
    const result = await processToteRentalAnnouncement();
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      toteRentalAnnouncement: {
        processed: result.processed,
        emailsSent: result.sent,
        skipped: result.skipped,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    };
    console.log("[Cron] Tote-rental announcement job completed:", response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("[Cron] Tote-rental announcement job failed:", error);
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
