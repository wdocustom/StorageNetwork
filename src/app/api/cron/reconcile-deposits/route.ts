import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getServiceClient } from "@/lib/supabase-server";
import { reconcileDeposits } from "@/lib/stripe/reconcile-deposits";
import {
  sendBookingConfirmation,
  sendNewBookingAlert,
  quoteDataToBookingUnits,
} from "@/lib/email";

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

// ── Notifications for a repaired booking ───────────────────────────────────
// A deposit that was never recorded also never triggered its emails: the
// customer has a Stripe receipt but no booking confirmation, and the installer
// was never told the job exists. Both are sent here, guarded by the same
// `booking_email_sent` flag the webhook uses, so a lead can never be mailed
// twice no matter which path records it.
async function notifyRepairedBooking(
  db: ReturnType<typeof getServiceClient>,
  leadId: string
): Promise<void> {
  const { data: lead } = await db
    .from("leads")
    .select(
      "customer_name, customer_email, address, quote_data, estimated_price, deposit_amount, installer_id, scheduled_at, booking_email_sent, dimensions"
    )
    .eq("id", leadId)
    .single();

  if (!lead || lead.booking_email_sent || !lead.customer_email) return;

  let installerName = "Your Installer";
  let installerPhone: string | undefined;
  let installerAvatar: string | undefined;

  if (lead.installer_id) {
    const { data: profile } = await db
      .from("profiles")
      .select("first_name, last_name, business_name, phone, avatar_url")
      .eq("id", lead.installer_id)
      .single();
    if (profile) {
      installerName =
        profile.business_name ||
        [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
        "Your Installer";
      installerPhone = profile.phone || undefined;
      installerAvatar = profile.avatar_url || undefined;
    }
  }

  const unitCount = Array.isArray(lead.quote_data) ? lead.quote_data.length : 1;
  const snapshotUrl = (lead.dimensions as Record<string, unknown> | null)?.build_snapshot_url as
    | string
    | undefined;

  await sendBookingConfirmation({
    customerName: lead.customer_name ?? "Customer",
    customerEmail: lead.customer_email,
    installerName,
    installerPhone,
    installerAvatarUrl: installerAvatar,
    scheduledDate: lead.scheduled_at ?? "TBD",
    address: lead.address ?? "Address Pending",
    depositAmount: lead.deposit_amount ?? 0,
    totalPrice: lead.estimated_price ?? lead.deposit_amount ?? 0,
    jobDescription: `${unitCount} shelving unit${unitCount !== 1 ? "s" : ""}`,
    units: quoteDataToBookingUnits(lead.quote_data),
    leadId,
    buildSnapshotUrl: snapshotUrl,
  });

  if (lead.installer_id) {
    const { data: authUser } = await db.auth.admin.getUserById(lead.installer_id);
    const installerEmail = authUser?.user?.email;
    if (installerEmail) {
      const city = lead.address
        ? lead.address.split(",").slice(-2, -1)[0]?.trim() || lead.address
        : "Unknown";
      await sendNewBookingAlert(installerEmail, city, {
        customerName: lead.customer_name ?? "Customer",
        customerEmail: lead.customer_email || undefined,
        address: lead.address || undefined,
        unitCount,
        totalPrice: lead.estimated_price ?? lead.deposit_amount ?? 0,
        leadId,
        buildSnapshotUrl: snapshotUrl,
      });
    }
  }

  await db.from("leads").update({ booking_email_sent: true }).eq("id", leadId);
}
