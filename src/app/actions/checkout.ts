"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { getDepositAmount } from "@/app/actions/fee-engine";
import { verifyLeadOwnership } from "@/lib/auth";

const supabase = getServiceClient();

// ═══════════════════════════════════════════════════════════════════════════
// Checkout — Financial logic for Platform vs Partner Link deposits
//
// FEE STRUCTURE:
// ─────────────────────────────────────────────────────────────────────────
// Platform Lead:                 deposit → Platform fee + remainder to Installer
// Partner Link (no Stripe):      deposit → 100% to Platform
// Partner Link (Stripe connected): deposit → 3% to Platform, rest to Installer
// ─────────────────────────────────────────────────────────────────────────
//
// Deposit amount is installer-configurable (minimum 15% of build).
// This module handles lead record updates after checkout.
// Actual Stripe payment processing is in /app/actions/payments.ts
// ═══════════════════════════════════════════════════════════════════════════

const PRO_INSTALLER_RATE = 0.12; // 12% goes to Pro installer (from the 15%)
const PRO_PLATFORM_RATE = 0.03;  // 3% goes to platform for Pro partner links

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
 * Platform Lead:                  100% of 15% deposit → Platform
 * Partner Link (no Stripe):      100% of 15% deposit → Platform
 * Partner Link (Stripe connected): 12% → Installer, 3% → Platform (split)
 *
 * In all cases, installer collects 85% balance on site.
 */
export async function processCheckout(
  input: CheckoutInput
): Promise<CheckoutResult> {
  const { lead_id, source, installer_id, grand_total } = input;

  // Use installer's custom deposit config (min 15% enforced by fee engine)
  const depositAmount = await getDepositAmount(grand_total, installer_id || undefined);
  const balanceDue = Math.round((grand_total - depositAmount) * 100) / 100;

  let stripeAccountId: string | null = null;
  let payoutTo: "platform" | "installer" | "split" = "platform";
  let platformAmount = depositAmount;
  let installerAmount = 0;
  let isPro = false;

  if (source === "partner_link" && installer_id) {
    // Partner link: check installer's Pro status, Stripe connection, and fee override
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id, is_pro, platform_fee_override")
      .eq("id", installer_id)
      .single();

    isPro = profile?.is_pro === true;
    stripeAccountId = profile?.stripe_account_id || null;
    const feeOverride = profile?.platform_fee_override;
    const hasFeeOverride = feeOverride !== null && feeOverride !== undefined;

    if (hasFeeOverride && isPro && stripeAccountId) {
      // Founder / custom fee rate — platform takes override rate, rest to installer
      // Bounds-check: clamp override to [0, 0.25] to prevent negative fees
      // or unreasonable platform takes from misconfigured DB values.
      const rawRate = Number(feeOverride);
      const overrideRate = Math.max(0, Math.min(rawRate, 0.25));
      if (rawRate !== overrideRate) {
        console.warn(`[Checkout] Fee override out of bounds: ${rawRate} → clamped to ${overrideRate}`);
      }
      platformAmount = Math.round(grand_total * overrideRate * 100) / 100;
      installerAmount = depositAmount - platformAmount;
      payoutTo = "split";
    } else if (isPro && stripeAccountId) {
      // Pro installer with Stripe connected: split deposit
      platformAmount = Math.round(grand_total * PRO_PLATFORM_RATE * 100) / 100;
      installerAmount = Math.round(grand_total * PRO_INSTALLER_RATE * 100) / 100;
      payoutTo = "split";
    } else {
      // No Stripe connected: platform keeps 100%
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
 * Requires authentication — caller must own the lead.
 */
export async function getCheckoutDetails(leadId: string) {
  const userId = await verifyLeadOwnership(leadId);
  if (!userId) return null;

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
