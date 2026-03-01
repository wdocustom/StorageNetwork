import { NextRequest, NextResponse } from "next/server";
import { processOnboardingDrip } from "@/app/actions/onboarding-drip";

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/cron/onboarding-drip
// Processes the 4-email installer onboarding drip sequence.
// Called daily by Vercel Cron (or external scheduler).
//
// Email 1: Welcome (Day 0, sent at signup)
// Email 2: QR Code (Day 2)
// Email 3: First Sale Playbook (Day 4)
// Email 4: Scarcity Reminder (Day 7)
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
    const result = await processOnboardingDrip();

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      onboardingDrip: {
        processed: result.processed,
        emailsSent: result.sent,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    };

    console.log("[Cron] Onboarding drip job completed:", response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Cron] Onboarding drip job failed:", error);
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
