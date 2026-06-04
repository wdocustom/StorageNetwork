"use server";

import Stripe from "stripe";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { siteConfig } from "@/config/site";

// ═══════════════════════════════════════════════════════════════════════════
// Chair Plans — $12 Digital Download for Low Boy Adirondack Chair
//
// Purchase flow:
//   1. Installer clicks "Get the Plans" on /guides
//   2. createChairPlanCheckout() creates a Stripe Checkout Session ($12)
//   3. On success redirect, verifyChairPlanPurchase() confirms payment
//   4. Purchase state persisted in profiles.chair_plan_purchased (durable)
//
// Admin/owner bypass: checkChairPlanAccess() returns true for is_admin users
// so the owner can preview plans without purchasing.
//
// No Stripe Connect — all revenue goes to platform.
// Requires migration: 124_chair_plan_purchased.sql
// ═══════════════════════════════════════════════════════════════════════════

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

const supabase = getServiceClient();

const CHAIR_PLAN_PRICE_CENTS = 1200; // $12.00

export async function checkChairPlanAccess(): Promise<{
  hasAccess: boolean;
  isAdmin: boolean;
}> {
  const user = await getAuthenticatedUser();
  if (!user) return { hasAccess: false, isAdmin: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("chair_plan_purchased, is_admin")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.is_admin === true;
  const purchased = profile?.chair_plan_purchased === true;

  return { hasAccess: purchased || isAdmin, isAdmin };
}

export async function createChairPlanCheckout(): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated." };

  try {
    const baseUrl = siteConfig.baseUrl;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Low Boy Adirondack Chair — Build Plans",
              description:
                "Complete cut list, angle-cut diagrams, assembly guide, and step-by-step build instructions for the Low Boy Modern Adirondack Chair.",
            },
            unit_amount: CHAIR_PLAN_PRICE_CENTS,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/dashboard/guides?chair=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard/guides?chair=cancelled`,
      metadata: {
        type: "chair_plan",
        user_id: user.id,
      },
    });

    if (!session.url) {
      return { success: false, error: "Failed to create checkout session." };
    }

    return { success: true, url: session.url };
  } catch (err) {
    console.error("[ChairPlans] Stripe session error:", err);
    return { success: false, error: "Failed to create checkout. Please try again." };
  }
}

export async function verifyChairPlanPurchase(
  sessionId: string
): Promise<{ success: boolean; verified: boolean }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, verified: false };

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (
      session.payment_status === "paid" &&
      session.metadata?.type === "chair_plan" &&
      session.metadata?.user_id === user.id
    ) {
      await supabase
        .from("profiles")
        .update({ chair_plan_purchased: true })
        .eq("id", user.id);

      return { success: true, verified: true };
    }

    return { success: true, verified: false };
  } catch {
    return { success: false, verified: false };
  }
}
