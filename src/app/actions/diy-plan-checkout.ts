"use server";

import Stripe from "stripe";
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
  TOTE_PLAN_TIERS,
  encodeTotePlanConfig,
  isTotePlanTier,
  parseTotePlanConfig,
  totePlanName,
  totePlanSummary,
} from "@/lib/tote-plans";

// ═══════════════════════════════════════════════════════════════════════════
// DIY Plan Checkout — Stripe Checkout Sessions for retail tote plans
//
// Purchase flow:
//   1. Retail customer designs a unit on /design, clicks "DIY Plans"
//   2. /plans/checkout?config=[data] — picks a tier (PDF or Interactive)
//   3. createDIYPlanCheckout() creates a Stripe Checkout Session; the
//      validated config + tier ride in session metadata
//   4. Stripe returns to /plans/build?session_id=… where
//      tote-plan-access.ts verifies payment, records the purchase in
//      public_plan_purchases and emails a permanent access link
//
// Paid Pro subscribers and admins get free access (no Stripe checkout).
// No Stripe Connect — all revenue goes to platform.
// ═══════════════════════════════════════════════════════════════════════════

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
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

export async function createDIYPlanCheckout(
  rawConfig: unknown,
  rawTier: unknown,
): Promise<{ success: boolean; url?: string; error?: string }> {
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

  const config = parseTotePlanConfig(rawConfig);
  if (!config) {
    return { success: false, error: "Plans are available for single units up to 4 wide × 6 tall." };
  }
  if (!isTotePlanTier(rawTier)) {
    return { success: false, error: "Pick a plan option." };
  }
  const tier = TOTE_PLAN_TIERS[rawTier];

  try {
    const baseUrl = siteConfig.baseUrl;

    // Promoter attribution — if the buyer arrived via a /promo/<code> link,
    // stash the promoter id + code in metadata so the webhook can compute
    // and pay their individualized commission on checkout.session.completed.
    const buyer = await getAuthenticatedUser();
    const attribution = await resolvePromoterAttributionForCheckout(buyer?.id ?? null);

    const configParam = encodeTotePlanConfig(config);
    const name = totePlanName(config);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${tier.name} — ${name}`,
              description: `${totePlanSummary(config)}. ${tier.tagline}`,
            },
            unit_amount: tier.price,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/plans/build?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/plans/checkout?config=${configParam}&cancelled=1`,
      metadata: {
        type: "diy_plan",
        plan_id: TOTE_PLAN_ID,
        tier: tier.id,
        config: JSON.stringify(config),
        ...(attribution
          ? { promoter_id: attribution.promoterId, promoter_referral_code: attribution.code }
          : {}),
      },
    });

    if (!session.url) {
      return { success: false, error: "Failed to create checkout session." };
    }

    return { success: true, url: session.url };
  } catch (err) {
    console.error("[DIYPlanCheckout] Stripe session error:", err);
    return {
      success: false,
      error: "Failed to create checkout. Please try again.",
    };
  }
}
