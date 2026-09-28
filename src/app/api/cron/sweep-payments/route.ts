import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getServiceClient } from "@/lib/supabase-server";
import { sweepUnrecordedPayments } from "@/lib/stripe/sweep-payments";
import { notifyRepairedBooking } from "@/lib/stripe/notify-repaired";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ═══════════════════════════════════════════════════════════════════════════
// /api/cron/sweep-payments — backfill after a webhook outage
//
// Asks Stripe what was paid in a window and makes the database agree. Unlike
// /api/cron/reconcile-deposits (which walks unpaid leads and is safe to run
// daily), this reads every connected account, so it is run BY HAND after an
// outage rather than on a schedule — deliberately not in vercel.json.
//
//   ?since=2026-09-08            required — start of the window (date or unix)
//   ?until=2026-09-18            optional end
//   ?dryRun=1                    report only, write nothing
//   ?offset=12                   resume where a timed-out run stopped
//
// Bearer CRON_SECRET, same as the other cron routes.
// ═══════════════════════════════════════════════════════════════════════════

function parseWhen(raw: string | null): number | null {
  if (!raw) return null;
  if (/^\d{9,11}$/.test(raw)) return Number(raw); // already unix seconds
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ success: false, error: "Stripe not configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const sinceUnix = parseWhen(url.searchParams.get("since"));
  if (!sinceUnix) {
    return NextResponse.json(
      {
        success: false,
        error:
          "A 'since' is required so the sweep is bounded — e.g. ?since=2026-09-08. Add ?dryRun=1 to preview.",
      },
      { status: 400 }
    );
  }

  const untilUnix = parseWhen(url.searchParams.get("until")) ?? undefined;
  const dryRun = url.searchParams.get("dryRun") === "1";
  const offset = Number(url.searchParams.get("offset")) || 0;

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const db = getServiceClient();

  try {
    const report = await sweepUnrecordedPayments(
      {
        stripe,
        db,
        // Only a deposit opens a job the installer needs telling about; a
        // balance payment lands on a job they already know they're working.
        onRepaired: async (leadId, kind) => {
          if (kind === "deposit") await notifyRepairedBooking(db, leadId);
        },
      },
      { sinceUnix, untilUnix, dryRun, offset }
    );

    console.log(
      `[SweepPayments] ${report.accountsScanned} account(s) | ${report.paymentsSeen} payment(s) |` +
        ` repaired ${report.repaired} | already recorded ${report.alreadyRecorded} |` +
        ` needs review ${report.needsReview} | orphans ${report.orphans} | failed ${report.failed}` +
        `${dryRun ? " (dry run, nothing written)" : ""}`
    );
    for (const r of report.results) {
      if (r.outcome === "already_recorded") continue;
      console.log(
        `[SweepPayments] ${r.outcome} | lead ${r.leadId} | ${r.kind} | $${r.amount.toFixed(2)}` +
          ` | ${r.sourceId} | account ${r.accountId ?? "platform"}${r.detail ? ` | ${r.detail}` : ""}`
      );
    }

    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...report });
  } catch (error) {
    console.error("[SweepPayments] Sweep failed:", error);
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
