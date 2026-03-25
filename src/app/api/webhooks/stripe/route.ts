import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { waitUntil } from "@vercel/functions";

export const dynamic = "force-dynamic";
import { sendBookingConfirmation, sendNewBookingAlert, sendProWelcomeEmail } from "@/lib/email";
import {
  activateProSubscription,
  deactivateProSubscription,
} from "@/app/actions/pro-subscription";
import { getServiceClient } from "@/lib/supabase-server";
import { Redis } from "@upstash/redis";

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

        const { sendJobReceipt, sendPaymentReceivedAlert } = await import("@/lib/email");
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
          await sendJobReceipt(lead.customer_email, {
            customerName,
            installerName,
            totalAmount: lead.estimated_price ?? amountPaid,
            depositPaid: lead.deposit_amount ?? 0,
            balanceCollected: amountPaid,
            jobDescription: `${unitCount} shelving unit${unitCount !== 1 ? "s" : ""}`,
            completedDate: new Date().toISOString(),
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
      const updatePayload: Record<string, unknown> = {
        deposit_paid: true,
        deposit_amount: amountPaid,
        payout_status: "deposit_collected",
        status: "open",
        // Address fields — match migration 016 column names
        address_line1: stripeAddress?.line1 ?? "Address Pending",
        address_city: stripeAddress?.city ?? "",
        address_state: stripeAddress?.state ?? "",
        address_zip: stripeAddress?.postal_code ?? "",
        // Also write to migration 012 column names for backward compat
        city: stripeAddress?.city ?? "",
        state: stripeAddress?.state ?? "",
      };

      // Composite address for display
      if (fullAddress) {
        updatePayload.address = fullAddress;
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
        .select("customer_name, customer_email, address, quote_data, estimated_price, installer_id, scheduled_at, booking_email_sent")
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
            leadId,
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

    if (userId && subscription.status === "active") {
      console.log("[Webhook] Pro subscription activated for user:", userId);
      const result = await activateProSubscription(userId, subscription.id);
      if (result.success && result.slug) {
        console.log("[Webhook] Pro activated, slug:", result.slug);

        // Fire-and-forget: Pro welcome email + referral activation
        fireAndForget("pro_welcome", async () => {
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

            await sendProWelcomeEmail(email, { name, slug: result.slug! });
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
          const updatePayload: Record<string, unknown> = {
            deposit_paid: true,
            deposit_amount: amountPaidPI,
            payout_status: "deposit_collected",
            status: "open",
            updated_at: new Date().toISOString(),
          };

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
            .select("customer_name, customer_email, address, quote_data, estimated_price, installer_id, scheduled_at, booking_email_sent")
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
              leadId,
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

  return NextResponse.json({ received: true });
}
