// ═══════════════════════════════════════════════════════════════════════════
// Installer referral partners — shared, pure helpers (client-safe).
// Server side: @/lib/server/referral-partners (attribution + payouts),
// @/app/actions/referral-partners (installer), @/app/actions/partner-portal
// (partner). Schema: migration 168.
//
// The money rule, in one place:
//   cut      = percent of the job total after the partner discount, or a
//              flat amount, never more than the job total.
//   collect  = the cut rides on the deposit charge's application fee, but
//              only if platform fee + cut still fits inside the deposit.
//              Otherwise nothing is collected and the cut is "owed": the
//              installer pays the partner directly.
// ═══════════════════════════════════════════════════════════════════════════

export type CutType = "percent" | "flat";
export type PartnerDiscountType = "percent" | "fixed";

export type CommissionStatus = "owed" | "held" | "processing" | "paid" | "manual_paid" | "void";

/** Cookie dropped by /r/<code>; read at checkout to apply the discount and attribute the deposit. */
export const PARTNER_REF_COOKIE = "sn_partner_ref";
export const PARTNER_REF_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const MAX_PERCENT_CUT = 50;

/** Share codes: 4–20 of A–Z / 0–9, upper-case. */
export function normalizePartnerCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.length >= 4 && code.length <= 20 ? code : null;
}

/** "Acme Moving & Storage" → "ACMEMOVING" + a short suffix so two Acmes don't collide. */
export function suggestPartnerCode(name: string, suffix: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  let base = "";
  for (const w of words) {
    if ((base + w).length > 12) break;
    base += w;
  }
  if (base.length < 3) base = (words.join("") || "PARTNER").slice(0, 12);
  if (base.length < 3) base = "PARTNER";
  return `${base}${suffix.toUpperCase().replace(/[^A-Z0-9]/g, "")}`.slice(0, 20);
}

/** The partner's cut, in cents, for a job whose total after discount is `jobTotalCents`. */
export function computePartnerCutCents(params: { cutType: CutType; cutValue: number; jobTotalCents: number }): number {
  const { cutType, cutValue, jobTotalCents } = params;
  if (!(jobTotalCents > 0) || !(cutValue > 0)) return 0;
  const raw =
    cutType === "percent"
      ? Math.round(jobTotalCents * (Math.min(cutValue, MAX_PERCENT_CUT) / 100))
      : Math.round(cutValue * 100);
  return Math.max(0, Math.min(raw, jobTotalCents));
}

/**
 * How much of the cut can be taken from this deposit charge. All or nothing:
 * a partial collection would leave the partner paid by two people for one job.
 */
export function collectibleCutCents(params: { depositCents: number; platformFeeCents: number; cutCents: number }): number {
  const { depositCents, platformFeeCents, cutCents } = params;
  if (!(cutCents > 0)) return 0;
  return platformFeeCents + cutCents <= depositCents ? cutCents : 0;
}

/** Job total the cut is figured on: build price minus the customer's discount. */
export function jobTotalAfterDiscountCents(totalPriceCents: number, discountCents: number): number {
  return Math.max(0, totalPriceCents - Math.max(0, discountCents));
}

export function describeCut(cutType: CutType, cutValue: number): string {
  return cutType === "percent" ? `${Number(cutValue)}% of each job` : `$${Number(cutValue).toFixed(2).replace(/\.00$/, "")} per job`;
}

export function describeDiscount(type: PartnerDiscountType | null, value: number | null): string | null {
  if (!type || !value) return null;
  return type === "percent" ? `${Number(value)}% off` : `$${Number(value).toFixed(2).replace(/\.00$/, "")} off`;
}

/** Labels for each side. The partner never sees "owed by the installer" wording as a debt they chase. */
export const STATUS_LABEL: Record<CommissionStatus, { installer: string; partner: string; tone: "amber" | "blue" | "green" | "stone" }> = {
  owed: { installer: "You owe — pay directly", partner: "Earned — paid by the installer", tone: "amber" },
  held: { installer: "Collected — waiting on their Stripe", partner: "Ready — connect Stripe to receive", tone: "blue" },
  processing: { installer: "Sending", partner: "Sending", tone: "blue" },
  paid: { installer: "Paid to their Stripe", partner: "Paid to your Stripe", tone: "green" },
  manual_paid: { installer: "Marked paid", partner: "Paid", tone: "green" },
  void: { installer: "Cancelled", partner: "Cancelled", tone: "stone" },
};

/** "Jane D." — partners see who they referred without the customer's full name. */
export function privateName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Customer";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}
