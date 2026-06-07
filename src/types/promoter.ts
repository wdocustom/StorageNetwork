// ═══════════════════════════════════════════════════════════════════════════
// Promoter Program — Type Definitions
//
// Mirrors the schema introduced in migration 129. Installers can apply to
// become "promoters" — they get a share link and earn an individualized
// cut (set per-promoter by an admin) of every plan sale their link drives,
// paid directly to their connected Stripe account.
//
// agreement_config is intentionally a single shape (percentage-of-sale).
// One-time sales have no recurring "active recruit count" to tier
// against, unlike the installer-recruitment affiliate program — so the
// richer discriminated union in src/types/affiliate.ts doesn't apply here.
// ═══════════════════════════════════════════════════════════════════════════

export type PromoterApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "withdrawn";

export type PromoterAgreementStatus =
  | "proposed"
  | "active"
  | "paused"
  | "terminated";

export type PromoterPayoutStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "refunded";

export interface PromoterAgreementConfig {
  type: "percentage";
  /** Whole-number percent of the sale amount (e.g. 20 = 20%). Individualized
   *  per promoter — set by an admin when proposing the agreement. */
  percent: number;
}

export interface PromoterApplication {
  id: string;
  applicant_id: string;
  status: PromoterApplicationStatus;
  application_data: Record<string, unknown>;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromoterAgreement {
  id: string;
  promoter_id: string;
  application_id: string | null;
  status: PromoterAgreementStatus;
  agreement_config: PromoterAgreementConfig;
  terms_markdown: string | null;
  accepted_at: string | null;
  accepted_terms_version: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  terminated_at: string | null;
  terminated_reason: string | null;
}

export interface PromoterPayout {
  id: string;
  promoter_id: string;
  agreement_id: string;
  stripe_session_id: string;
  plan_id: string | null;
  sale_amount_cents: number;
  commission_cents: number;
  currency: string;
  stripe_transfer_id: string | null;
  status: PromoterPayoutStatus;
  failure_reason: string | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Plain-English formatting (admin propose form preview + acceptance page) ─

export function formatPromoterAgreementConfig(c: PromoterAgreementConfig): string {
  return `${c.percent}% of every plan sale you refer.`;
}

export function isValidPromoterAgreementConfig(
  c: unknown
): c is PromoterAgreementConfig {
  if (!c || typeof c !== "object") return false;
  const cfg = c as Record<string, unknown>;
  return (
    cfg.type === "percentage" &&
    typeof cfg.percent === "number" &&
    cfg.percent > 0 &&
    cfg.percent <= 100
  );
}
