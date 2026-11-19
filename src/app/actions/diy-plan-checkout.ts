"use server";

import Stripe from "stripe";
import { stripeConfig } from "@/lib/stripe/http";
import { LADDER_JIG_NAME } from "@/lib/ladder-jig";
import { FINAL_SALE_TEXT, createEmbeddedCheckoutSession } from "@/lib/stripe/embedded-checkout";
import { cookies } from "next/headers";
import { siteConfig } from "@/config/site";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { resolvePromoterAttributionForCheckout } from "@/app/actions/promoter-program";
import {
  enforceActionRateLimit,
  RateLimitError,
} from "@/lib/server/action-rate-limit";
import {
  TOTE_PLAN_ID,
  TOTE_PLAN_LIMITS,
  TOTE_PLAN_ALL_ACCESS,
  TOTE_PLAN_ALL_ACCESS_TIER,
  encodeTotePlanDesign,
  parseTotePlanDesign,
  totePlanName,
  totePlanSummary,
  TOTE_PLAN_FRIDAY,
  formatPlanPrice,
  isRetentionOffer,
  offerIncludesLadderJig,
  normalizePromoCode,
  totePlanOfferPrice,
  TOTE_PLAN_MINI,
  isMiniDesign,
} from "@/lib/tote-plans";
import { PLAN_REF_COOKIE, cleanReferralId } from "@/lib/plan-splits";

// ═══════════════════════════════════════════════════════════════════════════
// DIY Plan Checkout — Stripe Checkout Sessions for retail tote plans
//
// Purchase flow:
//   1. A customer sizes a design on /plans/checkout — directly, or handed
//      over from any installer's designer, quote page or quote email
//   2. They buy All-Access ($19, lifetime): this plan and every tote
//      organizer they design next, 3D guide + PDF (see tote-plans.ts)
//   3. createDIYPlanCheckout() creates a Stripe Checkout Session; the
//      validated design (compact form) rides in session metadata
//   4. Stripe returns to /plans/build?session_id=… where
//      tote-plan-access.ts verifies payment, records the purchase in
//      public_plan_purchases and emails a permanent access link
//
// Paid Pro subscribers and admins get free access (no Stripe checkout).
// Revenue goes to the platform; up to $5 of each sale is then transferred
// to installers by the webhook (referral or bestseller owners — see
// src/lib/plan-splits.ts). The referring installer rides in metadata.
// ═══════════════════════════════════════════════════════════════════════════

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  ...stripeConfig(),
  apiVersion: "2025-12-15.clover",
});

/**
 * Check if the current user has free DIY plan access.
 * Paid Pro subscribers (with stripe_subscription_id, NOT trial-only) and
 * admins can download blueprints without paying.
 */
export async function checkDIYPlanAccess(): Promise<{
  hasFreeAccess: boolean;
  reason?: "pro" | "admin";
}> {
  const user = await getAuthenticatedUser();
  if (!user) return { hasFreeAccess: false };

  const db = getServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("is_pro, stripe_subscription_id, pro_trial_ends_at, is_admin")
    .eq("id", user.id)
    .single();

  if (!profile) return { hasFreeAccess: false };

  // Admin always gets free access
  if (profile.is_admin) {
    return { hasFreeAccess: true, reason: "admin" };
  }

  // Paid Pro subscriber (has stripe_subscription_id — excludes trial-only users)
  if (profile.is_pro && profile.stripe_subscription_id && !profile.pro_trial_ends_at) {
    return { hasFreeAccess: true, reason: "pro" };
  }

  return { hasFreeAccess: false };
}

/**
 * The installer who referred this customer: the hand-off link's ?ref, else
 * the cookie /plans/checkout set on an earlier visit (no expiry). Only a
 * real installer profile counts.
 */
async function resolvePlanReferral(rawRef: unknown): Promise<string | null> {
  const jar = await cookies();
  const id = cleanReferralId(rawRef) ?? cleanReferralId(jar.get(PLAN_REF_COOKIE)?.value);
  if (!id) return null;
  const { data } = await getServiceClient()
    .from("profiles")
    .select("id, is_realtor")
    .eq("id", id)
    .maybeSingle();
  return data && data.is_realtor !== true ? data.id : null;
}

// ── Promo codes (FRIDAY) ────────────────────────────────────────────────────

const FINAL_SALE_MESSAGE =
  FINAL_SALE_TEXT.submit && typeof FINAL_SALE_TEXT.submit === "object" ? FINAL_SALE_TEXT.submit.message : "";

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

export type PlanPromoResult =
  | { ok: true; code: string; display: string; label: string; price: number; email: string }
  | { ok: false; error: string; field: "code" | "email" };

/** Has this email already bought with FRIDAY? (Paid purchases only.) */
async function fridayUsedBy(email: string): Promise<boolean> {
  const { data, error } = await getServiceClient()
    .from("public_plan_purchases")
    .select("access_token")
    .eq("email", email)
    .eq("offer_code", TOTE_PLAN_FRIDAY.code)
    .limit(TOTE_PLAN_FRIDAY.perEmail);
  if (error) throw new Error(`friday lookup failed: ${error.message}`);
  return (data?.length ?? 0) >= TOTE_PLAN_FRIDAY.perEmail;
}

/** Check a promo code + the buyer's email; nothing is reserved until they pay. */
async function validatePromo(rawCode: unknown, rawEmail: unknown): Promise<PlanPromoResult> {
  const code = normalizePromoCode(rawCode);
  if (!code) return { ok: false, error: "Enter a code.", field: "code" };
  if (code !== TOTE_PLAN_FRIDAY.code) return { ok: false, error: "That code isn't valid.", field: "code" };
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter the email you'll get your plans at.", field: "email" };
  }
  if (await fridayUsedBy(email)) {
    return { ok: false, error: `${TOTE_PLAN_FRIDAY.display} has already been used with this email (limit ${TOTE_PLAN_FRIDAY.perEmail}).`, field: "code" };
  }
  return {
    ok: true,
    code: TOTE_PLAN_FRIDAY.code,
    display: TOTE_PLAN_FRIDAY.display,
    label: TOTE_PLAN_FRIDAY.label,
    price: TOTE_PLAN_FRIDAY.price,
    email,
  };
}

/** The designer's "Have a code?" field. */
export async function checkPlanPromo(rawCode: unknown, rawEmail: unknown): Promise<PlanPromoResult> {
  try {
    await enforceActionRateLimit({ action: "plan-promo-check", limit: 20, window: "10 m", identify: "ip" });
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message, field: "code" };
    throw err;
  }
  try {
    return await validatePromo(rawCode, rawEmail);
  } catch (err) {
    console.error("[DIYPlanCheckout] promo check failed:", err);
    return { ok: false, error: "We couldn't check that code. Please try again.", field: "code" };
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Does this plan link's email own the 27-gal All-Access plans? That earns
 * the Mini Tote Rack Plans owner price. Decided from the database, never
 * from anything the client claims; any of their plan links works.
 */
async function bigRackOwnerFor(rawToken: unknown): Promise<{ email: string } | null> {
  if (typeof rawToken !== "string" || !UUID_RE.test(rawToken)) return null;
  const db = getServiceClient();
  const { data: link } = await db.from("public_plan_purchases").select("email").eq("access_token", rawToken).maybeSingle();
  const email = (link as { email: string } | null)?.email;
  if (!email) return null;
  const { data } = await db.from("public_plan_purchases").select("access_token").eq("email", email).eq("plan_id", TOTE_PLAN_ID).limit(1);
  return (data as unknown[] | null)?.length ? { email } : null;
}

/** What Mini Tote Rack Plans cost this visitor: $12, or $9 with a 27-gal All-Access plan link. */
export async function getMiniPlanPrice(rawToken: unknown): Promise<{ price: number; regularPrice: number; ownerDiscount: boolean }> {
  const regular = { price: TOTE_PLAN_MINI.price, regularPrice: TOTE_PLAN_MINI.price, ownerDiscount: false };
  try {
    return (await bigRackOwnerFor(rawToken)) ? { ...regular, price: TOTE_PLAN_MINI.ownerPrice, ownerDiscount: true } : regular;
  } catch (err) {
    console.error("[DIYPlanCheckout] mini price lookup failed:", err);
    return regular;
  }
}

export async function createDIYPlanCheckout(
  rawDesign: unknown,
  source?: string,
  rawRef?: unknown,
  /** Anonymous analytics id (localStorage sn_vid) — counts buy clicks per person. */
  rawVisitorId?: unknown,
  /**
   * One offer per checkout, priced server-side: a retention offer code
   * (save3, or a legacy save5 link) OR the FRIDAY promo code. Never both.
   */
  rawOffer?: unknown,
  /** FRIDAY only: the email the code was checked against (locked at Stripe) */
  rawPromoEmail?: unknown,
  /** Mini designs: a plan link, for the 27-gal owner price (verified here) */
  rawOwnerToken?: unknown,
): Promise<{ success: boolean; clientSecret?: string; error?: string }> {
  // SECURITY (H-3): each call provisions a Stripe Checkout Session. Cap
  // per identity to prevent scripted abuse of Stripe's session API.
  try {
    await enforceActionRateLimit({
      action: "diy-plan-checkout",
      limit: 10,
      window: "60 s",
      identify: "user-or-ip",
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  const design = parseTotePlanDesign(rawDesign);
  if (!design) {
    return {
      success: false,
      error: `Plans cover up to ${TOTE_PLAN_LIMITS.maxUnits} standard tote units, each up to ${TOTE_PLAN_LIMITS.maxCols} wide × ${TOTE_PLAN_LIMITS.maxRows} tall.`,
    };
  }
  if (isMiniDesign(design)) return createMiniPlanCheckout(design, source, rawRef, rawVisitorId, rawOwnerToken);
  const product = TOTE_PLAN_ALL_ACCESS;
  // Exactly one offer: the promo code if they entered one, else a retention
  // offer, else the regular price.
  let offer: string | null = null;
  let price = totePlanOfferPrice(null);
  let lockedEmail: string | null = null;
  if (normalizePromoCode(rawOffer) === TOTE_PLAN_FRIDAY.code) {
    const promo = await validatePromo(rawOffer, rawPromoEmail).catch((err) => {
      console.error("[DIYPlanCheckout] promo check failed:", err);
      return { ok: false as const, error: "We couldn't check that code. Please try again.", field: "code" as const };
    });
    if (!promo.ok) return { success: false, error: promo.error };
    offer = promo.code;
    price = promo.price;
    lockedEmail = promo.email;
  } else if (isRetentionOffer(rawOffer)) {
    offer = rawOffer;
    price = totePlanOfferPrice(rawOffer);
  }
  const sourceTag = typeof source === "string" ? source.replace(/[^a-z0-9_-]/gi, "").slice(0, 40) : "";

  try {
    const baseUrl = siteConfig.baseUrl;

    // Promoter attribution — if the buyer arrived via a /promo/<code> link,
    // stash the promoter id + code in metadata so the webhook can compute
    // and pay their individualized commission on checkout.session.completed.
    const buyer = await getAuthenticatedUser();
    const attribution = await resolvePromoterAttributionForCheckout(buyer?.id ?? null);
    const referralInstallerId = await resolvePlanReferral(rawRef);

    const name = totePlanName(design);

    // Embedded Checkout: the payment form renders inside our own page
    // (/plans/checkout) instead of sending the buyer to checkout.stripe.com.
    // Same session, metadata and webhook as before; when payment completes,
    // Stripe redirects the page to return_url.
    const session = await createEmbeddedCheckoutSession(stripe, {
      mode: "payment",
      // FRIDAY is once per email: the email it was checked for is the one
      // they pay with (Checkout shows a prefilled email read-only).
      ...(lockedEmail ? { customer_email: lockedEmail } : {}),
      custom_text: lockedEmail
        ? {
            ...FINAL_SALE_TEXT,
            submit: {
              message: `${TOTE_PLAN_FRIDAY.label}: code ${TOTE_PLAN_FRIDAY.display} applied, ${formatPlanPrice(price)} instead of ${formatPlanPrice(totePlanOfferPrice(null))}. ${FINAL_SALE_MESSAGE}`.slice(0, 1200),
            },
          }
        : FINAL_SALE_TEXT,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${product.name} — starting with your ${name}`,
              description: `Lifetime access: this plan (${totePlanSummary(design)}) and a free plan for every tote organizer you design after it. Interactive 3D guide + printable PDF for each.${
                offerIncludesLadderJig(offer) ? ` Includes the ${LADDER_JIG_NAME} plans free.` : ""
              }`,
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      return_url: `${baseUrl}/plans/build?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        type: "diy_plan",
        plan_id: TOTE_PLAN_ID,
        tier: TOTE_PLAN_ALL_ACCESS_TIER,
        product: "all_access",
        ...(offer ? { offer } : {}),
        design: encodeTotePlanDesign(design),
        ...(design.name ? { design_name: design.name } : {}),
        ...(sourceTag ? { source: sourceTag } : {}),
        ...(referralInstallerId ? { referral_installer_id: referralInstallerId } : {}),
        ...(attribution
          ? { promoter_id: attribution.promoterId, promoter_referral_code: attribution.code }
          : {}),
      },
    });

    if (!session.client_secret) {
      return { success: false, error: "Failed to create checkout session." };
    }

    // Funnel: this buyer clicked Buy and is being sent to Stripe. A session
    // that never becomes a purchase = left at the payment page. Never block
    // the redirect on analytics.
    await recordCheckoutStart({
      stripeSessionId: session.id,
      planId: TOTE_PLAN_ID,
      tier: TOTE_PLAN_ALL_ACCESS_TIER,
      amountCents: price,
      visitorId: rawVisitorId,
    });

    return { success: true, clientSecret: session.client_secret };
  } catch (err) {
    console.error("[DIYPlanCheckout] Stripe session error:", err);
    return {
      success: false,
      error: "Failed to create checkout. Please try again.",
    };
  }
}

/**
 * Mini Tote Rack Plans: $12 (or $9 for 27-gal All-Access owners), lifetime,
 * every mini design. No retention offers or promo codes — they're priced for
 * All-Access — and no installer plan splits.
 */
async function createMiniPlanCheckout(
  design: NonNullable<ReturnType<typeof parseTotePlanDesign>>,
  source: unknown,
  rawRef: unknown,
  rawVisitorId: unknown,
  rawOwnerToken: unknown,
): Promise<{ success: boolean; clientSecret?: string; error?: string }> {
  const owner = await bigRackOwnerFor(rawOwnerToken).catch(() => null);
  const price = owner ? TOTE_PLAN_MINI.ownerPrice : TOTE_PLAN_MINI.price;
  const sourceTag = typeof source === "string" ? source.replace(/[^a-z0-9_-]/gi, "").slice(0, 40) : "";
  try {
    const baseUrl = siteConfig.baseUrl;
    const buyer = await getAuthenticatedUser();
    const attribution = await resolvePromoterAttributionForCheckout(buyer?.id ?? null);
    const name = totePlanName(design);
    const session = await createEmbeddedCheckoutSession(stripe, {
      mode: "payment",
      // Owner price: pay with the email that owns the 27-gal plans
      ...(owner ? { customer_email: owner.email } : {}),
      custom_text: FINAL_SALE_TEXT,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${TOTE_PLAN_MINI.name} — starting with your ${name}`,
              description: `Lifetime access: this plan (${totePlanSummary(design)}) and a free plan for every mini tote rack you design after it. Interactive 3D guide + printable PDF for each.${owner ? " Owner price for All-Access plan owners." : ""}`,
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      return_url: `${baseUrl}/plans/build?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        type: "mini_plan",
        plan_id: TOTE_PLAN_MINI.id,
        tier: TOTE_PLAN_ALL_ACCESS_TIER,
        product: "mini",
        ...(owner ? { offer: "owner" } : {}),
        design: encodeTotePlanDesign(design),
        ...(design.name ? { design_name: design.name } : {}),
        ...(sourceTag ? { source: sourceTag } : {}),
        ...(attribution ? { promoter_id: attribution.promoterId, promoter_referral_code: attribution.code } : {}),
      },
    });
    if (!session.client_secret) return { success: false, error: "Failed to create checkout session." };
    void rawRef; // installer referrals earn plan splits on All-Access only
    await recordCheckoutStart({
      stripeSessionId: session.id,
      planId: TOTE_PLAN_MINI.id,
      tier: TOTE_PLAN_ALL_ACCESS_TIER,
      amountCents: price,
      visitorId: rawVisitorId,
    });
    return { success: true, clientSecret: session.client_secret };
  } catch (err) {
    console.error("[DIYPlanCheckout] mini Stripe session error:", err);
    return { success: false, error: "Failed to create checkout. Please try again." };
  }
}

/** Log a Stripe Checkout Session for the plans funnel (best-effort). */
async function recordCheckoutStart(row: {
  stripeSessionId: string;
  planId: string;
  tier: string | null;
  amountCents: number;
  visitorId: unknown;
}): Promise<void> {
  try {
    const visitorId =
      typeof row.visitorId === "string" && /^[\w-]{1,64}$/.test(row.visitorId) ? row.visitorId : null;
    const { error } = await getServiceClient().from("plan_checkout_starts").insert({
      stripe_session_id: row.stripeSessionId,
      plan_id: row.planId,
      tier: row.tier,
      amount_cents: row.amountCents,
      visitor_id: visitorId,
    });
    if (error) console.error("[DIYPlanCheckout] checkout-start log failed:", error.message);
  } catch (err) {
    console.error("[DIYPlanCheckout] checkout-start log failed:", err);
  }
}
