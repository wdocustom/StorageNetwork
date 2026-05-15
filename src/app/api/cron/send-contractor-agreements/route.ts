import { NextRequest, NextResponse } from "next/server";
import { sendPendingContractorAgreements } from "@/app/actions/contractor-agreements";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/cron/send-contractor-agreements
//
// Walks every contractor_agreements row in status='pending_send' with
// email_sent_at IS NULL and fires the invite email. Idempotent — once sent
// the row flips to status='sent' and is ignored on subsequent runs.
// Safe to trigger manually (Vercel "Run now" or curl with the bearer
// token) to fire off a freshly-seeded agreement immediately.
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
    const result = await sendPendingContractorAgreements();
    const payload = {
      success: result.errors.length === 0,
      timestamp: new Date().toISOString(),
      contractorAgreements: {
        processed: result.processed,
        emailsSent: result.sent,
        skipped: result.skipped,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    };
    console.log("[Cron] Contractor-agreement send job completed:", payload);
    // Return 500 when any row failed so a stuck send surfaces red in the
    // Vercel cron log instead of looking green with errors buried in the body.
    return NextResponse.json(payload, {
      status: result.errors.length > 0 ? 500 : 200,
    });
  } catch (error) {
    console.error("[Cron] Contractor-agreement send job failed:", error);
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
