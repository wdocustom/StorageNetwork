"use server";

import Stripe from "stripe";
import { getAuthenticatedUser } from "@/lib/auth";
import { siteConfig } from "@/config/site";

// ═══════════════════════════════════════════════════════════════════════════
// Jig Plans — $9 Digital Download for Ladder Building Jig
//
// Simple one-time purchase flow:
//   1. Installer clicks "Get the Plans" on /guides
//   2. createJigPlanCheckout() creates a Stripe Checkout Session ($9)
//   3. On success redirect, verifyJigPlanPurchase() confirms payment
//   4. Purchase state stored in localStorage on the client
//
// No Stripe Connect — all revenue goes to platform.
// ═══════════════════════════════════════════════════════════════════════════

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

const JIG_PLAN_PRICE_CENTS = 900; // $9.00

export async function createJigPlanCheckout(): Promise<{
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
              name: "Ladder Building Jig — Cut Plans & Build Sheet",
              description:
                "Complete cut plan, materials list, and step-by-step build instructions for the ladder assembly jig.",
            },
            unit_amount: JIG_PLAN_PRICE_CENTS,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/dashboard/guides?jig=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard/guides?jig=cancelled`,
      metadata: {
        type: "jig_plan",
        user_id: user.id,
      },
    });

    if (!session.url) {
      return { success: false, error: "Failed to create checkout session." };
    }

    return { success: true, url: session.url };
  } catch (err) {
    console.error("[JigPlans] Stripe session error:", err);
    return { success: false, error: "Failed to create checkout. Please try again." };
  }
}

export async function verifyJigPlanPurchase(
  sessionId: string
): Promise<{ success: boolean; verified: boolean }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, verified: false };

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (
      session.payment_status === "paid" &&
      session.metadata?.type === "jig_plan" &&
      session.metadata?.user_id === user.id
    ) {
      return { success: true, verified: true };
    }

    return { success: true, verified: false };
  } catch {
    return { success: false, verified: false };
  }
}
