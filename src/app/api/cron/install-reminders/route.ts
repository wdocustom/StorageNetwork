import { NextRequest, NextResponse } from "next/server";
import { processInstallReminders } from "@/lib/server/install-tracking";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/cron/install-reminders
// Daily: email every customer whose install is tomorrow a reminder with a
// "Track your install" link. Runs at 14:00 UTC (9am Central / 10am Eastern /
// 7am Pacific). Safe to re-run — each job is reminded once per install date.
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processInstallReminders();
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      installReminders: {
        processed: result.processed,
        emailsSent: result.sent,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    };
    console.log("[Cron] Install reminders completed:", response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("[Cron] Install reminders failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
