import { NextRequest, NextResponse } from "next/server";
import { processFeedbackCallInvite } from "@/app/actions/feedback-call-invite";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/cron/feedback-call-invite
// One-time email blast: invite every installer to a personal feedback call.
// Safe to re-run — uses feedback_call_email_sent flag to dedupe.
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
    const result = await processFeedbackCallInvite();

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      feedbackCallInvite: {
        processed: result.processed,
        emailsSent: result.sent,
        skipped: result.skipped,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    };

    console.log("[Cron] Feedback call invite job completed:", response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Cron] Feedback call invite job failed:", error);
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
