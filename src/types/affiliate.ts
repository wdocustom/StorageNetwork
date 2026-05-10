// ═══════════════════════════════════════════════════════════════════════════
// Affiliate Program — Type Definitions
//
// Mirrors the schema introduced in migration 105 (affiliate program Phase 1).
// Phase 1 is type-only; consumers come online in Phases 2-6:
//   • Phase 2 — application flow (insert into AffiliateApplication)
//   • Phase 3 — admin approval + agreement creation
//   • Phase 4 — affiliate-side acceptance + private partner portal
//   • Phase 5 — Stripe payout pipeline (insert into AffiliatePayout)
//   • Phase 6 — cold-email referral capture (AffiliateEmailInvite +
//               ColdEmailSuppression)
//
// The agreement_config JSONB column is modeled here as a discriminated
// union so the cut-calculator in Phase 5 can pattern-match on `type`
// without runtime shape checks.
// ═══════════════════════════════════════════════════════════════════════════

// ── Status enums ────────────────────────────────────────────────────────────

export type AffiliateApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "withdrawn";

export type AffiliateAgreementStatus =
  | "proposed"
  | "active"
  | "paused"
  | "terminated";

export type AffiliatePayoutStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "refunded";

export type AffiliatePayoutKind =
  | "recurring"
  | "signup_bonus"
  | "manual_adjustment";

export type AffiliateInviteStatus =
  | "sent"
  | "opened"
  | "clicked"
  | "signed_up"
  | "unsubscribed"
  | "bounced";

export type ColdEmailSuppressionReason =
  | "user_unsubscribe"
  | "bounce"
  | "spam_complaint"
  | "admin_block";

// ── Agreement config (discriminated union by `type`) ───────────────────────
// One agreement per affiliate. The shape captures the four cut models
// confirmed in the planning doc: flat per-recruit-per-month, percentage
// of subscription invoice, tiered (the existing Elite Storage Systems
// shape), with an optional one-time signup bonus layered on top.

export interface AgreementConfigBase {
  /** Optional: one-time bonus paid the first time this recruit's
   *  invoice clears. Independent of the recurring cut model. */
  signup_bonus_cents?: number;
}

export interface AgreementConfigFlat extends AgreementConfigBase {
  type: "flat";
  flat_amount_cents: number;
  /** Whether the flat amount is paid once per active recruit per month
   *  (the Elite Storage Systems shape) or on every individual invoice
   *  (less common, useful when subscription cadence is annual). */
  flat_basis: "per_active_recruit_per_month" | "per_invoice";
}

export interface AgreementConfigPercentage extends AgreementConfigBase {
  type: "percentage";
  /** Whole-number percent (e.g. 30 = 30%). Always taken from the recruit's
   *  paid subscription invoice net of Stripe fees. */
  percent: number;
}

export interface AgreementConfigTier {
  /** Inclusive ceiling for this tier's count of active recruits. NULL
   *  means "and above" — only valid for the LAST tier in the array. */
  max_active: number | null;
  amount_cents: number;
}

export interface AgreementConfigTiered extends AgreementConfigBase {
  type: "tiered";
  /** Ordered ascending by max_active. e.g. [{max:25,amt:3500}, {max:null,amt:2500}]
   *  is the existing Elite Storage Systems contract. */
  tiers: AgreementConfigTier[];
  basis: "per_active_recruit_per_month";
}

export type AgreementConfig =
  | AgreementConfigFlat
  | AgreementConfigPercentage
  | AgreementConfigTiered;

// ── Row types (mirror the Postgres tables 1:1) ─────────────────────────────

export interface AffiliateApplication {
  id: string;
  applicant_id: string;
  status: AffiliateApplicationStatus;
  /** Free-form form payload. Phase 2 defines the form fields; we keep
   *  the column flexible so we can iterate the form without migrations. */
  application_data: Record<string, unknown>;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AffiliateAgreement {
  id: string;
  affiliate_id: string;
  application_id: string | null;
  status: AffiliateAgreementStatus;
  agreement_config: AgreementConfig;
  /** NULL = lifetime. */
  duration_months: number | null;
  start_date: string | null;
  end_date: string | null;
  accepted_at: string | null;
  accepted_terms_version: string | null;
  terms_markdown: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  terminated_at: string | null;
  terminated_reason: string | null;
}

export interface AffiliatePayout {
  id: string;
  affiliate_id: string;
  agreement_id: string;
  recruit_id: string | null;
  kind: AffiliatePayoutKind;
  stripe_invoice_id: string | null;
  stripe_transfer_id: string | null;
  amount_cents: number;
  currency: string;
  status: AffiliatePayoutStatus;
  failure_reason: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AffiliateEmailInvite {
  id: string;
  referring_installer_id: string;
  prospect_email: string;       // always stored lowercased
  prospect_name: string | null;
  invite_token: string;
  status: AffiliateInviteStatus;
  subject_variant: string | null;
  signed_up_user_id: string | null;
  created_at: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  signed_up_at: string | null;
}

export interface ColdEmailSuppression {
  id: string;
  email: string;                // always stored lowercased
  reason: ColdEmailSuppressionReason;
  source_invite_id: string | null;
  notes: string | null;
  suppressed_at: string;
}

// ── Type guards (used by Phase 5's cut calculator) ─────────────────────────

export function isFlatConfig(c: AgreementConfig): c is AgreementConfigFlat {
  return c.type === "flat";
}

export function isPercentageConfig(c: AgreementConfig): c is AgreementConfigPercentage {
  return c.type === "percentage";
}

export function isTieredConfig(c: AgreementConfig): c is AgreementConfigTiered {
  return c.type === "tiered";
}
