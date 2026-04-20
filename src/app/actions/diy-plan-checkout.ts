"use server";

import Stripe from "stripe";
import { siteConfig } from "@/config/site";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// DIY Plan Checkout — Stripe Checkout Session for custom blueprint PDFs
//
// Purchase flow:
//   1. User configures a unit on /design, clicks "Buy DIY Plans ($19)"
//   2. Config is serialized and passed to /plans/checkout?config=[data]
//   3. createDIYPlanCheckout() creates a Stripe Checkout Session
//   4. On success redirect, user lands on /plans/checkout/success with
//      the config re-hydrated so the PDF generator can run client-side
//
// Paid Pro subscribers and admins get free access (no Stripe checkout).
// No Stripe Connect — all revenue goes to platform.
// ═══════════════════════════════════════════════════════════════════════════

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

const DIY_PLAN_PRICE_CENTS = 1900; // $19.00

export interface DIYPlanCheckoutConfig {
  cols: number;
  rows: number;
  toteType: "HDX" | "GM";
  unitType: "standard" | "mini";
  orientation: "standard" | "sideways";
  hasWheels: boolean;
  hasTop: boolean;
  hasTotes: boolean;
  totalW: number;
  totalH: number;
  depth: number;
  /** Installer context — carried through to PDF branding */
  installerId?: string;
  installerSlug?: string | null;
  installerPhone?: string | null;
  installerName?: string;
}

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
  config: DIYPlanCheckoutConfig
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const baseUrl = siteConfig.baseUrl;

    // Serialize config into the success URL so the PDF generator can use it
    const configParam = encodeURIComponent(JSON.stringify(config));
    const desc = `${config.cols}×${config.rows} ${config.unitType === "mini" ? "Mini" : "Standard"} Tote Organizer`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `DIY Blueprint — ${desc}`,
              description: `Complete visual build plan: 3D assembly diagrams, cut list, shopping list, and step-by-step instructions for a ${desc}.`,
            },
            unit_amount: DIY_PLAN_PRICE_CENTS,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/plans/checkout/success?config=${configParam}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/plans/checkout?config=${configParam}&cancelled=1`,
      metadata: {
        type: "diy_plan",
        config: JSON.stringify(config),
        ...(config.installerId ? { installer_id: config.installerId } : {}),
        ...(config.installerSlug ? { installer_slug: config.installerSlug } : {}),
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

/**
 * Verify a completed Stripe checkout session for a DIY plan purchase.
 */
export async function verifyDIYPlanPurchase(
  sessionId: string
): Promise<{ success: boolean; verified: boolean; config?: DIYPlanCheckoutConfig }> {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (
      session.payment_status === "paid" &&
      session.metadata?.type === "diy_plan"
    ) {
      const config = session.metadata.config
        ? (JSON.parse(session.metadata.config) as DIYPlanCheckoutConfig)
        : undefined;

      return { success: true, verified: true, config };
    }

    return { success: true, verified: false };
  } catch {
    return { success: false, verified: false };
  }
}
