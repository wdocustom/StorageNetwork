// ═══════════════════════════════════════════════════════════════════════════
// Affiliate Cut Calculator
//
// Pure functions only. No DB, no I/O — given an agreement config + invoice
// context + current active-recruit count, returns the cents owed to the
// affiliate. Called by:
//   • The Stripe invoice.payment_succeeded webhook (Phase 5) when a recruit
//     pays a subscription invoice.
//   • The admin "preview cut" UI (potential future use, not built yet).
//
// Two distinct payouts can come out of a single invoice:
//   1. A recurring cut — applies to every recruit invoice. The shape
//      depends on agreement.type (flat / percentage / tiered).
//   2. A one-time signup bonus — only on the recruit's FIRST invoice, and
//      only when the agreement has signup_bonus_cents set.
//
// Tiered tier-resolution rule (matches the existing Elite Storage Systems
// behavior in calculate_partner_commission): walk tiers in order; the first
// tier whose max_active satisfies activeRecruitCount wins. The last tier
// must have max_active = null (= unlimited) — that's enforced by the admin
// editor and validated server-side at agreement-propose time.
//
//   Example for Elite's tiered shape:
//     tiers = [{max:25, $35}, {max:null, $25}]
//     activeRecruitCount = 24  → $35 (tier 1)
//     activeRecruitCount = 26  → $25 (tier 2 — applies to the entire
//                                          billing period for ALL recruits,
//                                          matching the existing function)
//
// ═══════════════════════════════════════════════════════════════════════════

import type {
  AgreementConfig,
  AgreementConfigTiered,
} from "@/types/affiliate";

export interface ComputeCutInput {
  config: AgreementConfig;
  /** The invoice's amount_paid in cents. Used for percentage cuts. */
  invoiceAmountCents: number;
  /** Affiliate's CURRENT active subscribed recruit count. Used by tiered
   *  rules to pick the applicable bracket. Includes the recruit whose
   *  invoice triggered this calculation. */
  activeRecruitCount: number;
  /** True when the recruit whose invoice this is has not previously
   *  generated a signup_bonus payout under this agreement. Caller is
   *  responsible for the lookup; the calculator just trusts the flag. */
  isFirstInvoiceForRecruit: boolean;
}

export interface ComputeCutResult {
  /** Recurring cut owed for this single invoice. */
  recurringCents: number;
  /** Signup bonus owed (only non-zero on first invoice for this recruit). */
  signupBonusCents: number;
  /** Audit-log breadcrumb describing how the recurring cut was computed.
   *  Stored in affiliate_payouts.notes by the webhook. */
  recurringNote: string;
}

export function computeAffiliateCut(input: ComputeCutInput): ComputeCutResult {
  const { config, invoiceAmountCents, activeRecruitCount, isFirstInvoiceForRecruit } = input;

  let recurringCents = 0;
  let recurringNote = "";

  if (config.type === "flat") {
    recurringCents = config.flat_amount_cents;
    recurringNote = `Flat ${centsToDollars(config.flat_amount_cents)} (${config.flat_basis})`;
  } else if (config.type === "percentage") {
    // Round to nearest cent. Stripe Connect transfers are integer cents.
    recurringCents = Math.round(invoiceAmountCents * (config.percent / 100));
    recurringNote = `${config.percent}% of ${centsToDollars(invoiceAmountCents)} = ${centsToDollars(recurringCents)}`;
  } else if (config.type === "tiered") {
    const tier = resolveTier(config, activeRecruitCount);
    recurringCents = tier.amount_cents;
    const tierIdx = config.tiers.indexOf(tier);
    recurringNote = `Tier ${tierIdx + 1} of ${config.tiers.length} @ ${centsToDollars(tier.amount_cents)} (active count: ${activeRecruitCount})`;
  }

  const signupBonusCents =
    isFirstInvoiceForRecruit && config.signup_bonus_cents
      ? config.signup_bonus_cents
      : 0;

  return { recurringCents, signupBonusCents, recurringNote };
}

/** Walks tier list ascending; first tier whose max_active satisfies the
 *  count wins. The validator guarantees the last tier has max_active=null,
 *  so this is always defined. */
function resolveTier(
  config: AgreementConfigTiered,
  activeRecruitCount: number
) {
  for (const tier of config.tiers) {
    if (tier.max_active === null) return tier;
    if (activeRecruitCount <= tier.max_active) return tier;
  }
  // Defensive — validator should prevent this, but if every tier has a
  // bounded max_active and count exceeds them all, fall back to the last
  // tier so we never throw at payout time.
  return config.tiers[config.tiers.length - 1];
}

function centsToDollars(c: number): string {
  const d = c / 100;
  return d % 1 === 0 ? `$${d.toFixed(0)}` : `$${d.toFixed(2)}`;
}
