"use server";

import Stripe from "stripe";

import { siteConfig } from "@/config/site";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { getAppUrl } from "@/lib/url-helper";
import {
  enforceActionRateLimit,
  RateLimitError,
} from "@/lib/server/action-rate-limit";
import {
  sendGiftRecipientInvite,
  sendRealtorGiftReceipt,
} from "@/lib/email";

import { normalizePhone } from "@/lib/phone";
import { previewToteGiftDelivery } from "./realtor-tote-delivery";

// ═══════════════════════════════════════════════════════════════════════════
// Realtor inventory-mode gift dispatch
//
// Companion to realtor-gifts.ts (quick-send catalog flow) and
// realtor-tote-inventory.ts (bulk-tote purchase flow). This module is the
// dispatch path: realtor spends balance to send a 10–50 tote gift.
//
// Two sub-paths, gated by the distance preview:
//
//   1. Free delivery (≤50 mi) — dispatch_inventory_tote_gift inserts the
//      gift in status='paid' with a freshly generated gift_token, debits
//      the realtor's balance, and the recipient invite fires immediately.
//      No Stripe round-trip.
//
//   2. Surcharge delivery (51–75 mi) — dispatch inserts the gift in
//      status='pending_payment' with NO gift_token (left NULL), AND
//      debits the realtor's balance. Stripe Checkout collects the $25
//      surcharge; the webhook flips status to 'paid', generates the
//      gift_token, and sends the recipient invite.
//
//      Balance is pre-debited so two concurrent surcharge dispatches can't
//      both pass the balance check. If the Stripe session is abandoned,
//      a cron sweep (FUTURE PR) will sweep stale pending_payment rows
//      older than 1 hour and restore balance.
//
//   3. > 75 mi — refused server-side. The form should show the mailto
//      "Inquire with installer" CTA instead, but we defend in depth.
// ═══════════════════════════════════════════════════════════════════════════

const ALLOWED_DURATIONS = [7, 14] as const;
const MIN_TOTES_PER_GIFT = 10;
const MAX_TOTES_PER_GIFT = 50;

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (_stripe) return _stripe;
  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-12-15.clover",
  });
  return _stripe;
}

// ── Create inventory-mode gift dispatch ───────────────────────────────────

export interface CreateInventoryGiftInput {
  recipientName: string;
  recipientEmail: string;
  /** Optional. Surfaced to the installer as tel:/sms: on the per-job page. */
  recipientPhone?: string;
  deliveryAddress: string;
  deliveryZip: string;
  /** Optional. Where the installer retrieves totes at end of rental.
   *  When unset, pickup happens at deliveryAddress (same as delivery). */
  pickupAddress?: string;
  pickupZip?: string;
  personalMessage?: string;
  toteCount: number;
  durationDays: number;
}

export interface CreateInventoryGiftResult {
  success: boolean;
  /** Set when surcharge > 0 — client redirects to this Stripe URL. */
  checkoutUrl?: string;
  /** Set when surcharge = 0 — gift is live, client navigates here. */
  giftSuccessUrl?: string;
  giftId?: string;
  newBalance?: number;
  error?: string;
}

export async function createInventoryGiftDispatch(
  input: CreateInventoryGiftInput
): Promise<CreateInventoryGiftResult> {
  try {
    await enforceActionRateLimit({
      action: "create-inventory-gift",
      limit: 20,
      window: "5 m",
      identify: "user-or-ip",
    });
  } catch (err) {
    if (err instanceof RateLimitError) return { success: false, error: err.message };
    throw err;
  }

  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "You must be signed in." };

  // ── Input normalisation & validation ────────────────────────────────
  const recipientName = input.recipientName?.trim();
  const recipientEmail = input.recipientEmail?.trim().toLowerCase();
  const recipientPhone = normalizePhone(input.recipientPhone);
  const deliveryAddress = input.deliveryAddress?.trim();
  const deliveryZip = input.deliveryZip?.trim();
  const pickupAddress = input.pickupAddress?.trim() || null;
  const pickupZip = input.pickupZip?.trim() || null;
  const personalMessage = input.personalMessage?.trim() || null;
  const toteCount = Math.floor(input.toteCount);
  const durationDays = Math.floor(input.durationDays);

  if (!recipientName || !recipientEmail || !deliveryAddress || !deliveryZip) {
    return {
      success: false,
      error: "Recipient name, email, delivery address, and ZIP are all required.",
    };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return { success: false, error: "Recipient email is not valid." };
  }
  if (!/^\d{5}$/.test(deliveryZip)) {
    return { success: false, error: "Delivery ZIP must be 5 digits." };
  }
  if (pickupZip && !/^\d{5}$/.test(pickupZip)) {
    return { success: false, error: "Pickup ZIP must be 5 digits." };
  }
  if (toteCount < MIN_TOTES_PER_GIFT || toteCount > MAX_TOTES_PER_GIFT) {
    return {
      success: false,
      error: `Tote count must be between ${MIN_TOTES_PER_GIFT} and ${MAX_TOTES_PER_GIFT}.`,
    };
  }
  if (!ALLOWED_DURATIONS.includes(durationDays as (typeof ALLOWED_DURATIONS)[number])) {
    return { success: false, error: "Rental duration must be 7 or 14 days." };
  }

  const db = getServiceClient();

  // Confirm caller is a realtor (defense in depth — route is gated).
  const { data: profile } = await db
    .from("profiles")
    .select("is_realtor, first_name, last_name, realtor_brokerage, email")
    .eq("id", user.id)
    .single();

  if (!profile?.is_realtor) {
    return { success: false, error: "Only realtors can send gifts." };
  }

  // ── Distance gate ──────────────────────────────────────────────────
  const preview = await previewToteGiftDelivery({ deliveryZip });

  if (preview.tier === "inquire") {
    return {
      success: false,
      error:
        `That address is ${preview.distanceMiles} mi from the nearest installer — ` +
        `outside the automatic delivery range. Use the "Inquire with installer" ` +
        `button to email them directly about a custom quote.`,
    };
  }
  if (preview.tier === "no_coverage") {
    return {
      success: false,
      error:
        "No installer covers that ZIP yet — we can't fulfill a gift to this " +
        "address. Try a different delivery ZIP or contact support.",
    };
  }

  // When a different pickup ZIP is supplied, validate it the same way.
  // findEligibleInstaller enforces "one installer covers both" at routing
  // time; this is the form-fill guard against the obvious uncovered case.
  if (pickupZip && pickupZip !== deliveryZip) {
    const pickupCoverage = await previewToteGiftDelivery({ deliveryZip: pickupZip });
    if (pickupCoverage.tier === "no_coverage") {
      return {
        success: false,
        error:
          "No installer covers the pickup ZIP yet — we can't retrieve totes from " +
          "that address. Try a different pickup ZIP or uncheck the different-pickup option.",
      };
    }
  }

  const surchargeCents = preview.surchargeCents;
  const distanceMiles = preview.distanceMiles ?? 0;

  // ── Atomic dispatch ─────────────────────────────────────────────────
  // Generate a token up-front; the RPC only persists it when surcharge=0
  // (free path). The webhook generates a fresh one on the surcharge path.
  const giftToken = generateGiftToken();

  const { data: dispatchRows, error: dispatchErr } = await db.rpc(
    "dispatch_inventory_tote_gift",
    {
      p_realtor_id: user.id,
      p_recipient_name: recipientName,
      p_recipient_email: recipientEmail,
      p_delivery_address: deliveryAddress,
      p_delivery_zip: deliveryZip,
      p_personal_message: personalMessage,
      p_tote_count: toteCount,
      p_duration_days: durationDays,
      p_surcharge_cents: surchargeCents,
      p_distance_miles: distanceMiles,
      p_gift_token: giftToken,
    }
  );

  if (dispatchErr) {
    console.error("[InventoryGifts] dispatch RPC failed:", dispatchErr);
    // Surface the user-actionable case (insufficient balance) explicitly.
    if (dispatchErr.code === "23514") {
      return {
        success: false,
        error: "You don't have enough totes to send this gift. Buy more from your dashboard.",
      };
    }
    return { success: false, error: "Could not create the gift. Please try again." };
  }

  const dispatch = Array.isArray(dispatchRows) ? dispatchRows[0] : dispatchRows;
  if (!dispatch) {
    return { success: false, error: "Dispatch RPC returned no row." };
  }

  const giftId = dispatch.gift_id as string;
  const status = dispatch.status as string;
  const newBalance = dispatch.new_balance as number;

  // Phone (added in migration 117) and pickup-address overrides (migration
  // 123) aren't part of the dispatch RPC signature, so stamp them on a
  // follow-up UPDATE. If this fails the gift still works — the installer
  // falls back to email and to picking up at the delivery address.
  const patch: Record<string, unknown> = {};
  if (recipientPhone) patch.recipient_phone = recipientPhone;
  if (pickupAddress) patch.pickup_address = pickupAddress;
  if (pickupZip) patch.pickup_zip = pickupZip;
  if (Object.keys(patch).length > 0) {
    await db.from("tote_rental_gifts").update(patch).eq("id", giftId);
  }

  // ── Free path: send invite immediately, done. ────────────────────────
  if (status === "paid") {
    await sendInventoryGiftEmails({
      db,
      giftId,
      giftToken,
      recipientName,
      recipientEmail,
      personalMessage,
      toteCount,
      durationDays,
      surchargeCents: 0,
      realtor: profile,
    }).catch((err) =>
      console.warn("[InventoryGifts] post-dispatch email failed:", err)
    );

    return {
      success: true,
      giftId,
      newBalance,
      giftSuccessUrl: `/realtors/dashboard/gifts/${giftId}/success?inventory=1`,
    };
  }

  // ── Surcharge path: create Stripe session for $25. ──────────────────
  try {
    const baseUrl = siteConfig.baseUrl;
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Extended delivery surcharge — ${distanceMiles} mi`,
              description:
                `One-time $${(surchargeCents / 100).toFixed(0)} surcharge for delivery ` +
                `beyond the included 50 mi radius (${distanceMiles} mi).`,
            },
            unit_amount: surchargeCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/realtors/dashboard/gifts/${giftId}/success?session_id={CHECKOUT_SESSION_ID}&inventory=1`,
      cancel_url: `${baseUrl}/realtors/dashboard/gifts/new?cancelled=${giftId}`,
      metadata: {
        type: "inventory_gift_surcharge",
        gift_id: giftId,
        realtor_id: user.id,
      },
    });

    if (!session.url) {
      return { success: false, error: "Failed to create checkout session." };
    }

    await db
      .from("tote_rental_gifts")
      .update({ stripe_session_id: session.id })
      .eq("id", giftId);

    return {
      success: true,
      giftId,
      newBalance,
      checkoutUrl: session.url,
    };
  } catch (err) {
    console.error("[InventoryGifts] Stripe session error:", err);
    return { success: false, error: "Failed to create checkout. Please try again." };
  }
}

// ── Finalize surcharge payment (idempotent) ────────────────────────────

export interface FinalizeInventoryGiftSurchargeResult {
  ok: boolean;
  giftId?: string;
  alreadyFinalized?: boolean;
  error?: string;
}

/**
 * Idempotent finalize for the surcharge sub-path. Called by both the Stripe
 * webhook (on checkout.session.completed) and the success page after the
 * Stripe redirect.
 *
 * The dispatch RPC already debited balance and inserted the gift in
 * pending_payment. All this does is flip status → paid, stamp gift_token +
 * paid_at + stripe_payment_intent_id, and fire the recipient invite +
 * realtor receipt.
 */
export async function finalizeInventoryGiftSurcharge(opts: {
  sessionId: string;
}): Promise<FinalizeInventoryGiftSurchargeResult> {
  if (!opts.sessionId) return { ok: false, error: "Missing sessionId." };

  const db = getServiceClient();

  let stripePaymentIntentId: string | null = null;
  let giftId: string | undefined;

  try {
    const session = await getStripe().checkout.sessions.retrieve(opts.sessionId);
    if (session.payment_status !== "paid") {
      return { ok: false, error: "Payment not completed yet." };
    }
    if (session.metadata?.type !== "inventory_gift_surcharge") {
      return { ok: false, error: "Session is not an inventory gift surcharge." };
    }
    giftId = session.metadata.gift_id;
    stripePaymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : null;
  } catch (err) {
    console.error("[InventoryGifts] finalize: stripe retrieve failed:", err);
    return { ok: false, error: "Could not verify payment." };
  }

  if (!giftId) return { ok: false, error: "Gift id missing from session metadata." };

  const giftToken = generateGiftToken();

  // Atomic flip: only the pending_payment → paid transition does work.
  const { data: updated, error: updateErr } = await db
    .from("tote_rental_gifts")
    .update({
      status: "paid",
      gift_token: giftToken,
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: stripePaymentIntentId,
    })
    .eq("id", giftId)
    .eq("status", "pending_payment")
    .eq("dispatch_source", "inventory")
    .select(
      "id, gift_token, recipient_name, recipient_email, personal_message, tote_count, duration_days, amount_cents, realtor_id"
    )
    .maybeSingle();

  if (updateErr) {
    console.error("[InventoryGifts] finalize update failed:", updateErr);
    return { ok: false, error: "Failed to finalize gift." };
  }

  if (!updated) {
    // Already finalized — webhook + success-page race resolved.
    return { ok: true, giftId, alreadyFinalized: true };
  }

  // Fire emails. Fire-and-forget; finalize must not fail if Resend hiccups.
  const { data: realtor } = await db
    .from("profiles")
    .select("first_name, last_name, realtor_brokerage, email")
    .eq("id", updated.realtor_id)
    .single();

  await sendInventoryGiftEmails({
    db,
    giftId,
    giftToken: updated.gift_token as string,
    recipientName: updated.recipient_name as string,
    recipientEmail: updated.recipient_email as string,
    personalMessage: (updated.personal_message as string | null) ?? null,
    toteCount: updated.tote_count as number,
    durationDays: updated.duration_days as number,
    surchargeCents: updated.amount_cents as number,
    realtor: realtor ?? null,
  }).catch((err) =>
    console.warn("[InventoryGifts] post-finalize email failed:", err)
  );

  return { ok: true, giftId, alreadyFinalized: false };
}

/** Called from the success page after Stripe redirect. */
export async function verifyInventoryGiftSurcharge(
  sessionId: string
): Promise<FinalizeInventoryGiftSurchargeResult> {
  return finalizeInventoryGiftSurcharge({ sessionId });
}

// ── Internal helpers ─────────────────────────────────────────────────────

async function sendInventoryGiftEmails(args: {
  db: ReturnType<typeof getServiceClient>;
  giftId: string;
  giftToken: string;
  recipientName: string;
  recipientEmail: string;
  personalMessage: string | null;
  toteCount: number;
  durationDays: number;
  surchargeCents: number;
  realtor: {
    first_name?: string | null;
    last_name?: string | null;
    realtor_brokerage?: string | null;
    email?: string | null;
  } | null;
}): Promise<void> {
  const realtorName =
    [args.realtor?.first_name, args.realtor?.last_name].filter(Boolean).join(" ") ||
    "Your realtor";
  const brokerage = args.realtor?.realtor_brokerage || "";
  const giftUrl = `${getAppUrl()}/gift/${args.giftToken}`;

  await sendGiftRecipientInvite(args.recipientEmail, {
    recipientName: args.recipientName,
    realtorName,
    brokerage,
    packageName: `${args.toteCount} totes`,
    toteCount: args.toteCount,
    durationDays: args.durationDays,
    personalMessage: args.personalMessage,
    giftUrl,
  });

  if (args.realtor?.email) {
    await sendRealtorGiftReceipt(args.realtor.email, {
      realtorName,
      recipientName: args.recipientName,
      packageName: `${args.toteCount} totes`,
      toteCount: args.toteCount,
      durationDays: args.durationDays,
      amountCents: args.surchargeCents,
      giftUrl,
    });
  }
}

function generateGiftToken(): string {
  // 32-char hex — mirrors realtor-gifts.ts's helper. Duplicated rather than
  // re-exported because Next.js "use server" rules forbid re-exporting a sync
  // function from a server-action file.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
