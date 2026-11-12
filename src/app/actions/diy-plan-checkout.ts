"use server";

import Stripe from "stripe";
import { stripeConfig } from "@/lib/stripe/http";
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
  TOTE_PLAN_TIERS,
  encodeTotePlanDesign,
  formatPlanPrice,
  isTotePlanTier,
  parseTotePlanDesign,
  totePlanName,
  totePlanSummary,
} from "@/lib/tote-plans";
import { PLAN_REF_COOKIE, cleanReferralId } from "@/lib/plan-splits";

// ═══════════════════════════════════════════════════════════════════════════
// DIY Plan Checkout — Stripe Checkout Sessions for retail tote plans
//
// Purchase flow:
//   1. A customer sizes a design on /plans/checkout — directly, or handed
//      over from any installer's designer, quote page or quote email
//   2. They pick a tier (PDF or Interactive)
//   3. createDIYPlanCheckout() creates a Stripe Checkout Session; the
//      validated design (compact form) + tier ride in session metadata
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

export async function createDIYPlanCheckout(
  rawDesign: unknown,
  rawTier: unknown,
  source?: string,
  rawRef?: unknown,
  /** Anonymous analytics id (localStorage sn_vid) — counts buy clicks per person. */
  rawVisitorId?: unknown,
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
  if (!isTotePlanTier(rawTier)) {
    return { success: false, error: "Pick a plan option." };
  }
  const tier = TOTE_PLAN_TIERS[rawTier];
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
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${tier.name} — ${name}`,
              description: `${totePlanSummary(design)}. ${tier.tagline}${
                tier.listPrice > tier.price
                  ? ` Sale: ${formatPlanPrice(tier.listPrice - tier.price)} off (regularly ${formatPlanPrice(tier.listPrice)}).`
                  : ""
              }`,
            },
            unit_amount: tier.price,
          },
          quantity: 1,
        },
      ],
      return_url: `${baseUrl}/plans/build?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        type: "diy_plan",
        plan_id: TOTE_PLAN_ID,
        tier: tier.id,
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
      tier: tier.id,
      amountCents: tier.price,
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
