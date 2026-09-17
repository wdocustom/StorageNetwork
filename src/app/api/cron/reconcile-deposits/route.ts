import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getServiceClient } from "@/lib/supabase-server";
import { reconcileDeposits } from "@/lib/stripe/reconcile-deposits";
import { notifyRepairedBooking } from "@/lib/stripe/notify-repaired";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ═══════════════════════════════════════════════════════════════════════════
// /api/cron/reconcile-deposits
//
// Catches deposits that cleared in Stripe but never reached the database —
// the failure the webhook cannot report, because a webhook that never arrives
// leaves nothing behind to alert on. See @/lib/stripe/reconcile-deposits for
// why direct charges made this reachable.
//
//   GET/POST ?dryRun=1   report what would be repaired, write nothing
//   GET/POST             repair, and notify the customer and installer
//
// Both take the same Bearer CRON_SECRET as the other cron routes. Vercel Cron
// issues GET, so GET delegates to POST exactly as the others do.
//
// SCHEDULE: daily, and it must stay daily. Vercel's Hobby plan rejects any
// cron that would run more than once a day — `0 * * * *` fails the DEPLOY, not
// just the job — which is why every cron in vercel.json is daily. A missed
// deposit therefore waits up to a day for the automatic pass; to repair one
// sooner, call this route directly. The real-time path is the webhook, and if
// deposits are routinely landing here rather than there, the Connect endpoint
// is what needs fixing, not this schedule.
// ═══════════════════════════════════════════════════════════════════════════

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
  const dryRun = url.searchParams.get("dryRun") === "1";
  const lookbackDays = Number(url.searchParams.get("lookbackDays")) || undefined;

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const db = getServiceClient();

  try {
    const report = await reconcileDeposits(
      { stripe, db, onRepaired: (leadId) => notifyRepairedBooking(db, leadId) },
      { dryRun, lookbackDays }
    );

    if (report.found > 0) {
      // Loud on purpose: a non-zero count means webhook delivery is dropping
      // payments, which no other signal in the system reports.
      console.error(
        `[ReconcileDeposits] ${report.found} deposit(s) had cleared in Stripe without being recorded` +
          ` — repaired ${report.repaired}${dryRun ? " (dry run, nothing written)" : ""}.` +
          ` Check that STRIPE_CONNECT_WEBHOOK_SECRET is set and the Connect endpoint is` +
          ` registered for payment_intent.succeeded.`
      );
      for (const f of report.findings) {
        console.error(
          `[ReconcileDeposits] lead ${f.leadId} | $${f.amount.toFixed(2)} | ${f.paymentIntentId}` +
            ` | account ${f.accountId ?? "platform"} | unrecorded ${f.unrecordedForHours}h` +
            ` | repaired: ${f.repaired}${f.bountyPending ? " | BOUNTY STILL PENDING" : ""}` +
            (f.error ? ` | ${f.error}` : "")
        );
      }
    } else {
      console.log(`[ReconcileDeposits] Clean — ${report.scanned} unpaid quote(s) checked.`);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...report,
    });
  } catch (error) {
    console.error("[ReconcileDeposits] Job failed:", error);
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

// Also support GET — Vercel Cron issues GET, and it makes the dry run easy to
// run by hand.
export async function GET(req: NextRequest) {
  return POST(req);
}
