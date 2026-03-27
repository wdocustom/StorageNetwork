import { NextRequest, NextResponse } from "next/server";
import { processInventoryAnnouncement } from "@/app/actions/inventory-announcement";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/cron/inventory-announcement
// One-time email blast: tote inventory feature announcement.
// Safe to re-run — uses inventory_announcement_email_sent flag to dedupe.
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
    const result = await processInventoryAnnouncement();
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      inventoryAnnouncement: {
        processed: result.processed,
        emailsSent: result.sent,
        skipped: result.skipped,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    };
    console.log("[Cron] Inventory announcement job completed:", response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("[Cron] Inventory announcement job failed:", error);
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
