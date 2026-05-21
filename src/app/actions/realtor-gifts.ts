"use server";

import Stripe from "stripe";

import { siteConfig } from "@/config/site";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { normalizePhone } from "@/lib/phone";
import { getAppUrl } from "@/lib/url-helper";
import {
  enforceActionRateLimit,
  RateLimitError,
} from "@/lib/server/action-rate-limit";
import {
  sendGiftRecipientInvite,
  sendGiftMagicCodeEmail,
  sendRealtorGiftReceipt,
  sendGiftCancelledRecipient,
  sendGiftEarlyPickupRequestAlert,
} from "@/lib/email";
import { previewToteGiftDelivery } from "@/app/actions/realtor-tote-delivery";

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

// Lazy Stripe init. /gift/[token]/page.tsx server-renders and transitively
// imports this module, which triggers page-data collection at build time
// (no env vars). Eager `new Stripe(process.env.STRIPE_SECRET_KEY!)` throws
// "Neither apiKey nor config.authenticator provided" there. Mirror the
// getResend() pattern in lib/emails/core.ts instead.
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (_stripe) return _stripe;
  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-12-15.clover",
  });
  return _stripe;
}

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
  /** Optional. Surfaced to the installer as tel:/sms: on the per-job page. */
  recipientPhone?: string;
  propertyAddress?: string;
  propertyZip?: string;
  /** Optional. Where the installer retrieves totes at end of rental.
   *  When unset, pickup happens at propertyAddress (same as delivery). */
  pickupAddress?: string;
  pickupZip?: string;
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
  const recipientPhone = normalizePhone(input.recipientPhone);
  if (!recipientName || !recipientEmail) {
    return { success: false, error: "Recipient name and email are required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return { success: false, error: "Recipient email is not valid." };
  }

  // Coverage gate — we can only sell a Quick-send gift to a ZIP where at
  // least one tote-fulfillment installer covers the area. Otherwise we'd
  // take money for a delivery nobody on the network can execute.
  const propertyZipTrimmed = input.propertyZip?.trim() ?? "";
  if (!/^\d{5}$/.test(propertyZipTrimmed)) {
    return {
      success: false,
      error:
        "A 5-digit property ZIP is required so we can confirm a network " +
        "installer can deliver this gift.",
    };
  }
  const coverage = await previewToteGiftDelivery({ deliveryZip: propertyZipTrimmed });
  if (coverage.tier === "no_coverage") {
    return { success: false, error: coverage.message };
  }

  // Pickup address is optional; default is "same as delivery". When the
  // realtor explicitly supplies a different pickup ZIP, validate that an
  // installer in our network covers that ZIP too. findEligibleInstaller
  // tightens this at assignment time by requiring ONE installer who
  // covers BOTH addresses; this check just protects against the obvious
  // "no network presence at all" case at form-fill time.
  const pickupZipTrimmed = input.pickupZip?.trim() ?? "";
  if (pickupZipTrimmed) {
    if (!/^\d{5}$/.test(pickupZipTrimmed)) {
      return { success: false, error: "Pickup ZIP must be 5 digits." };
    }
    if (pickupZipTrimmed !== propertyZipTrimmed) {
      const pickupCoverage = await previewToteGiftDelivery({ deliveryZip: pickupZipTrimmed });
      if (pickupCoverage.tier === "no_coverage") {
        return {
          success: false,
          error:
            "No installer covers the pickup ZIP yet — we can't retrieve totes from " +
            "that address. Try a different pickup ZIP or uncheck the different-pickup option.",
        };
      }
    }
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
      recipient_phone: recipientPhone,
      property_address: input.propertyAddress?.trim() || null,
      property_zip: input.propertyZip?.trim() || null,
      pickup_address: input.pickupAddress?.trim() || null,
      pickup_zip: pickupZipTrimmed || null,
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

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: profile.realtor_brokerage ? undefined : undefined, // (kept so Stripe collects it on the hosted form)
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Closing Gift — ${productLabel}`,
              description: `Reusable moving totes delivered to ${recipientName} on behalf of ${realtorName}.`,
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
      const session = await getStripe().checkout.sessions.retrieve(stripeSessionId);
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
      .select("first_name, last_name, realtor_brokerage, realtor_photo_url, email")
      .eq("id", updated.realtor_id)
      .single(),
  ]);

  const realtorName =
    [realtor?.first_name, realtor?.last_name].filter(Boolean).join(" ") || "Your realtor";
  const brokerage = realtor?.realtor_brokerage || "";
  const realtorPhotoUrl = (realtor?.realtor_photo_url as string | null) ?? null;
  const packageName = pkg?.name || "Closing Gift";
  const giftUrl = `${getAppUrl()}/gift/${updated.gift_token}`;

  sendGiftRecipientInvite(updated.recipient_email, {
    recipientName: updated.recipient_name,
    realtorName,
    brokerage,
    realtorPhotoUrl,
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
  /** Optional head-shot uploaded via /realtors/dashboard/settings.
   *  Shown on the recipient gift page and in the invite email. */
  realtorPhotoUrl: string | null;
  propertyAddress: string | null;
  propertyZip: string | null;
  deliveryAddress: string | null;
  deliveryWindowStart: string | null;
  deliveryWindowEnd: string | null;
  pickupWindowStart: string | null;
  pickupWindowEnd: string | null;
  installerName: string | null;
  installerBusinessName: string | null;
  installerSlug: string | null;
  delivered: boolean;
  returned: boolean;
  /** Set when the recipient has signaled they're ready for pickup early.
   *  Powers the "we got your signal" confirmation state on /gift/{token}. */
  pickupEarlyRequestedAt: string | null;
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
      personal_message, status, redeemed_at, scheduled_at, delivered_at, returned_at,
      pickup_early_requested_at,
      property_address, property_zip,
      delivery_address, delivery_window_start, delivery_window_end,
      pickup_window_start, pickup_window_end,
      installer_id,
      tote_rental_packages ( name, description, features ),
      realtor:profiles!tote_rental_gifts_realtor_id_fkey (
        first_name, last_name, realtor_brokerage, realtor_photo_url
      ),
      installer:profiles!tote_rental_gifts_installer_id_fkey (
        first_name, last_name, business_name, slug
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
  const realtor = row.realtor as unknown as
    | {
        first_name: string | null;
        last_name: string | null;
        realtor_brokerage: string | null;
        realtor_photo_url: string | null;
      }
    | null;
  const installer = row.installer as unknown as
    | { first_name: string | null; last_name: string | null; business_name: string | null; slug: string | null }
    | null;
  const installerDisplayName =
    installer?.business_name ||
    [installer?.first_name, installer?.last_name].filter(Boolean).join(" ") ||
    null;

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
    realtorPhotoUrl: realtor?.realtor_photo_url ?? null,
    propertyAddress: (row.property_address as string | null) ?? null,
    propertyZip: (row.property_zip as string | null) ?? null,
    deliveryAddress: (row.delivery_address as string | null) ?? null,
    deliveryWindowStart: (row.delivery_window_start as string | null) ?? null,
    deliveryWindowEnd: (row.delivery_window_end as string | null) ?? null,
    pickupWindowStart: (row.pickup_window_start as string | null) ?? null,
    pickupWindowEnd: (row.pickup_window_end as string | null) ?? null,
    installerName: installerDisplayName,
    installerBusinessName: installer?.business_name ?? null,
    installerSlug: installer?.slug ?? null,
    delivered: !!row.delivered_at,
    returned: !!row.returned_at,
    pickupEarlyRequestedAt:
      (row.pickup_early_requested_at as string | null) ?? null,
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

  // Auto-assign an installer the moment scheduling completes. Fire-and-
  // forget — if no installer is available right now, the gift stays in
  // 'scheduled' with installer_id null and the realtor dashboard renders
  // a "Sourcing installer" state. Ops or a later cron pass can retry.
  // Dynamic import so this module doesn't cycle with realtor-gift-fulfillment.
  import("./realtor-gift-fulfillment")
    .then(({ assignFulfillmentInstaller }) => assignFulfillmentInstaller(gift.id as string))
    .catch((err) => console.warn("[Gifts] auto-assignment crashed:", err));

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

// ── Realtor: cancel a gift + refund ─────────────────────────────────────
//
// Policy:
//   pending_payment       → cancel, no refund (no charge yet)
//   paid / redeemed / scheduled (before installer assignment)
//                         → cancel, full Stripe refund on the original charge
//   assigned / delivered / returned
//                         → refuse here. Installer is committed; cancellation
//                           must go through admin out-of-band (so they can
//                           coordinate the installer's expectations / partial
//                           refund policy on the platform's behalf).
//   cancelled             → no-op (idempotent)
//
// Idempotency / safety:
//   - Auth check confirms the caller is the gift's realtor (RLS would also
//     enforce, but we never trust just one layer for destructive paths).
//   - The Stripe refund call uses an idempotency key tied to the gift_id
//     so a retry after a transient failure won't double-refund.
//   - We stamp cancelled_at + the refund ID only AFTER both the Stripe and
//     DB writes succeed. If the Stripe call fails we never touch the row.

const CANCELLABLE_BY_REALTOR = new Set([
  "pending_payment",
  "paid",
  "redeemed",
  "scheduled",
]);

export interface CancelGiftResult {
  ok: boolean;
  error?: string;
  refunded?: boolean;
  refundCents?: number;
}

export async function cancelRealtorGift(
  giftId: string,
  reason?: string
): Promise<CancelGiftResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  // Rate-limit so a misbehaving client can't sweep-cancel.
  try {
    await enforceActionRateLimit({
      action: "realtor-gifts.cancel",
      limit: 20,
      window: "10 m",
      identify: "user",
    });
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }

  const trimmedReason = reason?.trim().slice(0, 500) || null;

  const db = getServiceClient();
  const { data: gift, error: fetchErr } = await db
    .from("tote_rental_gifts")
    .select(
      `id, realtor_id, status, amount_cents, stripe_payment_intent_id,
       recipient_name, recipient_email, cancelled_at,
       profiles!tote_rental_gifts_realtor_id_fkey ( first_name, last_name )`
    )
    .eq("id", giftId)
    .maybeSingle();

  if (fetchErr || !gift) {
    return { ok: false, error: "Gift not found." };
  }
  if (gift.realtor_id !== user.id) {
    return { ok: false, error: "Not your gift to cancel." };
  }

  // Already cancelled — return success idempotently, surface the refund
  // amount that was previously issued if any.
  if (gift.status === "cancelled" && gift.cancelled_at) {
    return { ok: true, refunded: false, refundCents: 0 };
  }

  const status = gift.status as string;
  if (!CANCELLABLE_BY_REALTOR.has(status)) {
    return {
      ok: false,
      error:
        "This gift has already been picked up by an installer and can't be cancelled from here. Email support to coordinate.",
    };
  }

  const amountCents = (gift.amount_cents as number) ?? 0;
  const paymentIntentId = (gift.stripe_payment_intent_id as string | null) ?? null;
  const needsRefund = status !== "pending_payment" && paymentIntentId !== null;

  // Issue Stripe refund first. If it fails, we leave the gift untouched
  // so the user can retry. The idempotency key ties retries to this gift.
  let refundId: string | null = null;
  if (needsRefund) {
    try {
      const refund = await getStripe().refunds.create(
        {
          payment_intent: paymentIntentId!,
          reason: "requested_by_customer",
          metadata: {
            type: "tote_rental_gift_refund",
            gift_id: giftId,
            realtor_id: user.id,
          },
        },
        { idempotencyKey: `tote-rental-gift-${giftId}-refund` }
      );
      refundId = refund.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Cancel] Stripe refund failed for gift ${giftId}:`, msg);
      return { ok: false, error: `Refund failed: ${msg}. The gift is still active — try again or contact support.` };
    }
  }

  // Flip the row. Guarded on status NOT already 'cancelled' so concurrent
  // calls converge on the first writer.
  const now = new Date().toISOString();
  const { error: updateErr } = await db
    .from("tote_rental_gifts")
    .update({
      status: "cancelled",
      cancelled_at: now,
      cancelled_reason: trimmedReason,
      refunded_at: needsRefund ? now : null,
      stripe_refund_id: refundId,
    })
    .eq("id", giftId)
    .neq("status", "cancelled");

  if (updateErr) {
    console.error(`[Cancel] DB update failed for gift ${giftId}:`, updateErr);
    // Money already moved if we issued a refund. Don't pretend the
    // operation succeeded — ops will need to reconcile.
    return {
      ok: false,
      error: needsRefund
        ? `Refund succeeded but the gift state didn't update. Contact support with refund ID ${refundId}.`
        : "Could not cancel. Try again.",
    };
  }

  // Notify the recipient. Fire-and-forget — a Resend hiccup should NOT
  // roll back the cancellation.
  const realtorProfile = gift.profiles as unknown as
    | { first_name: string | null; last_name: string | null }
    | null;
  const realtorName =
    [realtorProfile?.first_name, realtorProfile?.last_name].filter(Boolean).join(" ") ||
    "Your realtor";

  sendGiftCancelledRecipient(gift.recipient_email as string, {
    recipientName: gift.recipient_name as string,
    realtorName,
    refundIssued: needsRefund,
    reason: trimmedReason,
  }).catch((err) => console.warn("[Cancel] recipient email failed:", err));

  return {
    ok: true,
    refunded: needsRefund,
    refundCents: needsRefund ? amountCents : 0,
  };
}

// ── Recipient: signal ready for early pickup ─────────────────────────────
//
// Token-authenticated. The recipient hits this from /gift/{token} when
// they're done with the totes before the scheduled pickup window. We
// stamp pickup_early_requested_at + an optional note onto the gift row
// and fire an alert email to the assigned installer — they can choose
// to swing by sooner or stick with the original window.
//
// Idempotent in spirit: re-calling is allowed (overwrites the timestamp
// + note, doesn't double-email). The gift status is unchanged — pickup
// still goes through the normal markGiftReturned flow.

export interface SignalEarlyPickupResult {
  ok: boolean;
  alreadyRequested?: boolean;
  error?: string;
}

export async function signalEarlyPickup(opts: {
  token: string;
  note?: string;
}): Promise<SignalEarlyPickupResult> {
  if (!opts.token) return { ok: false, error: "Missing gift token." };

  try {
    await enforceActionRateLimit({
      action: "signal-early-pickup",
      limit: 5,
      window: "10 m",
      identify: "ip",
    });
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }

  const db = getServiceClient();

  const note = opts.note?.trim().slice(0, 400) || null;

  // Pull the gift — token is the auth credential here, no session needed.
  // Must be in 'delivered' status: signalling before delivery is a no-op,
  // and after 'returned' there's nothing left to pick up.
  const { data: gift } = await db
    .from("tote_rental_gifts")
    .select(
      `id, status, installer_id, recipient_name, recipient_email, recipient_phone,
       delivery_address, tote_count,
       pickup_window_start, pickup_window_end, pickup_early_requested_at,
       profiles!tote_rental_gifts_installer_id_fkey ( first_name, last_name, business_name, email )`
    )
    .eq("gift_token", opts.token)
    .single();

  if (!gift) return { ok: false, error: "Gift not found." };
  if (gift.status !== "delivered") {
    return {
      ok: false,
      error:
        "Early pickup can only be requested after the totes are delivered " +
        "and before they're picked up.",
    };
  }
  if (!gift.installer_id) {
    // No installer assigned yet — shouldn't happen given status='delivered'
    // requires installer_id, but defend in depth.
    return { ok: false, error: "No installer assigned to this gift yet." };
  }

  const alreadyRequested = !!gift.pickup_early_requested_at;

  const { error: updateErr } = await db
    .from("tote_rental_gifts")
    .update({
      pickup_early_requested_at: new Date().toISOString(),
      pickup_early_note: note,
    })
    .eq("id", gift.id);

  if (updateErr) {
    console.error("[EarlyPickup] update failed:", updateErr);
    return { ok: false, error: "Could not record the signal. Try again." };
  }

  // First-time request fires the installer email. Re-requests don't —
  // spam protection. The installer can always glance at the dashboard
  // for the current state.
  if (!alreadyRequested) {
    const installer = gift.profiles as unknown as
      | {
          first_name: string | null;
          last_name: string | null;
          business_name: string | null;
          email: string;
        }
      | null;
    if (installer?.email) {
      const installerName =
        installer.business_name ||
        [installer.first_name, installer.last_name].filter(Boolean).join(" ") ||
        "Installer";
      sendGiftEarlyPickupRequestAlert(installer.email, {
        installerName,
        recipientName: gift.recipient_name as string,
        recipientEmail: gift.recipient_email as string,
        recipientPhone: (gift.recipient_phone as string | null) ?? null,
        deliveryAddress: (gift.delivery_address as string | null) ?? "",
        toteCount: gift.tote_count as number,
        pickupWindowStart: gift.pickup_window_start as string,
        pickupWindowEnd: gift.pickup_window_end as string,
        note,
        jobDetailUrl: `/dashboard/tote-rentals/${gift.id}`,
      }).catch((err) =>
        console.warn("[EarlyPickup] installer alert email failed:", err)
      );
    }
  }

  return { ok: true, alreadyRequested };
}
