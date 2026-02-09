"use server";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ═══════════════════════════════════════════════════════════════════════════
// Checkout — Financial logic for Platform vs Partner Link deposits
//
// FEE STRUCTURE:
// ─────────────────────────────────────────────────────────────────────────
// Platform Lead:            15% deposit → 100% to Platform
// Partner Link + Non-Pro:   15% deposit → 100% to Platform
// Partner Link + Pro:       15% deposit → 10% to Installer, 5% to Platform
// ─────────────────────────────────────────────────────────────────────────
//
// This module handles lead record updates after checkout.
// Actual Stripe payment processing is in /app/actions/payments.ts
// ═══════════════════════════════════════════════════════════════════════════

const DEPOSIT_RATE = 0.15; // 15%
const PRO_INSTALLER_RATE = 0.10; // 10% goes to Pro installer (from the 15%)
const PRO_PLATFORM_RATE = 0.05;  // 5% goes to platform for Pro partner links

export type LeadSource = "platform" | "partner_link";

export interface CheckoutInput {
  lead_id: string;
  source: LeadSource;
  installer_id: string | null;
  grand_total: number;
}

export interface CheckoutResult {
  success: boolean;
  deposit_amount: number;
  balance_due: number;
  payout_to: "platform" | "installer" | "split";
  platform_amount: number;      // Amount going to platform
  installer_amount: number;     // Amount going to installer (0 for non-Pro)
  is_pro: boolean;
  stripe_account_id: string | null;
  error?: string;
}

/**
 * Process deposit checkout with source-aware financial routing.
 *
 * Platform Lead:            100% of 15% deposit → Platform
 * Partner Link + Non-Pro:   100% of 15% deposit → Platform
 * Partner Link + Pro:       10% → Installer, 5% → Platform (split)
 *
 * In all cases, installer collects 85% balance on site.
 */
export async function processCheckout(
  input: CheckoutInput
): Promise<CheckoutResult> {
  const { lead_id, source, installer_id, grand_total } = input;

  const depositAmount = Math.round(grand_total * DEPOSIT_RATE * 100) / 100;
  const balanceDue = Math.round((grand_total - depositAmount) * 100) / 100;

  let stripeAccountId: string | null = null;
  let payoutTo: "platform" | "installer" | "split" = "platform";
  let platformAmount = depositAmount;
  let installerAmount = 0;
  let isPro = false;

  if (source === "partner_link" && installer_id) {
    // Partner link: check installer's Pro status and Stripe connection
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id, is_pro")
      .eq("id", installer_id)
      .single();

    isPro = profile?.is_pro === true;
    stripeAccountId = profile?.stripe_account_id || null;

    if (isPro && stripeAccountId) {
      // Pro installer with Stripe connected: split deposit
      platformAmount = Math.round(grand_total * PRO_PLATFORM_RATE * 100) / 100;
      installerAmount = Math.round(grand_total * PRO_INSTALLER_RATE * 100) / 100;
      payoutTo = "split";
    } else {
      // Non-Pro OR no Stripe: platform keeps 100%
      platformAmount = depositAmount;
      installerAmount = 0;
      payoutTo = "platform";
    }
  }

  // Update lead with deposit info
  const { error } = await supabase
    .from("leads")
    .update({
      source,
      deposit_amount: depositAmount,
      deposit_paid: true,
      balance_due: balanceDue,
      payout_status: "pending",
    })
    .eq("id", lead_id);

  if (error) {
    return {
      success: false,
      deposit_amount: depositAmount,
      balance_due: balanceDue,
      payout_to: payoutTo,
      platform_amount: platformAmount,
      installer_amount: installerAmount,
      is_pro: isPro,
      stripe_account_id: stripeAccountId,
      error: "Failed to process checkout.",
    };
  }

  return {
    success: true,
    deposit_amount: depositAmount,
    balance_due: balanceDue,
    payout_to: payoutTo,
    platform_amount: platformAmount,
    installer_amount: installerAmount,
    is_pro: isPro,
    stripe_account_id: stripeAccountId,
  };
}

/**
 * Get checkout details for a lead (used to display payment info).
 */
export async function getCheckoutDetails(leadId: string) {
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, estimated_price, deposit_amount, deposit_paid, balance_due, source, installer_id, payout_status"
    )
    .eq("id", leadId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}
