"use server";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ═══════════════════════════════════════════════════════════════════════════
// Checkout — Financial logic for Platform vs Partner Link deposits
// ═══════════════════════════════════════════════════════════════════════════

const DEPOSIT_RATE = 0.15; // 15%

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
  payout_to: "platform" | "installer";
  stripe_account_id: string | null;
  error?: string;
}

/**
 * Process deposit checkout with source-aware financial routing.
 *
 * Scenario A (Platform Lead): source = 'platform'
 *   → Deposit (15%) goes to The Shelf Dude Platform Account
 *   → Installer collects 85% on site
 *
 * Scenario B (Self Lead): source = 'partner_link'
 *   → Deposit (15%) goes to Installer's Stripe Connect Account (0% platform fee)
 *   → Installer collects 85% on site
 */
export async function processCheckout(
  input: CheckoutInput
): Promise<CheckoutResult> {
  const { lead_id, source, installer_id, grand_total } = input;

  const depositAmount = Math.round(grand_total * DEPOSIT_RATE * 100) / 100;
  const balanceDue = Math.round((grand_total - depositAmount) * 100) / 100;

  let stripeAccountId: string | null = null;
  let payoutTo: "platform" | "installer" = "platform";

  if (source === "partner_link" && installer_id) {
    // Self-lead: deposit goes to installer's Stripe Connect
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", installer_id)
      .single();

    if (profile?.stripe_account_id) {
      stripeAccountId = profile.stripe_account_id;
      payoutTo = "installer";
    } else {
      // Installer hasn't connected Stripe — fall back to platform
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
      stripe_account_id: stripeAccountId,
      error: "Failed to process checkout.",
    };
  }

  return {
    success: true,
    deposit_amount: depositAmount,
    balance_due: balanceDue,
    payout_to: payoutTo,
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
