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
  sendGiftMagicCodeEmail,
  sendRealtorGiftReceipt,
} from "@/lib/email";

// ═══════════════════════════════════════════════════════════════════════════
// Realtor Gift Checkout & Redemption — Phase A2
//
// This module owns the full purchase/redemption lifecycle:
//   1. Realtor picks a package + duration + addresses it to a recipient
//   2. createGiftCheckout() inserts a pending_payment row + Stripe Session
//   3. Stripe success → finalizeGiftPurchase() (idempotent) flips the row
//      to paid, generates the gift_token, emails the recipient
//   4. Recipient lands on /gift/[token], requests a 6-digit code, verifies
//   5. Recipient confirms address + windows → status = scheduled
//      (installer assignment lands in PR A3)
//
// finalizeGiftPurchase() is wired into BOTH the Stripe webhook and the
// success-page verifyGiftPurchase() so it works in dev without webhook
// plumbing AND survives the user closing the tab in prod.
// ═══════════════════════════════════════════════════════════════════════════

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

const OTP_TTL_MINUTES = 15;
const OTP_MAX_ATTEMPTS = 5;

// ── Catalog ───────────────────────────────────────────────────────────────

export interface PackagePricingTier {
  duration_days: number;
  price_cents: number;
}

export interface ToteRentalPackage {
  id: string;
  name: string;
  description: string;
  tote_count: number;
  best_for: string | null;
  features: string[];
  pricing_tiers: PackagePricingTier[];
  sort_order: number;
}

export async function listToteRentalPackages(): Promise<ToteRentalPackage[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("tote_rental_packages")
    .select("id, name, description, tote_count, best_for, features, pricing_tiers, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[Gifts] listToteRentalPackages failed:", error);
    return [];
  }
  return (data || []) as ToteRentalPackage[];
}

// ── Realtor: create checkout session ──────────────────────────────────────

export interface CreateGiftCheckoutInput {
  packageId: string;
  durationDays: number;
  recipientName: string;
  recipientEmail: string;
  propertyAddress?: string;
  propertyZip?: string;
  personalMessage?: string;
}

export interface CreateGiftCheckoutResult {
  success: boolean;
  url?: string;
  giftId?: string;
  error?: string;
}

export async function createGiftCheckout(
  input: CreateGiftCheckoutInput
): Promise<CreateGiftCheckoutResult> {
  // Each call provisions a Stripe Session — cap per realtor to prevent
  // accidental hammering or scripted abuse.
  try {
    await enforceActionRateLimit({
      action: "create-gift-checkout",
      limit: 10,
      window: "5 m",
      identify: "user-or-ip",
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const db = getServiceClient();

  // Confirm the caller is actually a realtor — defense in depth (route is
  // already gated, but the action must not trust route auth alone).
  const { data: profile } = await db
    .from("profiles")
    .select("is_realtor, first_name, last_name, realtor_brokerage")
    .eq("id", user.id)
    .single();

  if (!profile?.is_realtor) {
    return { success: false, error: "Only realtors can purchase gift packages." };
  }

  // Basic validation. Stripe will reject malformed price_data anyway, but
  // we want a clean error message before we ever hit the API.
  const recipientName = input.recipientName?.trim();
  const recipientEmail = input.recipientEmail?.trim().toLowerCase();
  if (!recipientName || !recipientEmail) {
    return { success: false, error: "Recipient name and email are required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return { success: false, error: "Recipient email is not valid." };
  }

  // Resolve package + price from the catalog (don't trust client-supplied price).
  const { data: pkg } = await db
    .from("tote_rental_packages")
    .select("id, name, tote_count, pricing_tiers, description")
    .eq("id", input.packageId)
    .eq("active", true)
    .single();

  if (!pkg) {
    return { success: false, error: "Package not found." };
  }

  const tier = (pkg.pricing_tiers as PackagePricingTier[]).find(
    (t) => t.duration_days === input.durationDays
  );
  if (!tier) {
    return { success: false, error: "Selected duration is not available for this package." };
  }

  // Insert the gift row in pending_payment state. We do this BEFORE the
  // Stripe Session so the session metadata can carry the gift_id — that's
  // what finalizeGiftPurchase keys off of.
  const realtorName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Your realtor";

  const { data: gift, error: insertErr } = await db
    .from("tote_rental_gifts")
    .insert({
      realtor_id: user.id,
      package_id: pkg.id,
      duration_days: tier.duration_days,
      tote_count: pkg.tote_count,
      amount_cents: tier.price_cents,
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      property_address: input.propertyAddress?.trim() || null,
      property_zip: input.propertyZip?.trim() || null,
      personal_message: input.personalMessage?.trim() || null,
      status: "pending_payment",
    })
    .select("id")
    .single();

  if (insertErr || !gift) {
    console.error("[Gifts] insert pending gift failed:", insertErr);
    return { success: false, error: "Could not start checkout. Please try again." };
  }

  try {
    const baseUrl = siteConfig.baseUrl;
    const productLabel = `${pkg.name} — ${pkg.tote_count} totes, ${tier.duration_days}-day rental`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: profile.realtor_brokerage ? undefined : undefined, // (kept so Stripe collects it on the hosted form)
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Closing Gift — ${productLabel}`,
              description: `Reusable moving totes delivered to ${recipientName}, co-branded for ${realtorName}.`,
            },
            unit_amount: tier.price_cents,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/realtors/dashboard/gifts/${gift.id}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/realtors/dashboard/gifts/new?cancelled=${gift.id}`,
      metadata: {
        type: "tote_rental_gift",
        gift_id: gift.id,
        realtor_id: user.id,
      },
    });

    if (!session.url) {
      return { success: false, error: "Failed to create checkout session." };
    }

    // Stamp the session id so we can look the gift up either via webhook
    // (by metadata.gift_id) OR by session_id (success page).
    await db
      .from("tote_rental_gifts")
      .update({ stripe_session_id: session.id })
      .eq("id", gift.id);

    return { success: true, url: session.url, giftId: gift.id };
  } catch (err) {
    console.error("[Gifts] Stripe session error:", err);
    return { success: false, error: "Failed to create checkout. Please try again." };
  }
}

// ── Finalize on success (idempotent) ─────────────────────────────────────

/**
 * Idempotent finalize. Called both by the success page (via
 * verifyGiftPurchase) and by the Stripe webhook on checkout.session.completed.
 * Whichever fires first wins; the second is a no-op.
 */
export async function finalizeGiftPurchase(opts: {
  sessionId?: string;
  giftId?: string;
}): Promise<{ ok: boolean; giftId?: string; alreadyFinalized?: boolean; error?: string }> {
  if (!opts.sessionId && !opts.giftId) {
    return { ok: false, error: "Missing sessionId or giftId." };
  }

  const db = getServiceClient();

  // 1. Confirm Stripe says it's paid (only path to find the gift if we have
  //    sessionId is to retrieve the session; the metadata.gift_id is also
  //    on the session).
  let stripeSessionId = opts.sessionId;
  let stripePaymentIntentId: string | null = null;
  let giftId = opts.giftId;

  if (stripeSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
      if (session.payment_status !== "paid") {
        return { ok: false, error: "Payment not completed yet." };
      }
      if (session.metadata?.type !== "tote_rental_gift") {
        return { ok: false, error: "Session is not a tote-rental gift." };
      }
      giftId = giftId || session.metadata.gift_id;
      stripePaymentIntentId =
        typeof session.payment_intent === "string" ? session.payment_intent : null;
    } catch (err) {
      console.error("[Gifts] finalize: stripe retrieve failed:", err);
      return { ok: false, error: "Could not verify payment." };
    }
  }

  if (!giftId) return { ok: false, error: "Gift not found." };

  // 2. Idempotent flip: only the pending_payment → paid transition does work.
  const giftToken = generateGiftToken();

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
    .select(
      "id, gift_token, recipient_name, recipient_email, personal_message, package_id, duration_days, tote_count, amount_cents, realtor_id"
    )
    .maybeSingle();

  if (updateErr) {
    console.error("[Gifts] finalize update failed:", updateErr);
    return { ok: false, error: "Failed to finalize gift." };
  }

  if (!updated) {
    // Already finalized — return the existing token.
    const { data: existing } = await db
      .from("tote_rental_gifts")
      .select("gift_token")
      .eq("id", giftId)
      .single();
    return { ok: true, giftId, alreadyFinalized: true };
  }

  // 3. Fire off the recipient invite + realtor receipt. Fire-and-forget;
  //    finalization must not fail if Resend hiccups.
  const [{ data: pkg }, { data: realtor }] = await Promise.all([
    db.from("tote_rental_packages").select("name").eq("id", updated.package_id).single(),
    db
      .from("profiles")
      .select("first_name, last_name, realtor_brokerage, email")
      .eq("id", updated.realtor_id)
      .single(),
  ]);

  const realtorName =
    [realtor?.first_name, realtor?.last_name].filter(Boolean).join(" ") || "Your realtor";
  const brokerage = realtor?.realtor_brokerage || "";
  const packageName = pkg?.name || "Closing Gift";
  const giftUrl = `${getAppUrl()}/gift/${updated.gift_token}`;

  sendGiftRecipientInvite(updated.recipient_email, {
    recipientName: updated.recipient_name,
    realtorName,
    brokerage,
    packageName,
    toteCount: updated.tote_count,
    durationDays: updated.duration_days,
    personalMessage: updated.personal_message || null,
    giftUrl,
  }).catch((err) => console.warn("[Gifts] invite email failed:", err));

  if (realtor?.email) {
    sendRealtorGiftReceipt(realtor.email, {
      realtorName,
      recipientName: updated.recipient_name,
      packageName,
      toteCount: updated.tote_count,
      durationDays: updated.duration_days,
      amountCents: updated.amount_cents,
      giftUrl,
    }).catch((err) => console.warn("[Gifts] realtor receipt failed:", err));
  }

  return { ok: true, giftId, alreadyFinalized: false };
}

/** Called from the success page after Stripe redirect. */
export async function verifyGiftPurchase(
  sessionId: string
): Promise<{ ok: boolean; giftId?: string; error?: string }> {
  return finalizeGiftPurchase({ sessionId });
}

// ── Realtor: list their gifts ────────────────────────────────────────────

export interface RealtorGiftSummary {
  id: string;
  package_id: string;
  package_name: string;
  recipient_name: string;
  recipient_email: string;
  tote_count: number;
  duration_days: number;
  amount_cents: number;
  status: string;
  gift_token: string | null;
  redeemed_at: string | null;
  scheduled_at: string | null;
  created_at: string;
}

export async function listRealtorGifts(): Promise<RealtorGiftSummary[]> {
  const user = await getAuthenticatedUser();
  if (!user) return [];

  const db = getServiceClient();
  const { data, error } = await db
    .from("tote_rental_gifts")
    .select(
      `
      id, package_id, recipient_name, recipient_email, tote_count, duration_days,
      amount_cents, status, gift_token, redeemed_at, scheduled_at, created_at,
      tote_rental_packages ( name )
    `
    )
    .eq("realtor_id", user.id)
    .neq("status", "pending_payment") // Hide abandoned-checkout rows from the dashboard
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Gifts] listRealtorGifts failed:", error);
    return [];
  }

  return (data || []).map((row): RealtorGiftSummary => ({
    id: row.id as string,
    package_id: row.package_id as string,
    package_name:
      (row.tote_rental_packages as unknown as { name: string } | null)?.name || "Gift Package",
    recipient_name: row.recipient_name as string,
    recipient_email: row.recipient_email as string,
    tote_count: row.tote_count as number,
    duration_days: row.duration_days as number,
    amount_cents: row.amount_cents as number,
    status: row.status as string,
    gift_token: (row.gift_token as string | null) ?? null,
    redeemed_at: (row.redeemed_at as string | null) ?? null,
    scheduled_at: (row.scheduled_at as string | null) ?? null,
    created_at: row.created_at as string,
  }));
}

// ── Recipient: lookup gift by token ──────────────────────────────────────

export interface RecipientGiftView {
  giftId: string;
  recipientName: string;
  recipientEmail: string;
  packageName: string;
  packageDescription: string;
  toteCount: number;
  durationDays: number;
  features: string[];
  personalMessage: string | null;
  status: string;
  redeemed: boolean;
  scheduled: boolean;
  realtorName: string;
  realtorBrokerage: string | null;
  propertyAddress: string | null;
  propertyZip: string | null;
  deliveryAddress: string | null;
  deliveryWindowStart: string | null;
  deliveryWindowEnd: string | null;
  pickupWindowStart: string | null;
  pickupWindowEnd: string | null;
}

/**
 * Public lookup — no auth required, token IS the credential. Returns null
 * if the token is unknown or the gift hasn't been paid for yet (we never
 * want to leak pending_payment rows; they're not real gifts yet).
 */
export async function lookupGiftByToken(
  token: string
): Promise<RecipientGiftView | null> {
  if (!token || token.length < 16) return null;

  const db = getServiceClient();
  const { data: row } = await db
    .from("tote_rental_gifts")
    .select(
      `
      id, recipient_name, recipient_email, tote_count, duration_days,
      personal_message, status, redeemed_at, scheduled_at,
      property_address, property_zip,
      delivery_address, delivery_window_start, delivery_window_end,
      pickup_window_start, pickup_window_end,
      tote_rental_packages ( name, description, features ),
      profiles!tote_rental_gifts_realtor_id_fkey (
        first_name, last_name, realtor_brokerage
      )
    `
    )
    .eq("gift_token", token)
    .single();

  if (!row) return null;
  if (row.status === "pending_payment" || row.status === "cancelled") return null;

  const pkg = row.tote_rental_packages as unknown as
    | { name: string; description: string; features: string[] }
    | null;
  const realtor = row.profiles as unknown as
    | { first_name: string | null; last_name: string | null; realtor_brokerage: string | null }
    | null;

  return {
    giftId: row.id as string,
    recipientName: row.recipient_name as string,
    recipientEmail: row.recipient_email as string,
    packageName: pkg?.name || "Closing Gift",
    packageDescription: pkg?.description || "",
    toteCount: row.tote_count as number,
    durationDays: row.duration_days as number,
    features: Array.isArray(pkg?.features) ? pkg!.features : [],
    personalMessage: (row.personal_message as string | null) ?? null,
    status: row.status as string,
    redeemed: !!row.redeemed_at,
    scheduled: !!row.scheduled_at,
    realtorName:
      [realtor?.first_name, realtor?.last_name].filter(Boolean).join(" ") || "Your realtor",
    realtorBrokerage: realtor?.realtor_brokerage ?? null,
    propertyAddress: (row.property_address as string | null) ?? null,
    propertyZip: (row.property_zip as string | null) ?? null,
    deliveryAddress: (row.delivery_address as string | null) ?? null,
    deliveryWindowStart: (row.delivery_window_start as string | null) ?? null,
    deliveryWindowEnd: (row.delivery_window_end as string | null) ?? null,
    pickupWindowStart: (row.pickup_window_start as string | null) ?? null,
    pickupWindowEnd: (row.pickup_window_end as string | null) ?? null,
  };
}

// ── Recipient: magic-link verification (request + verify) ────────────────

export async function requestGiftMagicCode(
  token: string
): Promise<{ ok: boolean; error?: string }> {
  // Public endpoint — rate-limit by IP. Don't expose whether the token
  // exists or not (would leak gift_token enumeration); always return ok
  // unless the request is malformed.
  try {
    await enforceActionRateLimit({
      action: "gift-magic-code-request",
      limit: 5,
      window: "10 m",
      identify: "ip",
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  if (!token || token.length < 16) return { ok: true };

  const db = getServiceClient();
  const { data: gift } = await db
    .from("tote_rental_gifts")
    .select("id, recipient_email, recipient_name, status")
    .eq("gift_token", token)
    .single();

  if (!gift || gift.status === "pending_payment" || gift.status === "cancelled") {
    // Soft-success — same response shape as a valid token request, so the
    // endpoint doesn't function as an oracle.
    return { ok: true };
  }

  const code = generateNumericOtp();
  const codeHash = await sha256(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();

  await db.from("tote_rental_gift_otps").insert({
    gift_id: gift.id,
    code_hash: codeHash,
    expires_at: expiresAt,
  });

  sendGiftMagicCodeEmail(gift.recipient_email, {
    recipientName: gift.recipient_name,
    code,
    expiresInMinutes: OTP_TTL_MINUTES,
  }).catch((err) => console.warn("[Gifts] magic-code email failed:", err));

  return { ok: true };
}

export async function verifyGiftMagicCode(
  token: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  // Rate-limit verify attempts more aggressively — this is the actual
  // brute-force surface.
  try {
    await enforceActionRateLimit({
      action: "gift-magic-code-verify",
      limit: 10,
      window: "10 m",
      identify: "ip",
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  if (!token || !code) return { ok: false, error: "Code is required." };

  const db = getServiceClient();
  const { data: gift } = await db
    .from("tote_rental_gifts")
    .select("id, status, redeemed_at")
    .eq("gift_token", token)
    .single();

  if (!gift || gift.status === "pending_payment" || gift.status === "cancelled") {
    return { ok: false, error: "Invalid code." };
  }

  // Find the most-recent unconsumed OTP within TTL.
  const { data: otps } = await db
    .from("tote_rental_gift_otps")
    .select("id, code_hash, expires_at, consumed_at, attempts")
    .eq("gift_id", gift.id)
    .is("consumed_at", null)
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  const otp = otps?.[0];
  if (!otp) return { ok: false, error: "Code expired. Request a new one." };

  if ((otp.attempts as number) >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "Too many attempts. Request a new code." };
  }

  const submitted = await sha256(code.trim());
  if (submitted !== otp.code_hash) {
    await db
      .from("tote_rental_gift_otps")
      .update({ attempts: (otp.attempts as number) + 1 })
      .eq("id", otp.id);
    return { ok: false, error: "Invalid code." };
  }

  // Success — mark OTP consumed and flip the gift to redeemed (idempotent).
  await db
    .from("tote_rental_gift_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", otp.id);

  if (!gift.redeemed_at) {
    await db
      .from("tote_rental_gifts")
      .update({
        status: "redeemed",
        redeemed_at: new Date().toISOString(),
      })
      .eq("id", gift.id)
      .eq("status", "paid");
  }

  return { ok: true };
}

// ── Recipient: schedule delivery + pickup ────────────────────────────────

export interface ScheduleGiftInput {
  token: string;
  deliveryAddress: string;
  deliveryZip: string;
  deliveryWindowStart: string;  // ISO timestamp
  deliveryWindowEnd: string;
  pickupWindowStart: string;
  pickupWindowEnd: string;
}

export async function scheduleGiftDelivery(
  input: ScheduleGiftInput
): Promise<{ ok: boolean; error?: string }> {
  if (
    !input.token ||
    !input.deliveryAddress?.trim() ||
    !input.deliveryZip?.trim() ||
    !input.deliveryWindowStart ||
    !input.deliveryWindowEnd ||
    !input.pickupWindowStart ||
    !input.pickupWindowEnd
  ) {
    return { ok: false, error: "All scheduling fields are required." };
  }

  if (!/^\d{5}$/.test(input.deliveryZip.trim())) {
    return { ok: false, error: "Delivery ZIP is invalid." };
  }

  const deliveryStart = new Date(input.deliveryWindowStart);
  const deliveryEnd = new Date(input.deliveryWindowEnd);
  const pickupStart = new Date(input.pickupWindowStart);
  const pickupEnd = new Date(input.pickupWindowEnd);

  if (
    Number.isNaN(deliveryStart.valueOf()) ||
    Number.isNaN(deliveryEnd.valueOf()) ||
    Number.isNaN(pickupStart.valueOf()) ||
    Number.isNaN(pickupEnd.valueOf())
  ) {
    return { ok: false, error: "Window timestamps are invalid." };
  }

  if (deliveryEnd <= deliveryStart) {
    return { ok: false, error: "Delivery end must be after start." };
  }
  if (pickupStart <= deliveryEnd) {
    return { ok: false, error: "Pickup must be after delivery." };
  }
  if (pickupEnd <= pickupStart) {
    return { ok: false, error: "Pickup end must be after start." };
  }

  const db = getServiceClient();

  // Only redeemed gifts can be scheduled. (Status check prevents an
  // unverified visitor with a stolen token from scheduling a delivery.)
  const { data: gift } = await db
    .from("tote_rental_gifts")
    .select("id, status, duration_days")
    .eq("gift_token", input.token)
    .single();

  if (!gift) return { ok: false, error: "Gift not found." };
  if (gift.status !== "redeemed" && gift.status !== "scheduled") {
    return { ok: false, error: "You must verify your email before scheduling." };
  }

  // Enforce that the chosen pickup is consistent with the rental duration
  // (within +/- 2 days). Saves the installer from showing up too early or
  // chasing the customer for an extension.
  const rentalMs = (gift.duration_days as number) * 24 * 60 * 60 * 1000;
  const actualMs = pickupStart.getTime() - deliveryEnd.getTime();
  const tolerance = 2 * 24 * 60 * 60 * 1000;
  if (Math.abs(actualMs - rentalMs) > tolerance) {
    return {
      ok: false,
      error: `Pickup should be roughly ${gift.duration_days} days after delivery.`,
    };
  }

  const { error: updateErr } = await db
    .from("tote_rental_gifts")
    .update({
      status: "scheduled",
      delivery_address: input.deliveryAddress.trim(),
      delivery_zip: input.deliveryZip.trim(),
      delivery_window_start: deliveryStart.toISOString(),
      delivery_window_end: deliveryEnd.toISOString(),
      pickup_window_start: pickupStart.toISOString(),
      pickup_window_end: pickupEnd.toISOString(),
      scheduled_at: new Date().toISOString(),
    })
    .eq("id", gift.id);

  if (updateErr) {
    console.error("[Gifts] schedule update failed:", updateErr);
    return { ok: false, error: "Failed to save schedule. Please try again." };
  }

  return { ok: true };
}

// ── Internal helpers ─────────────────────────────────────────────────────

function generateGiftToken(): string {
  // 32-char hex — matches the review-token pattern used elsewhere.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateNumericOtp(): string {
  // 6 digits, leading zeros preserved.
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const n = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return (n % 1_000_000).toString().padStart(6, "0");
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
