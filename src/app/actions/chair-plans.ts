"use server";

import Stripe from "stripe";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { siteConfig } from "@/config/site";

// ═══════════════════════════════════════════════════════════════════════════
// Chair Plans — Digital Plans + Physical MDF Template
//
// Products:
//   Plans only:        $18  (digital plans, unlocks /dashboard/chair-plans)
//   Plans + Template:  $60  (bundle — saves $30, ships template separately)
//   Template add-on:   $72  (plans must be purchased first)
//
// Purchase flow:
//   1. Installer sees product card on /dashboard/guides
//   2. Checkout → success redirect to /dashboard/chair-plans?session_id=...&type=...
//   3. Plans page calls verify → sets purchased flags on profiles row
//   4. Plans page renders with full content
//
// Admin bypass: checkChairPlanAccess() returns hasAccess:true for is_admin.
// Requires migrations: 124_chair_plan_purchased.sql + 125_chair_template_purchased.sql
// ═══════════════════════════════════════════════════════════════════════════

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

const supabase = getServiceClient();

const CHAIR_PLAN_PRICE_CENTS = 1800;     // $18.00
const CHAIR_TEMPLATE_PRICE_CENTS = 7200; // $72.00
const CHAIR_BUNDLE_PRICE_CENTS = 6000;   // $60.00

// ── Access checks ──────────────────────────────────────────────────────────

export async function checkChairPlanAccess(): Promise<{
  hasAccess: boolean;
  isAdmin: boolean;
  hasTemplate: boolean;
}> {
  const user = await getAuthenticatedUser();
  if (!user) return { hasAccess: false, isAdmin: false, hasTemplate: false };

  // Check is_admin first — always safe, exists from migration 031.
  // Admin bypass must not depend on later migrations.
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  const isAdmin = adminProfile?.is_admin === true;
  if (isAdmin) return { hasAccess: true, isAdmin: true, hasTemplate: true };

  const { data: profile } = await supabase
    .from("profiles")
    .select("chair_plan_purchased, chair_template_purchased")
    .eq("id", user.id)
    .single();

  const hasPlan = profile?.chair_plan_purchased === true;
  const hasTemplate = profile?.chair_template_purchased === true;

  // Bundle purchase sets chair_template_purchased — that also grants plan access
  return { hasAccess: hasPlan || hasTemplate, isAdmin: false, hasTemplate };
}

// ── Stripe checkout sessions ───────────────────────────────────────────────

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
              name: "Low Boy Adirondack Chair — Digital Build Plans",
              description:
                "Complete cut list, point-to-point cut profiles, angle-cut diagrams, and 6-step assembly guide.",
            },
            unit_amount: CHAIR_PLAN_PRICE_CENTS,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/dashboard/chair-plans?session_id={CHECKOUT_SESSION_ID}&type=plans`,
      cancel_url: `${baseUrl}/dashboard/guides`,
      metadata: { type: "chair_plan", user_id: user.id },
    });

    if (!session.url) return { success: false, error: "Failed to create checkout session." };
    return { success: true, url: session.url };
  } catch (err) {
    console.error("[ChairPlans] Stripe session error:", err);
    return { success: false, error: "Failed to create checkout. Please try again." };
  }
}

export async function createChairBundleCheckout(): Promise<{
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
              name: "Low Boy Adirondack Chair — Plans + MDF Template Bundle",
              description:
                '1/2" CNC-cut MDF template set + digital build plans. Plans unlock immediately; template ships separately.',
            },
            unit_amount: CHAIR_BUNDLE_PRICE_CENTS,
          },
          quantity: 1,
        },
      ],
      shipping_address_collection: { allowed_countries: ["US"] },
      success_url: `${baseUrl}/dashboard/chair-plans?session_id={CHECKOUT_SESSION_ID}&type=bundle`,
      cancel_url: `${baseUrl}/dashboard/guides`,
      metadata: { type: "chair_bundle", user_id: user.id },
    });

    if (!session.url) return { success: false, error: "Failed to create checkout session." };
    return { success: true, url: session.url };
  } catch (err) {
    console.error("[ChairPlans] Stripe bundle error:", err);
    return { success: false, error: "Failed to create checkout. Please try again." };
  }
}

export async function createChairTemplateCheckout(): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated." };

  // Plans must be purchased first
  const { hasAccess } = await checkChairPlanAccess();
  if (!hasAccess) {
    return { success: false, error: "Purchase the plans before adding the template." };
  }

  try {
    const baseUrl = siteConfig.baseUrl;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: 'Low Boy Adirondack Chair — 1/2" MDF Template Set',
              description:
                'CNC-cut 1/2" MDF template set. Ships separately.',
            },
            unit_amount: CHAIR_TEMPLATE_PRICE_CENTS,
          },
          quantity: 1,
        },
      ],
      shipping_address_collection: { allowed_countries: ["US"] },
      success_url: `${baseUrl}/dashboard/chair-plans?session_id={CHECKOUT_SESSION_ID}&type=template`,
      cancel_url: `${baseUrl}/dashboard/chair-plans`,
      metadata: { type: "chair_template", user_id: user.id },
    });

    if (!session.url) return { success: false, error: "Failed to create checkout session." };
    return { success: true, url: session.url };
  } catch (err) {
    console.error("[ChairPlans] Stripe template error:", err);
    return { success: false, error: "Failed to create checkout. Please try again." };
  }
}

// ── Purchase verification ──────────────────────────────────────────────────

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
      await supabase.from("profiles").update({ chair_plan_purchased: true }).eq("id", user.id);
      return { success: true, verified: true };
    }
    return { success: true, verified: false };
  } catch {
    return { success: false, verified: false };
  }
}

export async function verifyChairBundlePurchase(
  sessionId: string
): Promise<{ success: boolean; verified: boolean }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, verified: false };

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (
      session.payment_status === "paid" &&
      session.metadata?.type === "chair_bundle" &&
      session.metadata?.user_id === user.id
    ) {
      await supabase
        .from("profiles")
        .update({ chair_plan_purchased: true, chair_template_purchased: true })
        .eq("id", user.id);
      return { success: true, verified: true };
    }
    return { success: true, verified: false };
  } catch {
    return { success: false, verified: false };
  }
}

export async function verifyChairTemplatePurchase(
  sessionId: string
): Promise<{ success: boolean; verified: boolean }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, verified: false };

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (
      session.payment_status === "paid" &&
      session.metadata?.type === "chair_template" &&
      session.metadata?.user_id === user.id
    ) {
      await supabase
        .from("profiles")
        .update({ chair_template_purchased: true })
        .eq("id", user.id);
      return { success: true, verified: true };
    }
    return { success: true, verified: false };
  } catch {
    return { success: false, verified: false };
  }
}
