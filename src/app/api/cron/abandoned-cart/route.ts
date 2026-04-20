import { NextRequest, NextResponse } from "next/server";
import { processAbandonedCarts, cleanupExpiredLeads } from "@/app/actions/abandoned-cart";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/cron/abandoned-cart
// Processes abandoned cart emails and cleans up expired leads
// Called by Vercel Cron or external scheduler
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
    // Process abandoned carts (send recovery emails)
    const cartResult = await processAbandonedCarts();

    // Cleanup expired leads (mark as expired after 7 days)
    const cleanupResult = await cleanupExpiredLeads();

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      abandonedCarts: {
        processed: cartResult.processed,
        emailsSent: cartResult.sent,
        errors: cartResult.errors.length > 0 ? cartResult.errors : undefined,
      },
      cleanup: {
        expiredLeads: cleanupResult.updated,
      },
    };

    console.log("[Cron] Abandoned cart job completed:", response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Cron] Abandoned cart job failed:", error);
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
