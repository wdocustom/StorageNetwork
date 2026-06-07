// ═══════════════════════════════════════════════════════════════════════════
// Promoter Cut Calculator
//
// Pure function. No DB, no I/O — given an individualized agreement config
// and a sale amount, returns the cents owed to the promoter. Called by the
// Stripe checkout.session.completed webhook when a plan purchase carries
// promoter attribution.
// ═══════════════════════════════════════════════════════════════════════════

import type { PromoterAgreementConfig } from "@/types/promoter";

export function computePromoterCommissionCents(
  config: PromoterAgreementConfig,
  saleAmountCents: number
): number {
  if (config.type !== "percentage") return 0;
  // Round to nearest cent — Stripe Connect transfers are integer cents.
  return Math.round(saleAmountCents * (config.percent / 100));
}
