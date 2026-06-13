import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { waitUntil } from "@vercel/functions";

export const dynamic = "force-dynamic";
import { sendBookingConfirmation, sendNewBookingAlert, sendProWelcomeEmail, sendProRenewalReceipt, sendSubscriptionPaymentFailed, quoteDataToBookingUnits } from "@/lib/email";
import {
  activateProSubscription,
  deactivateProSubscription,
} from "@/app/actions/pro-subscription";
import { getServiceClient } from "@/lib/supabase-server";
import { Redis } from "@upstash/redis";
import { roundMoney } from "@/utils/mathHelpers";

// ═══════════════════════════════════════════════════════════════════════════
// Stripe Webhook — Automation Brain
// Listens for checkout.session.completed to:
//   1. Mark lead as deposit paid
//   2. Capture customer address from Stripe
//   3. Send customer receipt email
//   4. Send new job alert to installer
//
// ARCHITECTURE: DB-first, email-second. Each step is isolated.
// If email crashes, the DB update is ALREADY committed.
//
// PERFORMANCE: Uses singleton Supabase client (connection reuse).
// Non-critical work (emails, bounties) is fire-and-forget so the 200
// response reaches Stripe well within the 20-second timeout window.
// ═══════════════════════════════════════════════════════════════════════════

/** Reuse singleton — avoids creating a new HTTP client on every DB call */
function getDb() {
  return getServiceClient();
}

// ── Fire-and-forget helper ───────────────────────────────────────────────
// Runs async work without blocking the webhook response. Uses waitUntil()
// to keep the Vercel serverless function alive until emails finish sending,
// even after the HTTP response is returned to Stripe.
function fireAndForget(label: string, fn: () => Promise<void>) {
  console.log(`[Webhook] waitUntil: starting ${label}`);
  const promise = fn()
    .then(() => console.log(`[Webhook] waitUntil: ${label} completed successfully`))
    .catch((err) => console.error(`[Webhook] waitUntil: ${label} failed:`, err));
  waitUntil(promise);
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// ── Idempotency Guard (Redis-backed) ─────────────────────────────────────
// Prevents duplicate processing when Stripe retries webhook delivery.
// Uses Upstash Redis SET NX with 48h TTL so it works across all Vercel
// function instances. Falls back to in-memory Set if Redis is unavailable.
const hasRedis =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

const IDEMPOTENCY_TTL_S = 48 * 60 * 60; // 48 hours
const RECEIPT_DEDUPE_TTL_S = 30 * 24 * 60 * 60; // 30 days

/**
 * Per-invoice receipt dedupe. Stripe fires `customer.subscription.updated`
 * on many things beyond renewals (metadata edits, dunning, card updates),
 * so we key off the invoice ID to ensure each invoice produces at most one
 * receipt email. Atomically claims the slot via SET NX — returns true if
 * this caller won the claim and should send, false if another caller
 * already sent for this invoice.
 */
async function claimReceiptSlot(invoiceId: string | null | undefined): Promise<boolean> {
  if (!invoiceId) return true; // No invoice ID to dedupe on — send anyway
  if (redis) {
    const claimed = await redis.set(`pro_receipt:${invoiceId}`, "1", {
      ex: RECEIPT_DEDUPE_TTL_S,
      nx: true,
    });
    return claimed === "OK";
  }
  if (receiptFallbackSet.has(invoiceId)) return false;
  receiptFallbackSet.add(invoiceId);
  if (receiptFallbackSet.size > 1000) {
    const entries = Array.from(receiptFallbackSet);
    entries.slice(0, entries.length - 1000).forEach((id) => receiptFallbackSet.delete(id));
  }
  return true;
}

/** Returns true if this event was already successfully processed. Marks it as processing if not. */
async function checkAndMarkProcessed(eventId: string): Promise<boolean> {
  if (redis) {
    // Check current value — allow retry if previous attempt failed
    const existing = await redis.get(`webhook:evt:${eventId}`);
    if (existing === "1") return true; // Successfully processed before
    // "failed" or missing — attempt to process (SET with TTL)
    await redis.set(`webhook:evt:${eventId}`, "1", { ex: IDEMPOTENCY_TTL_S });
    return false;
  }
  // Fallback: in-memory (single-instance only, best-effort)
  if (fallbackSet.has(eventId)) return true;
  fallbackSet.add(eventId);
  if (fallbackSet.size > 1000) {
    const entries = Array.from(fallbackSet);
    entries.slice(0, entries.length - 1000).forEach((id) => fallbackSet.delete(id));
  }
  return false;
}

const fallbackSet = new Set<string>();
const receiptFallbackSet = new Set<string>();

// ═══════════════════════════════════════════════════════════════════════════
// Network Referral Bounty — 30% of deposit (min $15) to referring installer
//
// When a deposit is captured on a lead that has a referring_installer_id
// and bounty_status === 'pending', we calculate 30% of the deposit amount
// (with a $15 floor), transfer it to the referrer's Stripe Connect
// account, and mark the bounty as paid.
// ═══════════════════════════════════════════════════════════════════════════

const BOUNTY_RATE = 0.30;        // 30% of deposit
const BOUNTY_FLOOR_CENTS = 1500; // $15.00 minimum

async function processReferralBounty(leadId: string, paymentIntentId: string) {
  try {
    // 1. Atomically claim this bounty: UPDATE only if still 'pending'.
    //    This prevents the TOCTOU race where two different Stripe events
    //    (checkout.session.completed + payment_intent.succeeded) both try
    //    to pay the same bounty. Only the first UPDATE wins.
    const { data: claimed, error: claimErr } = await getDb()
      .from("leads")
      .update({
        bounty_status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)
      .eq("bounty_status", "pending")
      .select("referring_installer_id, address_city, address_state, deposit_amount")
      .maybeSingle();

    if (claimErr || !claimed?.referring_installer_id) {
      return; // No pending bounty, or already claimed by another event
    }

    // 2. Calculate bounty: 30% of deposit, minimum $15
    const depositCents = Math.round((claimed.deposit_amount || 0) * 100);
    const calculatedBountyCents = Math.round(depositCents * BOUNTY_RATE);
    const bountyAmountCents = Math.max(calculatedBountyCents, BOUNTY_FLOOR_CENTS);

    console.log(`[Bounty] Deposit: $${(depositCents / 100).toFixed(2)} → 30% = $${(calculatedBountyCents / 100).toFixed(2)} → Final: $${(bountyAmountCents / 100).toFixed(2)}`);

    // 3. Fetch the referring installer's Stripe account + email + trial status
    const { data: referrer, error: refErr } = await getDb()
      .from("profiles")
      .select("stripe_account_id, email, business_name, first_name, pro_trial_ends_at, stripe_subscription_id")
      .eq("id", claimed.referring_installer_id)
      .single();

    // Block bounty payout for soft-locked installers (trial expired, no subscription)
    if (referrer?.pro_trial_ends_at && !referrer.stripe_subscription_id) {
      const trialEnd = new Date(referrer.pro_trial_ends_at as string);
      if (new Date() >= trialEnd) {
        console.log(`[Bounty] Referring installer ${claimed.referring_installer_id} is soft-locked — forfeiting bounty`);
        await getDb().from("leads").update({ bounty_status: "forfeited" }).eq("id", leadId);
        return;
      }
    }

    if (refErr || !referrer?.stripe_account_id) {
      console.warn("[Bounty] Referring installer has no Stripe account:", claimed.referring_installer_id);
      // Revert to pending so it can be retried
      await getDb().from("leads").update({ bounty_status: "pending" }).eq("id", leadId);
      return;
    }

    // 4. Execute the Stripe Transfer
    if (!stripe) return;
    const transfer = await stripe.transfers.create({
      amount: bountyAmountCents,
      currency: "usd",
      destination: referrer.stripe_account_id,
      transfer_group: paymentIntentId,
      description: `Network Referral Bounty (30% of deposit) — Lead ${leadId.slice(0, 8)}`,
    });

    console.log("[Bounty] Transfer created:", transfer.id, "→", referrer.stripe_account_id, `| $${(bountyAmountCents / 100).toFixed(2)}`);

    // 5. Mark bounty as paid + record actual amount
    await getDb()
      .from("leads")
      .update({
        bounty_status: "paid",
        bounty_amount: bountyAmountCents / 100,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    console.log("[Bounty] Bounty paid for lead:", leadId, `| $${(bountyAmountCents / 100).toFixed(2)}`);

    // 6. Send bounty-paid email to the referring installer (non-blocking)
    if (referrer.email) {
      try {
        const { sendBountyPaidEmail } = await import("@/lib/email");
        await sendBountyPaidEmail(referrer.email, {
          referrerName: referrer.business_name || referrer.first_name || "Installer",
          customerCity: claimed.address_city || null,
          customerState: claimed.address_state || null,
          amount: bountyAmountCents / 100,
        });
      } catch (emailErr) {
        console.error("[Bounty] Paid email failed (non-fatal):", emailErr);
      }
    }
  } catch (bountyErr) {
    // Non-fatal: don't let bounty failure break the main webhook flow
    // Revert to pending so it can be retried on next webhook
    try {
      await getDb().from("leads").update({ bounty_status: "pending" }).eq("id", leadId).eq("bounty_status", "processing");
    } catch { /* best-effort revert */ }
    console.error("[Bounty] Transfer failed (non-fatal):", bountyErr);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// processRealtorReferralCredit — Realtor Referral Program (migration 119)
//
// When a deposit is captured on a lead that carries `referred_by_realtor_id`,
// call the credit_realtor_referral RPC to atomically add 5 totes to the
// realtor's gift inventory. The RPC is idempotent (UNIQUE(lead_id) on the
// credits ledger), so double-fires from webhook retries or the
// verifyAndConfirmDeposit fallback are safe no-ops.
// ═══════════════════════════════════════════════════════════════════════════

async function processRealtorReferralCredit(leadId: string) {
  try {
    const { data, error } = await getDb().rpc("credit_realtor_referral", {
      p_lead_id: leadId,
    });

    if (error) {
      console.error("[RealtorReferral] RPC failed (non-fatal):", error.message);
      return;
    }

    // RPC returns SETOF; supabase-js exposes that as an array.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      console.warn("[RealtorReferral] RPC returned no row for lead:", leadId);
      return;
    }

    if (row.skipped_reason) {
      console.log(
        `[RealtorReferral] Skipped lead ${leadId}: ${row.skipped_reason}`
      );
      return;
    }

    if (row.already_credited) {
      console.log(
        `[RealtorReferral] Already credited for lead ${leadId} (realtor ${row.realtor_id?.slice(0, 8)}…, balance ${row.new_balance})`
      );
      return;
    }

    console.log(
      `[RealtorReferral] +${row.totes_credited} totes → realtor ${row.realtor_id?.slice(0, 8)}… (new balance ${row.new_balance}) for lead ${leadId}`
    );
  } catch (err) {
    console.error("[RealtorReferral] Credit failed (non-fatal):", err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// processPromoterCommission — Promoter Program (migration 129)
//
// When a "plans" checkout session carries `metadata.promoter_id` (dropped
// there by /promo/<code> attribution at session-creation time), pay that
// promoter their INDIVIDUALIZED cut — set per-promoter in their
// `promoter_agreements.agreement_config` — via a Stripe Connect transfer
// straight to their connected account.
//
// Idempotency: a UNIQUE(agreement_id, stripe_session_id) index on
// promoter_payouts means the first INSERT wins; webhook retries hit a
// 23505 unique-violation and we treat that as "already handled" and bail.
// This mirrors the affiliate_payouts dedup pattern from migration 106.
// ═══════════════════════════════════════════════════════════════════════════

const PLAN_PURCHASE_TYPES = new Set([
  "chair_plan",
  "chair_bundle",
  "chair_template",
  "diy_plan",
  "public_plan",
]);

async function processPromoterCommission(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  const promoterId = metadata.promoter_id;
  if (!promoterId || !stripe) return;

  try {
    const saleAmountCents = session.amount_total ?? 0;
    if (saleAmountCents <= 0) return;

    // 1. Active agreement = the individualized cut for this promoter.
    const { data: agreement, error: agreementErr } = await getDb()
      .from("promoter_agreements")
      .select("id, agreement_config, status")
      .eq("promoter_id", promoterId)
      .eq("status", "active")
      .maybeSingle();

    if (agreementErr || !agreement) {
      console.log(`[Promoter] No active agreement for ${promoterId.slice(0, 8)}… — skipping commission`);
      return;
    }

    const { computePromoterCommissionCents } = await import("@/lib/promoter-cuts");
    const config = agreement.agreement_config as { type: "percentage"; percent: number };
    const commissionCents = computePromoterCommissionCents(config, saleAmountCents);
    if (commissionCents <= 0) return;

    // 2. Claim the payout row first (idempotency gate). A 23505 here means
    //    a previous delivery of this same event already inserted it.
    const { data: payoutRow, error: insertErr } = await getDb()
      .from("promoter_payouts")
      .insert({
        promoter_id: promoterId,
        agreement_id: agreement.id,
        stripe_session_id: session.id,
        plan_id: metadata.plan_id || null,
        sale_amount_cents: saleAmountCents,
        commission_cents: commissionCents,
        status: "pending",
        notes: `${config.percent}% of $${(saleAmountCents / 100).toFixed(2)} = $${(commissionCents / 100).toFixed(2)}`,
      })
      .select("id")
      .single();

    if (insertErr || !payoutRow) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((insertErr as any)?.code === "23505") {
        console.log(`[Promoter] Commission already recorded for session ${session.id} — skipping`);
        return;
      }
      console.error("[Promoter] payout insert failed:", insertErr);
      return;
    }

    // 3. Fetch the promoter's connected Stripe account.
    const { data: promoter, error: profileErr } = await getDb()
      .from("profiles")
      .select("stripe_account_id, stripe_details_submitted, email, business_name, first_name")
      .eq("id", promoterId)
      .single();

    if (profileErr || !promoter?.stripe_account_id || !promoter.stripe_details_submitted) {
      console.warn(`[Promoter] ${promoterId.slice(0, 8)}… has no connected Stripe account — leaving payout pending`);
      await getDb()
        .from("promoter_payouts")
        .update({ status: "failed", failure_reason: "no_connected_stripe_account", updated_at: new Date().toISOString() })
        .eq("id", payoutRow.id);
      return;
    }

    // 4. Execute the transfer.
    const transfer = await stripe.transfers.create({
      amount: commissionCents,
      currency: "usd",
      destination: promoter.stripe_account_id,
      transfer_group: session.id,
      description: `Promoter commission (${config.percent}%) — session ${session.id.slice(0, 16)}…`,
    });

    await getDb()
      .from("promoter_payouts")
      .update({
        status: "paid",
        stripe_transfer_id: transfer.id,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payoutRow.id);

    console.log(
      `[Promoter] Paid $${(commissionCents / 100).toFixed(2)} → ${promoterId.slice(0, 8)}… (transfer ${transfer.id}) for session ${session.id}`
    );
  } catch (err) {
    console.error("[Promoter] Commission processing failed (non-fatal):", err);
    // Best-effort: mark the row failed so an admin can see + retry rather
    // than it silently sitting in 'pending' forever.
    try {
      await getDb()
        .from("promoter_payouts")
        .update({ status: "failed", failure_reason: "transfer_error", updated_at: new Date().toISOString() })
        .eq("promoter_id", promoterId)
        .eq("stripe_session_id", session.id)
        .eq("status", "pending");
    } catch { /* best-effort */ }
  }
}

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  // ── Parse & verify event ──────────────────────────────────────────────
  let event: Stripe.Event;
  try {
    if (!WEBHOOK_SECRET) {
      console.error("[Webhook] CRITICAL: STRIPE_WEBHOOK_SECRET is not set. Refusing to process.");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }

    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (parseErr) {
    console.error("[Webhook] Signature verification failed:", parseErr);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── Idempotency: Reject duplicate events ────────────────────────────
  // Stripe can resend events on timeout. Track processed event IDs in Redis
  // to prevent duplicate DB writes and bounty transfers across all instances.
  const alreadyProcessed = await checkAndMarkProcessed(event.id);
  if (alreadyProcessed) {
    console.log("[Webhook] Duplicate event ignored:", event.id);
    return NextResponse.json({ received: true });
  }

  console.log("[Webhook] Event received:", event.type, "| ID:", event.id);

  // ── Handle checkout.session.completed ─────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};
    const leadId = session.client_reference_id || metadata.leadId || metadata.lead_id;
    const installerId = metadata.installerId || metadata.installer_id;

    console.log("[Webhook] Session:", session.id, "| Lead:", leadId, "| Installer:", installerId);

    // ═════════════════════════════════════════════════════════════════════
    // REALTOR TOTE-RENTAL GIFT — Closing-gift purchase (Phase A2).
    // Handled here BEFORE the leadId-required guard below, because gift
    // sessions don't carry a leadId (they're keyed on gift_id in metadata).
    // ═════════════════════════════════════════════════════════════════════
    if (metadata.type === "tote_rental_gift") {
      try {
        const { finalizeGiftPurchase } = await import("@/app/actions/realtor-gifts");
        const result = await finalizeGiftPurchase({ sessionId: session.id });
        if (!result.ok) {
          console.error("[Webhook] tote_rental_gift finalize failed:", result.error);
        } else {
          console.log(
            "[Webhook] tote_rental_gift finalized:",
            result.giftId,
            result.alreadyFinalized ? "(already done)" : ""
          );
        }
      } catch (err) {
        console.error("[Webhook] tote_rental_gift handler crashed:", err);
      }
      return NextResponse.json({ received: true });
    }

    // ═════════════════════════════════════════════════════════════════════
    // REALTOR TOTE-PACK PURCHASE — Inventory top-up (bulk tote buy).
    // Atomic credit happens in the credit_realtor_tote_purchase Postgres
    // function (migration 114); finalizeTotePackPurchase wraps the RPC.
    // ═════════════════════════════════════════════════════════════════════
    if (metadata.type === "tote_pack_purchase") {
      try {
        const { finalizeTotePackPurchase } = await import(
          "@/app/actions/realtor-tote-inventory"
        );
        const result = await finalizeTotePackPurchase({ sessionId: session.id });
        if (!result.ok) {
          console.error("[Webhook] tote_pack_purchase finalize failed:", result.error);
        } else {
          console.log(
            "[Webhook] tote_pack_purchase finalized:",
            result.purchaseId,
            `credited=${result.totalCredited} newBalance=${result.newBalance}`,
            result.alreadyFinalized ? "(already done)" : ""
          );
        }
      } catch (err) {
        console.error("[Webhook] tote_pack_purchase handler crashed:", err);
      }
      return NextResponse.json({ received: true });
    }

    // ═════════════════════════════════════════════════════════════════════
    // INVENTORY-MODE GIFT SURCHARGE — $25 extended-delivery (51–75 mi).
    // The gift row already exists (created by dispatch_inventory_tote_gift)
    // and the realtor's balance has already been debited. This finalizes
    // the surcharge payment: flips status → paid, stamps gift_token + paid_at,
    // fires recipient invite + realtor receipt.
    // ═════════════════════════════════════════════════════════════════════
    if (metadata.type === "inventory_gift_surcharge") {
      try {
        const { finalizeInventoryGiftSurcharge } = await import(
          "@/app/actions/realtor-inventory-gifts"
        );
        const result = await finalizeInventoryGiftSurcharge({ sessionId: session.id });
        if (!result.ok) {
          console.error("[Webhook] inventory_gift_surcharge finalize failed:", result.error);
        } else {
          console.log(
            "[Webhook] inventory_gift_surcharge finalized:",
            result.giftId,
            result.alreadyFinalized ? "(already done)" : ""
          );
        }
      } catch (err) {
        console.error("[Webhook] inventory_gift_surcharge handler crashed:", err);
      }
      return NextResponse.json({ received: true });
    }

    // ═════════════════════════════════════════════════════════════════════
    // PROMOTER PROGRAM — individualized-cut commission on plan-purchase
    // sales attributed to a promoter's referral link. Plan-purchase sessions
    // carry no leadId, so this must run before the leadId guard below.
    // ═════════════════════════════════════════════════════════════════════
    if (PLAN_PURCHASE_TYPES.has(metadata.type || "") && metadata.promoter_id) {
      fireAndForget("promoter commission", () => processPromoterCommission(session));
      return NextResponse.json({ received: true });
    }

    if (!leadId) {
      console.warn("[Webhook] checkout.session.completed without leadId in metadata");
      return NextResponse.json({ received: true });
    }

    const amountPaid = (session.amount_total || 0) / 100;
    const paymentType = metadata.type || "booking"; // "booking" (deposit) or "final_payment"

    console.log("[Webhook] Payment type:", paymentType, "| Amount:", amountPaid);

    // ═════════════════════════════════════════════════════════════════════
    // CLEANOUT UPSELL — Customer added a cleanout/add-on service
    // ═════════════════════════════════════════════════════════════════════
    if (paymentType === "cleanout_upsell") {
      try {
        const { handleCleanoutUpsellPayment } = await import("@/app/actions/cleanout-upsell");
        await handleCleanoutUpsellPayment(leadId, metadata, amountPaid);
        console.log("[Webhook] Cleanout upsell processed for lead:", leadId);
      } catch (err) {
        console.error("[Webhook] Cleanout upsell handler failed:", err);
      }
      return NextResponse.json({ received: true });
    }

    // ═════════════════════════════════════════════════════════════════════
    // FINAL PAYMENT — Customer paid the balance via payment link
    // ═════════════════════════════════════════════════════════════════════
    if (paymentType === "final_payment") {
      // ── CRITICAL: Verify payment was actually collected before marking paid ──
      // checkout.session.completed fires for ALL checkout completions — including
      // cases where payment_status is "unpaid" (card declined, bank redirect pending, etc.).
      // Without this guard, a declined payment would still trigger "Payment Cleared" emails
      // and mark the job as paid in the DB.
      if (session.payment_status !== "paid") {
        console.warn(
          `[Webhook] Final payment session ${session.id} has payment_status="${session.payment_status}" — payment not collected, skipping`
        );
        return NextResponse.json({ received: true });
      }

      // Belt-and-suspenders: verify the underlying PaymentIntent also succeeded.
      // Covers edge cases where session.payment_status is stale or the PI was refunded/voided
      // between the session completing and this handler running.
      const piId = session.payment_intent as string | null;
      if (piId && stripe) {
        try {
          const pi = await stripe.paymentIntents.retrieve(piId);
          if (pi.status !== "succeeded") {
            console.warn(
              `[Webhook] PaymentIntent ${piId} has status="${pi.status}" — not marking lead as paid`
            );
            return NextResponse.json({ received: true });
          }
        } catch (piErr) {
          console.error("[Webhook] Failed to retrieve PaymentIntent for verification:", piErr);
          if (redis) await redis.set(`webhook:evt:${event.id}`, "failed", { ex: 300 }).catch(() => {});
          return NextResponse.json({ error: "Payment verification failed" }, { status: 500 });
        }
      }

      try {
        // State guard: only update if the job is in a pre-paid state.
        // Prevents re-processing if the installer already marked it paid manually.
        const { data: updated, error } = await getDb()
          .from("leads")
          .update({
            status: "paid",
            deposit_paid: true,
            payout_status: "paid",
            paid_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", leadId)
          .in("status", ["payment_pending", "open", "pending_payment"])
          .select("id")
          .maybeSingle();

        if (error) {
          console.error("[Webhook] CRITICAL: Final payment DB update failed!", JSON.stringify(error));
          // Return 500 so Stripe retries — the payment was collected but DB wasn't updated
          if (redis) await redis.set(`webhook:evt:${event.id}`, "failed", { ex: 300 }).catch(() => {});
          return NextResponse.json({ error: "DB update failed" }, { status: 500 });
        }

        if (!updated) {
          console.log("[Webhook] Final payment: lead already in terminal state, skipping DB update for:", leadId);
        } else {
          console.log("SUCCESS: Job marked PAID (final payment) for lead:", leadId);
        }
      } catch (err) {
        console.error("[Webhook] Final payment update threw:", err);
        // Return 500 so Stripe retries
        if (redis) await redis.set(`webhook:evt:${event.id}`, "failed", { ex: 300 }).catch(() => {});
        return NextResponse.json({ error: "Final payment update exception" }, { status: 500 });
      }

      // Fire-and-forget: emails are non-critical — return 200 to Stripe immediately
      fireAndForget("final_payment_emails", async () => {
        const { data: lead } = await getDb()
          .from("leads")
          .select("customer_name, customer_email, estimated_price, deposit_amount, quote_data, installer_id")
          .eq("id", leadId)
          .single();

        const { sendJobReceipt, sendPaymentReceivedAlert, quoteDataToBookingUnits } = await import("@/lib/email");
        let installerName = "Your Installer";
        let installerEmail: string | null = null;

        if (lead?.installer_id) {
          const { data: profile } = await getDb()
            .from("profiles")
            .select("first_name, last_name, business_name")
            .eq("id", lead.installer_id)
            .single();
          if (profile) {
            installerName = profile.business_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Your Installer";
          }
          const { data: authUser } = await getDb().auth.admin.getUserById(lead.installer_id);
          installerEmail = authUser?.user?.email || null;
        }

        const unitCount = Array.isArray(lead?.quote_data) ? lead.quote_data.length : 1;
        const customerName = lead?.customer_name ?? "Customer";

        if (lead?.customer_email) {
          // Generate review token for this job
          const { generateReviewToken } = await import("@/app/actions/reviews");
          const { getAppUrl } = await import("@/lib/url-helper");
          const reviewToken = await generateReviewToken(leadId);
          const reviewUrl = reviewToken ? `${getAppUrl()}/review/${reviewToken}` : undefined;

          await sendJobReceipt(lead.customer_email, {
            customerName,
            installerName,
            totalAmount: lead.estimated_price ?? amountPaid,
            depositPaid: lead.deposit_amount ?? 0,
            balanceCollected: amountPaid,
            jobDescription: `${unitCount} shelving unit${unitCount !== 1 ? "s" : ""}`,
            units: quoteDataToBookingUnits(lead.quote_data),
            completedDate: new Date().toISOString(),
            reviewUrl,
          });
          console.log("[Webhook] Receipt email sent to customer");
        }

        if (installerEmail) {
          await sendPaymentReceivedAlert(installerEmail, {
            installerName,
            customerName,
            amountReceived: amountPaid,
            jobTotal: lead?.estimated_price ?? amountPaid,
            leadId,
          });
          console.log("[Webhook] Payment alert sent to installer:", installerEmail);
        }
      });

      return NextResponse.json({ received: true });
    }

    // ═════════════════════════════════════════════════════════════════════
    // BOOKING (Deposit) — Original flow
    // ═════════════════════════════════════════════════════════════════════

    // ── Extract address from Stripe (safe — all optional chaining) ────
    const stripeAddress =
      session.customer_details?.address ||
      (session as any).shipping_details?.address ||
      null;

    let fullAddress = "";
    if (stripeAddress) {
      fullAddress = [
        stripeAddress.line1,
        stripeAddress.line2,
        stripeAddress.city,
        stripeAddress.state,
        stripeAddress.postal_code,
      ].filter(Boolean).join(", ");
    }

    // Robust email extraction: customer_details > customer_email > metadata
    const stripeEmail = session.customer_details?.email || session.customer_email || metadata.customer_email || null;

    console.log("[Webhook] Amount:", amountPaid, "| Email:", stripeEmail, "| Address:", fullAddress || "none");

    // ═════════════════════════════════════════════════════════════════════
    // STEP 1: FORCE DB UPDATE (Critical Path — isolated try/catch)
    // ═════════════════════════════════════════════════════════════════════
    try {
      // Fetch estimated_price and discount_amount to recalculate balance_due based on actual deposit
      const { data: leadForBalance } = await getDb()
        .from("leads")
        .select("estimated_price, discount_amount")
        .eq("id", leadId)
        .maybeSingle();
      const estimatedPrice = leadForBalance?.estimated_price ?? 0;
      const discountAmt = leadForBalance?.discount_amount ?? 0;
      const balanceDue = roundMoney(estimatedPrice - amountPaid - discountAmt);

      const updatePayload: Record<string, unknown> = {
        deposit_paid: true,
        deposit_amount: amountPaid,
        balance_due: balanceDue,
        payout_status: "deposit_collected",
        status: "open",
      };

      // Only overwrite address fields if Stripe actually has address data.
      // When address was collected on the /pay page, createDepositIntent() already
      // saved it to the DB — clobbering here would replace real data with "Address Pending".
      if (stripeAddress) {
        updatePayload.address_line1 = stripeAddress.line1 ?? "Address Pending";
        updatePayload.address_city = stripeAddress.city ?? "";
        updatePayload.address_state = stripeAddress.state ?? "";
        updatePayload.address_zip = stripeAddress.postal_code ?? "";
        updatePayload.city = stripeAddress.city ?? "";
        updatePayload.state = stripeAddress.state ?? "";
        if (fullAddress) {
          updatePayload.address = fullAddress;
        }
      }

      if (stripeEmail) {
        updatePayload.customer_email = stripeEmail;
      }

      console.log("[Webhook] DB update payload:", JSON.stringify(updatePayload));

      // State guard: only update if deposit hasn't already been recorded
      const { data: depositResult, error: updateError } = await getDb()
        .from("leads")
        .update(updatePayload)
        .eq("id", leadId)
        .eq("deposit_paid", false)
        .select("id")
        .maybeSingle();

      if (updateError) {
        console.error("[Webhook] CRITICAL: DB update failed!", JSON.stringify(updateError));
        // Return 500 so Stripe retries. Do NOT delete the idempotency key —
        // the retry will arrive with the same event.id. We clear the key first
        // so the retry can be re-processed, but use a short TTL to prevent
        // infinite duplicate processing if the error is permanent.
        if (redis) await redis.set(`webhook:evt:${event.id}`, "failed", { ex: 300 }).catch(() => {});
        return NextResponse.json({ error: "DB update failed" }, { status: 500 });
      }

      if (!depositResult) {
        console.log("[Webhook] Deposit already recorded for lead:", leadId, "— skipping duplicate");
      } else {
        console.log("SUCCESS: Job DB Updated for lead:", leadId);
      }

      // ── Network Referral Bounty (non-blocking) ───────────────────────
      const piId = session.payment_intent as string;
      if (piId) waitUntil(processReferralBounty(leadId, piId));

      // ── Realtor Referral Credit (non-blocking, idempotent) ───────────
      // Fires for every deposit-paid event; the RPC is a no-op when the
      // lead has no realtor attribution.
      waitUntil(processRealtorReferralCredit(leadId));
    } catch (dbError) {
      console.error("[Webhook] CRITICAL: DB update threw!", dbError);
      // Return 500 so Stripe retries. Reset key with short TTL to allow retry.
      if (redis) await redis.set(`webhook:evt:${event.id}`, "failed", { ex: 300 }).catch(() => {});
      return NextResponse.json({ error: "DB update exception" }, { status: 500 });
    }

    // ═════════════════════════════════════════════════════════════════════
    // STEP 2: EMAILS — sent synchronously so Stripe retries on failure.
    // DB update is idempotent. booking_email_sent flag prevents duplicates.
    // ═════════════════════════════════════════════════════════════════════
    try {
      const { data: lead } = await getDb()
        .from("leads")
        .select("customer_name, customer_email, address, quote_data, estimated_price, installer_id, scheduled_at, booking_email_sent, dimensions")
        .eq("id", leadId)
        .single();

      if (!lead) {
        console.warn("[Webhook] Lead not found after update — skipping emails");
      } else if (lead.booking_email_sent) {
        console.log("[Webhook] Booking emails already sent for lead:", leadId, "— skipping");
      } else {
        const resolvedInstallerId = installerId || lead.installer_id;
        const customerEmail = lead.customer_email || stripeEmail;
        const customerName = lead.customer_name || session.customer_details?.name || metadata.customer_name || "Customer";

        if (!customerEmail) {
          console.warn("[Webhook] No customer email — skipping booking confirmation");
        } else {
          let installerName = "Your Installer";
          let installerPhone: string | undefined;
          let installerAvatar: string | undefined;

          if (resolvedInstallerId) {
            const { data: profile } = await getDb()
              .from("profiles")
              .select("first_name, last_name, business_name, phone, avatar_url")
              .eq("id", resolvedInstallerId)
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

          const snapshotUrl = (lead.dimensions as Record<string, unknown> | null)?.build_snapshot_url as string | undefined;

          await sendBookingConfirmation({
            customerName,
            customerEmail,
            installerName,
            installerPhone,
            installerAvatarUrl: installerAvatar,
            scheduledDate: lead.scheduled_at ?? "TBD",
            address: lead.address ?? fullAddress ?? "Address Pending",
            depositAmount: amountPaid,
            totalPrice: lead.estimated_price ?? amountPaid,
            jobDescription: `${unitCount} shelving unit${unitCount !== 1 ? "s" : ""}`,
            units: quoteDataToBookingUnits(lead.quote_data),
            leadId,
            buildSnapshotUrl: snapshotUrl,
          });
          console.log("[Webhook] Booking confirmation sent for lead:", leadId);

          // ── NEW BOOKING alert to installer ────────────────────────────────
          if (resolvedInstallerId) {
            try {
              const { data: authUser } = await getDb().auth.admin.getUserById(resolvedInstallerId);
              const installerEmail = authUser?.user?.email;
              if (installerEmail) {
                const city = lead.address
                  ? lead.address.split(",").slice(-2, -1)[0]?.trim() || lead.address
                  : fullAddress
                    ? fullAddress.split(",").slice(-2, -1)[0]?.trim() || "Unknown"
                    : "Unknown";
                await sendNewBookingAlert(installerEmail, city, {
                  customerName,
                  customerEmail: customerEmail || undefined,
                  address: lead.address || fullAddress || undefined,
                  unitCount,
                  totalPrice: lead.estimated_price ?? amountPaid,
                  leadId,
                  buildSnapshotUrl: snapshotUrl,
                });
                console.log("[Webhook] Installer booking alert sent for lead:", leadId);
              }
            } catch (alertErr) {
              console.error("[Webhook] Installer alert failed (non-fatal):", alertErr);
            }
          }

          // Mark emails as sent so retries don't re-send
          await getDb()
            .from("leads")
            .update({ booking_email_sent: true })
            .eq("id", leadId);
        }
      }
    } catch (emailErr) {
      console.error("[Webhook] Booking email failed:", emailErr);
      // Return 500 so Stripe retries — DB update is idempotent, email will get another chance
      if (redis) await redis.set(`webhook:evt:${event.id}`, "failed", { ex: 300 }).catch(() => {});
      return NextResponse.json({ error: "Email sending failed" }, { status: 500 });
    }

    console.log(`[Webhook] checkout.session.completed fully processed for lead ${leadId}`);
  }

  // ── Handle Pro subscription events ──────────────────────────────────────
  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.userId;
    const isFirstActivation = event.type === "customer.subscription.created";

    if (userId && subscription.status === "active") {
      console.log(`[Webhook] Pro subscription ${isFirstActivation ? "created" : "renewed"} for user:`, userId);

      // Verify the latest invoice actually got paid before sending any
      // billing email. customer.subscription.updated fires on many things
      // (metadata edits, dunning retries, Radar-blocked renewals) and the
      // subscription can stay status:"active" through a grace period even
      // when the most recent charge didn't succeed.
      const latestInvoiceId = typeof subscription.latest_invoice === "string"
        ? subscription.latest_invoice
        : subscription.latest_invoice?.id;
      let latestInvoicePaid = true;
      if (latestInvoiceId && stripe) {
        try {
          const invoice = await stripe.invoices.retrieve(latestInvoiceId);
          latestInvoicePaid = invoice.status === "paid";
          if (!latestInvoicePaid) {
            console.log(
              `[Webhook] Skipping Pro ${isFirstActivation ? "welcome" : "renewal"} email — invoice ${latestInvoiceId} is ${invoice.status}`,
            );
          }
        } catch (err) {
          console.error("[Webhook] Failed to retrieve latest invoice:", err);
          latestInvoicePaid = false;
        }
      }

      const result = await activateProSubscription(userId, subscription.id);
      if (result.success && result.slug) {
        console.log("[Webhook] Pro activated, slug:", result.slug);

        if (isFirstActivation && latestInvoicePaid) {
          // First subscription — send motivational welcome email
          fireAndForget("pro_welcome", async () => {
            if (!(await claimReceiptSlot(latestInvoiceId))) {
              console.log(`[Webhook] Pro welcome already claimed for invoice ${latestInvoiceId}, skipping`);
              return;
            }

            const { data: profile } = await getDb()
              .from("profiles")
              .select("first_name, last_name, business_name")
              .eq("id", userId)
              .single();

            const { data: authUser } = await getDb().auth.admin.getUserById(userId);
            const email = authUser?.user?.email;

            if (email && profile) {
              const name = profile.business_name ||
                [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
                "Partner";

              await sendProWelcomeEmail(email, { name, slug: result.slug!, installerId: userId });
              console.log("[Webhook] Pro welcome email sent to:", email);
            }

            // Activate affiliate referral if one exists
            const { data: pendingRef } = await getDb()
              .from("referrals")
              .select("id")
              .eq("installer_id", userId)
              .in("status", ["pending", "inactive"])
              .maybeSingle();

            if (pendingRef) {
              await getDb()
                .from("referrals")
                .update({ status: "active" })
                .eq("id", pendingRef.id);
              console.log("[Webhook] Referral activated for installer:", userId);
            }
          });
        } else if (!isFirstActivation && latestInvoicePaid) {
          // Renewal — send receipt with sales recap
          fireAndForget("pro_renewal_receipt", async () => {
            if (!(await claimReceiptSlot(latestInvoiceId))) {
              console.log(`[Webhook] Pro receipt already claimed for invoice ${latestInvoiceId}, skipping`);
              return;
            }

            const { data: profile } = await getDb()
              .from("profiles")
              .select("first_name, last_name, business_name")
              .eq("id", userId)
              .single();

            const { data: authUser } = await getDb().auth.admin.getUserById(userId);
            const email = authUser?.user?.email;

            if (email && profile) {
              const name = profile.business_name ||
                [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
                "Partner";

              const periodEnd = subscription.items.data[0]?.current_period_end;
              const periodStart = subscription.items.data[0]?.current_period_start;
              const amountPaid = subscription.items.data[0]?.price?.unit_amount ?? 4900;

              await sendProRenewalReceipt(email, {
                name,
                slug: result.slug!,
                periodStart: periodStart
                  ? new Date(periodStart * 1000).toISOString()
                  : new Date().toISOString(),
                periodEnd: periodEnd
                  ? new Date(periodEnd * 1000).toISOString()
                  : new Date().toISOString(),
                amountPaid,
              });
              console.log("[Webhook] Pro renewal receipt sent to:", email);
            }
          });
        }
      } else {
        console.error("[Webhook] Pro activation failed:", result.error);
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.userId;

    if (userId) {
      console.log("[Webhook] Pro subscription cancelled for user:", userId);
      await deactivateProSubscription(userId);

      // ── Forfeit all pending bounties ─────────────────────────────
      // When a Pro cancels, any pending bounties become forfeited.
      // This ensures no payout even if a deposit comes in later.
      try {
        const { data: forfeited, error: forfeitErr } = await getDb()
          .from("leads")
          .update({
            bounty_status: "forfeited",
            updated_at: new Date().toISOString(),
          })
          .eq("referring_installer_id", userId)
          .eq("bounty_status", "pending")
          .select("id");

        if (forfeitErr) {
          console.error("[Webhook] Bounty forfeiture DB error (non-fatal):", forfeitErr);
        } else {
          const count = forfeited?.length ?? 0;
          if (count > 0) {
            console.log(`[Webhook] Forfeited ${count} pending bounties for installer: ${userId}`);
          }
        }
      } catch (bountyErr) {
        console.error("[Webhook] Bounty forfeiture failed (non-fatal):", bountyErr);
      }

      // ── Deactivate affiliate referral ──────────────────────────────
      try {
        await getDb()
          .from("referrals")
          .update({ status: "inactive" })
          .eq("installer_id", userId)
          .eq("status", "active");
        console.log("[Webhook] Referral deactivated for installer:", userId);
      } catch (refErr) {
        console.error("[Webhook] Referral deactivation failed (non-fatal):", refErr);
      }
    }
  }

  // ── Handle invoice.payment_failed — dunning email ──────────────────────
  // Stripe Radar blocks, expired cards, and deactivated virtual cards all
  // surface here. The subscription stays "active" through a grace period
  // and gets auto-suspended on a later customer.subscription.updated, but
  // until now no email went out — the customer just discovered it at next
  // login. This sends a heads-up with a one-click hosted_invoice_url and a
  // portal link to update the saved card.
  if (event.type === "invoice.payment_failed" && stripe) {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionRef = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription;
    const isSubscriptionInvoice = !!subscriptionRef;

    if (isSubscriptionInvoice) {
      fireAndForget("invoice_payment_failed_email", async () => {
        const subscriptionId =
          typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;
        if (!subscriptionId) return;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = subscription.metadata?.userId;
        if (!userId) {
          console.log("[Webhook] invoice.payment_failed: no userId on subscription", subscriptionId);
          return;
        }

        const { data: profile } = await getDb()
          .from("profiles")
          .select("first_name, last_name, business_name")
          .eq("id", userId)
          .single();

        const { data: authUser } = await getDb().auth.admin.getUserById(userId);
        const email = authUser?.user?.email;
        if (!email || !profile) {
          console.log("[Webhook] invoice.payment_failed: missing email/profile for user", userId);
          return;
        }

        const name = profile.business_name ||
          [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
          "Partner";

        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;

        const { getAppUrl } = await import("@/lib/url-helper");
        let portalUrl = `${getAppUrl()}/dashboard/profile`;
        try {
          const portal = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${getAppUrl()}/dashboard/profile`,
          });
          portalUrl = portal.url;
        } catch (err) {
          console.error("[Webhook] Failed to create portal session for dunning email:", err);
        }

        await sendSubscriptionPaymentFailed(email, {
          name,
          amountDue: invoice.amount_due ?? 0,
          invoiceNumber: invoice.number ?? null,
          attemptCount: invoice.attempt_count ?? 1,
          nextAttemptAt: invoice.next_payment_attempt
            ? new Date(invoice.next_payment_attempt * 1000).toISOString()
            : null,
          hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
          portalUrl,
        });
        console.log(
          `[Webhook] Dunning email sent to ${email} for invoice ${invoice.id} (attempt ${invoice.attempt_count})`,
        );
      });
    }
  }

  // ── Handle subscription payment failure — auto-suspend ─────────────────
  // When a subscription invoice fails, suspend the installer's account so
  // they can't receive leads until they fix their payment.  Trial users
  // (pro_trial_ends_at in the future, <45 days, <3 jobs) are never
  // auto-suspended — their trial is still valid.
  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.userId;

    if (userId && (subscription.status === "past_due" || subscription.status === "unpaid")) {
      console.log("[Webhook] Subscription payment issue for user:", userId, "status:", subscription.status);

      // Check if installer is on an active trial — skip suspension if so
      const { data: profile } = await getDb()
        .from("profiles")
        .select("pro_trial_ends_at, is_suspended")
        .eq("id", userId)
        .single();

      const onActiveTrial =
        profile?.pro_trial_ends_at &&
        new Date(profile.pro_trial_ends_at) > new Date();

      if (!onActiveTrial && !profile?.is_suspended) {
        await getDb()
          .from("profiles")
          .update({
            is_suspended: true,
            suspension_reason: "payment",
          })
          .eq("id", userId);
        console.log("[Webhook] Auto-suspended installer due to payment failure:", userId);
      }
    }

    // If subscription becomes active again (e.g. payment recovered), lift payment suspension
    if (userId && subscription.status === "active") {
      const { data: profile } = await getDb()
        .from("profiles")
        .select("is_suspended, suspension_reason")
        .eq("id", userId)
        .single();

      if (profile?.is_suspended && profile.suspension_reason === "payment") {
        await getDb()
          .from("profiles")
          .update({
            is_suspended: false,
            suspension_reason: null,
          })
          .eq("id", userId);
        console.log("[Webhook] Payment recovered — lifted suspension for:", userId);
      }
    }
  }

  // ── Handle payment_intent.succeeded (deposits via BookingModal + balance payments) ──
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const metadata = paymentIntent.metadata || {};
    const leadId = metadata.leadId || metadata.lead_id;
    const paymentType = metadata.type || "final_payment";

    if (leadId) {
      const amountPaidPI = (paymentIntent.amount || 0) / 100;
      console.log("[Webhook] payment_intent.succeeded for lead:", leadId, "| type:", paymentType, "| amount:", amountPaidPI);

      if (metadata.type === "final_payment") {
        // ── BALANCE via chargeBalanceOffSession (saved card auto-charge) ─
        // Mirrors the checkout.session.completed final_payment branch but
        // for off-session PaymentIntents (no Checkout Session involved).
        //
        // NOTE: Match metadata.type EXPLICITLY (not paymentType, which has a
        // default fallback). PaymentIntents born from a Checkout Session
        // don't carry the session's metadata onto the PI itself, so without
        // this strict check we'd fire duplicate receipts when both
        // checkout.session.completed AND payment_intent.succeeded land for
        // the same redirect-Checkout balance payment.
        try {
          const { data: updated, error } = await getDb()
            .from("leads")
            .update({
              status: "paid",
              deposit_paid: true,
              payout_status: "paid",
              paid_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", leadId)
            .in("status", ["payment_pending", "open", "pending_payment"])
            .select("id")
            .maybeSingle();

          if (error) {
            console.error("[Webhook] CRITICAL: Off-session final payment DB update failed!", JSON.stringify(error));
            if (redis) await redis.set(`webhook:evt:${event.id}`, "failed", { ex: 300 }).catch(() => {});
            return NextResponse.json({ error: "DB update failed" }, { status: 500 });
          }

          if (!updated) {
            // Already in terminal state — webhook retry, manual mark-paid, or
            // a duplicate event. Do NOT fire receipt emails again.
            console.log("[Webhook] Off-session final payment: lead already in terminal state, skipping:", leadId);
            return NextResponse.json({ received: true });
          }
          console.log("SUCCESS: Job marked PAID (off-session balance) for lead:", leadId);
        } catch (err) {
          console.error("[Webhook] Off-session final payment update threw:", err);
          if (redis) await redis.set(`webhook:evt:${event.id}`, "failed", { ex: 300 }).catch(() => {});
          return NextResponse.json({ error: "Final payment update exception" }, { status: 500 });
        }

        // Receipt + installer alert — fire-and-forget so Stripe gets 200 fast.
        fireAndForget("offsession_final_payment_emails", async () => {
          const { data: lead } = await getDb()
            .from("leads")
            .select("customer_name, customer_email, estimated_price, deposit_amount, quote_data, installer_id")
            .eq("id", leadId)
            .single();

          const { sendJobReceipt, sendPaymentReceivedAlert, quoteDataToBookingUnits } = await import("@/lib/email");
          let installerName = "Your Installer";
          let installerEmail: string | null = null;

          if (lead?.installer_id) {
            const { data: profile } = await getDb()
              .from("profiles")
              .select("first_name, last_name, business_name")
              .eq("id", lead.installer_id)
              .single();
            if (profile) {
              installerName =
                profile.business_name ||
                [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
                "Your Installer";
            }
            const { data: authUser } = await getDb().auth.admin.getUserById(lead.installer_id);
            installerEmail = authUser?.user?.email || null;
          }

          const unitCount = Array.isArray(lead?.quote_data) ? lead.quote_data.length : 1;
          const customerName = lead?.customer_name ?? "Customer";

          if (lead?.customer_email) {
            const { generateReviewToken } = await import("@/app/actions/reviews");
            const { getAppUrl } = await import("@/lib/url-helper");
            const reviewToken = await generateReviewToken(leadId);
            const reviewUrl = reviewToken ? `${getAppUrl()}/review/${reviewToken}` : undefined;

            await sendJobReceipt(lead.customer_email, {
              customerName,
              installerName,
              totalAmount: lead.estimated_price ?? amountPaidPI,
              depositPaid: lead.deposit_amount ?? 0,
              balanceCollected: amountPaidPI,
              jobDescription: `${unitCount} shelving unit${unitCount !== 1 ? "s" : ""}`,
              units: quoteDataToBookingUnits(lead.quote_data),
              completedDate: new Date().toISOString(),
              reviewUrl,
            });
            console.log("[Webhook] Receipt sent to customer (off-session balance)");
          }

          if (installerEmail) {
            await sendPaymentReceivedAlert(installerEmail, {
              installerName,
              customerName,
              amountReceived: amountPaidPI,
              jobTotal: lead?.estimated_price ?? amountPaidPI,
              leadId,
            });
            console.log("[Webhook] Payment alert sent to installer (off-session balance):", installerEmail);
          }
        });

        return NextResponse.json({ received: true });
      }

      if (paymentType === "booking" || paymentType === "deposit") {
        // ── DEPOSIT via BookingModal (inline Stripe Elements) ──────────
        try {
          // Extract all relevant data from metadata
          const customerEmail = metadata.customer_email || paymentIntent.receipt_email || null;
          const customerName = metadata.customer_name || null;
          const scheduledAt = metadata.scheduled_at || null;

          // NOTE: Do NOT overwrite source here. It's already set correctly when
          // the lead is created (submitNetworkLead) and when deposit is initiated
          // (createDepositIntent). Overwriting with metadata.source can cause issues
          // if metadata is empty/undefined.

          // Fetch estimated_price and discount_amount to recalculate balance_due based on actual deposit
          const { data: leadForBalancePI } = await getDb()
            .from("leads")
            .select("estimated_price, discount_amount")
            .eq("id", leadId)
            .maybeSingle();
          const estimatedPricePI = leadForBalancePI?.estimated_price ?? 0;
          const discountAmtPI = leadForBalancePI?.discount_amount ?? 0;
          const balanceDuePI = roundMoney(estimatedPricePI - amountPaidPI - discountAmtPI);

          const updatePayload: Record<string, unknown> = {
            deposit_paid: true,
            deposit_amount: amountPaidPI,
            balance_due: balanceDuePI,
            payout_status: "deposit_collected",
            status: "open",
            updated_at: new Date().toISOString(),
          };

          // Save Stripe Customer + PaymentMethod so we can off-session
          // charge the remaining balance later (paymentIntents.create
          // with { customer, payment_method, off_session, confirm }).
          if (typeof paymentIntent.customer === "string") {
            updatePayload.stripe_customer_id = paymentIntent.customer;
          }
          if (typeof paymentIntent.payment_method === "string") {
            updatePayload.stripe_payment_method_id = paymentIntent.payment_method;
          }

          // Add customer info if available
          if (customerEmail) {
            updatePayload.customer_email = customerEmail;
          }
          if (customerName) {
            updatePayload.customer_name = customerName;
          }
          if (scheduledAt) {
            updatePayload.scheduled_at = scheduledAt;
          }

          console.log("[Webhook] Deposit update payload:", JSON.stringify(updatePayload));

          // State guard: only update if deposit hasn't already been recorded
          const { data: depositUpdated, error: updateError } = await getDb()
            .from("leads")
            .update(updatePayload)
            .eq("id", leadId)
            .eq("deposit_paid", false)
            .select("id")
            .maybeSingle();

          if (updateError) {
            console.error("[Webhook] CRITICAL: Deposit DB update failed!", JSON.stringify(updateError));
            // Reset key with short TTL so Stripe retry can re-process
            if (redis) await redis.set(`webhook:evt:${event.id}`, "failed", { ex: 300 }).catch(() => {});
          } else if (!depositUpdated) {
            console.log("[Webhook] Deposit already recorded for lead:", leadId, "— skipping duplicate");
          } else {
            console.log("[Webhook] Deposit recorded for lead:", leadId, "| email:", customerEmail);

            // ── Network Referral Bounty (non-blocking) ─────────────────
            waitUntil(processReferralBounty(leadId, paymentIntent.id));

            // ── Realtor Referral Credit (non-blocking, idempotent) ─────
            waitUntil(processRealtorReferralCredit(leadId));

            // ── Save card brand + last4 (non-blocking, best-effort) ────
            // Lets the installer see "Visa •••• 4242" before charging the
            // balance. PaymentIntent only carries the PM id; one extra
            // Stripe call gets the display metadata. Failure here is
            // non-fatal — deposit is already recorded and the saved card
            // still works, just falls back to generic "Card on file" text.
            const pmId = paymentIntent.payment_method;
            if (stripe && typeof pmId === "string") {
              fireAndForget("save_payment_method_meta", async () => {
                try {
                  const pm = await stripe.paymentMethods.retrieve(pmId);
                  if (pm.type === "card" && pm.card) {
                    await getDb()
                      .from("leads")
                      .update({
                        stripe_payment_method_brand: pm.card.brand,
                        stripe_payment_method_last4: pm.card.last4,
                      })
                      .eq("id", leadId);
                  }
                } catch (pmErr) {
                  console.warn("[Webhook] save PM display meta failed:", pmErr);
                }
              });
            }
          }
        } catch (dbErr) {
          console.error("[Webhook] Deposit DB update threw:", dbErr);
        }

        // ── Booking confirmation + installer alert emails ───────────────
        // Sent SYNCHRONOUSLY so Stripe retries the webhook if email fails.
        // DB update is idempotent, so retries are safe.
        // Check booking_email_sent flag to avoid duplicate emails on retry.
        try {
          const { data: lead } = await getDb()
            .from("leads")
            .select("customer_name, customer_email, address, quote_data, estimated_price, installer_id, scheduled_at, booking_email_sent, dimensions")
            .eq("id", leadId)
            .single();

          const piEmail = lead?.customer_email || metadata.customer_email || paymentIntent.receipt_email;
          const piName = lead?.customer_name || metadata.customer_name || "Customer";

          if (piEmail && lead && !lead.booking_email_sent) {
            let installerName = "Your Installer";
            let installerPhone: string | undefined;
            let installerAvatar: string | undefined;
            const instId = lead.installer_id;

            if (instId) {
              const { data: profile } = await getDb()
                .from("profiles")
                .select("first_name, last_name, business_name, phone, avatar_url")
                .eq("id", instId)
                .single();
              if (profile) {
                installerName = profile.business_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Your Installer";
                installerPhone = profile.phone || undefined;
                installerAvatar = profile.avatar_url || undefined;
              }
            }

            const unitCount = Array.isArray(lead.quote_data) ? lead.quote_data.length : 1;
            const piSnapshotUrl = (lead.dimensions as Record<string, unknown> | null)?.build_snapshot_url as string | undefined;

            await sendBookingConfirmation({
              customerName: piName,
              customerEmail: piEmail,
              installerName,
              installerPhone,
              installerAvatarUrl: installerAvatar,
              scheduledDate: lead.scheduled_at ?? metadata.scheduled_at ?? "TBD",
              address: lead.address ?? "Address Pending",
              depositAmount: amountPaidPI,
              totalPrice: lead.estimated_price ?? amountPaidPI,
              jobDescription: `${unitCount} shelving unit${unitCount !== 1 ? "s" : ""}`,
              units: quoteDataToBookingUnits(lead.quote_data),
              leadId,
              buildSnapshotUrl: piSnapshotUrl,
            });
            console.log("[Webhook] Booking confirmation sent (PI flow)");

            // Send installer alert
            if (lead.installer_id) {
              const { data: authUser } = await getDb().auth.admin.getUserById(lead.installer_id);
              const installerEmail = authUser?.user?.email;
              if (installerEmail) {
                const city = lead.address ? lead.address.split(",").slice(-2, -1)[0]?.trim() || lead.address : "Unknown";
                await sendNewBookingAlert(installerEmail, city, {
                  customerName: piName,
                  customerEmail: piEmail || undefined,
                  address: lead.address || undefined,
                  unitCount,
                  totalPrice: lead.estimated_price ?? amountPaidPI,
                  leadId,
                  buildSnapshotUrl: piSnapshotUrl,
                });
                console.log("[Webhook] Installer alert sent (PI flow)");
              }
            }

            // Mark emails as sent so retries don't re-send
            await getDb()
              .from("leads")
              .update({ booking_email_sent: true })
              .eq("id", leadId);
          } else if (lead?.booking_email_sent) {
            console.log("[Webhook] Booking emails already sent for lead:", leadId, "— skipping");
          } else {
            console.warn("[Webhook] No customer email for PI deposit — skipping booking emails. Lead:", leadId);
          }
        } catch (emailErr) {
          console.error("[Webhook] PI booking email failed:", emailErr);
          // Return 500 so Stripe retries — DB update is idempotent, email will get another chance
          if (redis) await redis.set(`webhook:evt:${event.id}`, "failed", { ex: 300 }).catch(() => {});
          return NextResponse.json({ error: "Email sending failed" }, { status: 500 });
        }
      } else {
        // ── FINAL PAYMENT (balance collection) ─────────────────────────
        try {
          // State guard: only update if the job is in a pre-paid state
          const { data: piUpdated, error: piUpdateErr } = await getDb()
            .from("leads")
            .update({
              status: "paid",
              deposit_paid: true,
              payout_status: "paid",
              paid_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", leadId)
            .in("status", ["payment_pending", "open", "pending_payment"])
            .select("id")
            .maybeSingle();

          if (piUpdateErr) {
            console.error("[Webhook] CRITICAL: PI final payment DB update failed!", JSON.stringify(piUpdateErr));
            if (redis) await redis.set(`webhook:evt:${event.id}`, "failed", { ex: 300 }).catch(() => {});
          } else if (!piUpdated) {
            console.log("[Webhook] PI final: lead already in terminal state, skipping:", leadId);
          } else {
            console.log("[Webhook] Lead marked paid (PI final):", leadId);
          }
        } catch (piErr) {
          console.error("[Webhook] payment_intent update failed:", piErr);
          if (redis) await redis.set(`webhook:evt:${event.id}`, "failed", { ex: 300 }).catch(() => {});
        }
      }
    }
  }

  // ── invoice.payment_succeeded → affiliate cut payout (Phase 5) ──────────
  // Triggered every time a recruit's subscription invoice clears. We:
  //   1. Map invoice → recruit profile (via stripe_subscription_id)
  //   2. Look up recruit.referred_by_installer_id → affiliate
  //   3. Find the affiliate's *active* agreement
  //   4. Compute the recurring cut + (first invoice only) the signup bonus
  //   5. Insert affiliate_payouts rows + Stripe-transfer to the affiliate's
  //      Connected Account
  //   6. Idempotency comes from the partial unique indexes on
  //      affiliate_payouts (one recurring row per (agreement, invoice) and
  //      one signup_bonus row per (agreement, recruit)). Re-deliveries from
  //      Stripe safely no-op.
  if (event.type === "invoice.payment_succeeded") {
    try {
      await processAffiliateInvoicePayout(event.data.object as Stripe.Invoice);
    } catch (err) {
      // Affiliate cuts are non-blocking for the rest of the webhook.
      // Stripe gets a 200; the payout is logged with status='failed' so
      // an admin can see and retry manually.
      console.error("[Webhook] affiliate cut processing failed:", err);
    }
  }

  return NextResponse.json({ received: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// Affiliate Cut Payout Processor (Phase 5)
//
// Pulled out of the main webhook handler for readability. All DB and Stripe
// I/O lives here. Pure cut math lives in src/lib/affiliate-cuts.ts.
// ═══════════════════════════════════════════════════════════════════════════

async function processAffiliateInvoicePayout(invoice: Stripe.Invoice) {
  // 0. Skip non-subscription / non-cycle invoices (e.g. proration adjustments).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const billingReason = (invoice as any).billing_reason as string | undefined;
  if (billingReason && !["subscription_create", "subscription_cycle"].includes(billingReason)) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subscriptionId = (invoice as any).subscription as string | null | undefined;
  const invoiceId = invoice.id;
  const amountPaid = invoice.amount_paid; // cents
  if (!subscriptionId || !invoiceId || !amountPaid) return;

  // 1. Find the recruit profile by their stripe_subscription_id.
  const { data: recruit } = await getDb()
    .from("profiles")
    .select("id, referred_by_installer_id, business_name, first_name, last_name")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (!recruit?.referred_by_installer_id) return; // no affiliate to pay
  const recruitId = recruit.id as string;
  const referrerId = recruit.referred_by_installer_id as string;

  // 2. Look up the referrer's active agreement.
  const { data: agreement } = await getDb()
    .from("affiliate_agreements")
    .select("id, agreement_config, end_date, status")
    .eq("affiliate_id", referrerId)
    .eq("status", "active")
    .maybeSingle();
  if (!agreement) return; // referrer terminated / never accepted

  // Honor agreement end_date — no payouts beyond the agreed term.
  if (agreement.end_date && new Date(agreement.end_date as string) < new Date()) {
    console.log("[Affiliate] agreement ended, skipping payout:", agreement.id);
    return;
  }

  // 3. Active recruit count for tiered resolution. Includes the recruit
  //    whose invoice triggered this — they ARE active right now.
  const { count: activeCount } = await getDb()
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("referred_by_installer_id", referrerId)
    .eq("is_pro", true);

  // 4. Has this recruit ever generated a signup_bonus payout under this
  //    agreement? If yes, no second bonus.
  const { data: priorBonus } = await getDb()
    .from("affiliate_payouts")
    .select("id")
    .eq("agreement_id", agreement.id as string)
    .eq("recruit_id", recruitId)
    .eq("kind", "signup_bonus")
    .maybeSingle();
  const isFirstInvoiceForRecruit = !priorBonus;

  // 5. Compute cuts.
  const { computeAffiliateCut } = await import("@/lib/affiliate-cuts");
  const { recurringCents, signupBonusCents, recurringNote } = computeAffiliateCut({
    config: (agreement.agreement_config as Parameters<typeof computeAffiliateCut>[0]["config"]),
    invoiceAmountCents: amountPaid,
    activeRecruitCount: activeCount ?? 1,
    isFirstInvoiceForRecruit,
  });

  // 6. Process each non-zero amount as a separate payout row.
  if (recurringCents > 0) {
    await issueAffiliatePayout({
      agreementId: agreement.id as string,
      affiliateId: referrerId,
      recruitId,
      stripeInvoiceId: invoiceId,
      kind: "recurring",
      amountCents: recurringCents,
      notes: recurringNote,
    });
  }
  if (signupBonusCents > 0) {
    await issueAffiliatePayout({
      agreementId: agreement.id as string,
      affiliateId: referrerId,
      recruitId,
      stripeInvoiceId: invoiceId,
      kind: "signup_bonus",
      amountCents: signupBonusCents,
      notes: "One-time signup bonus on recruit's first paid invoice",
    });
  }
}

interface IssuePayoutInput {
  agreementId: string;
  affiliateId: string;
  recruitId: string;
  stripeInvoiceId: string;
  kind: "recurring" | "signup_bonus";
  amountCents: number;
  notes: string;
}

async function issueAffiliatePayout(input: IssuePayoutInput) {
  // 1. Idempotency check: the partial unique indexes on affiliate_payouts
  //    enforce this at the DB level, but a pre-check avoids attempting a
  //    Stripe transfer when we know we're going to lose the race.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let existing: any = null;
  if (input.kind === "recurring") {
    const r = await getDb()
      .from("affiliate_payouts")
      .select("id, status")
      .eq("agreement_id", input.agreementId)
      .eq("stripe_invoice_id", input.stripeInvoiceId)
      .eq("kind", "recurring")
      .maybeSingle();
    existing = r.data;
  } else {
    const r = await getDb()
      .from("affiliate_payouts")
      .select("id, status")
      .eq("agreement_id", input.agreementId)
      .eq("recruit_id", input.recruitId)
      .eq("kind", "signup_bonus")
      .maybeSingle();
    existing = r.data;
  }
  if (existing && existing.status === "paid") return; // already paid
  // 'pending' or 'failed' → we'll attempt below and update the row.

  // 2. Look up the affiliate's connected Stripe account.
  const { data: affiliate } = await getDb()
    .from("profiles")
    .select("stripe_account_id")
    .eq("id", input.affiliateId)
    .maybeSingle();
  const stripeAccountId = affiliate?.stripe_account_id as string | null;

  // 3. Insert (or fetch) the payout row in 'pending'.
  let payoutId: string;
  if (existing) {
    payoutId = existing.id as string;
    await getDb()
      .from("affiliate_payouts")
      .update({ status: "pending", failure_reason: null, updated_at: new Date().toISOString() })
      .eq("id", payoutId);
  } else {
    const { data: inserted, error: insertErr } = await getDb()
      .from("affiliate_payouts")
      .insert({
        affiliate_id: input.affiliateId,
        agreement_id: input.agreementId,
        recruit_id: input.recruitId,
        kind: input.kind,
        stripe_invoice_id: input.stripeInvoiceId,
        amount_cents: input.amountCents,
        currency: "usd",
        status: "pending",
        notes: input.notes,
      })
      .select("id")
      .single();
    if (insertErr || !inserted) {
      console.error("[Affiliate] payout insert failed:", insertErr);
      return;
    }
    payoutId = inserted.id as string;
  }

  // 4. If no connected account, leave in 'pending' with a clear reason.
  //    The portal can show "Connect Stripe to receive your $X payout".
  if (!stripeAccountId) {
    await getDb()
      .from("affiliate_payouts")
      .update({
        status: "pending",
        failure_reason: "no_connected_account",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payoutId);
    return;
  }

  // 5. Attempt Stripe transfer. transfer_group ties this to the source
  //    invoice for accounting reconciliation later.
  if (!stripe) {
    console.error("[Affiliate] Stripe SDK not configured");
    return;
  }
  try {
    await getDb()
      .from("affiliate_payouts")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", payoutId);

    const transfer = await stripe.transfers.create({
      amount: input.amountCents,
      currency: "usd",
      destination: stripeAccountId,
      transfer_group: input.stripeInvoiceId,
      description: `Affiliate ${input.kind === "signup_bonus" ? "signup bonus" : "cut"} — recruit ${input.recruitId.slice(0, 8)}, invoice ${input.stripeInvoiceId.slice(-8)}`,
    });

    await getDb()
      .from("affiliate_payouts")
      .update({
        status: "paid",
        stripe_transfer_id: transfer.id,
        paid_at: new Date().toISOString(),
        failure_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payoutId);

    console.log(
      `[Affiliate] paid ${input.kind} ${input.amountCents}¢ to ${stripeAccountId} (transfer ${transfer.id})`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Affiliate] transfer failed:", message);
    await getDb()
      .from("affiliate_payouts")
      .update({
        status: "failed",
        failure_reason: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payoutId);
  }
}
