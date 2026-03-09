import { NextRequest, NextResponse } from "next/server";
import { processCleanoutUpsells } from "@/app/actions/cleanout-upsell";

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/cron/cleanout-upsell
// Sends cleanout upsell emails 3 days before scheduled installs
// Called by Vercel Cron daily at 8 AM
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const result = await processCleanoutUpsells();

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      cleanoutUpsells: {
        processed: result.processed,
        emailsSent: result.sent,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    };

    console.log("[Cron] Cleanout upsell job completed:", response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Cron] Cleanout upsell job failed:", error);
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

// Also support GET for easy manual testing (with auth)
export async function GET(req: NextRequest) {
  return POST(req);
}
