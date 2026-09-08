import type Stripe from "stripe";

// ═══════════════════════════════════════════════════════════════════════════
// Dispute (chargeback) interpretation
//
// The pure half of dispute handling: turning a Stripe.Dispute into the fields
// we record and alert on. Kept out of the webhook route so the fiddly parts —
// especially the fee, see below — can be tested without standing up a mock
// Supabase and a mock Stripe.
// ═══════════════════════════════════════════════════════════════════════════

export interface DisputeSummary {
  chargeId: string | null;
  paymentIntentId: string | null;
  amountCents: number;
  /** Stripe's dispute fee, as a positive number. */
  feeCents: number;
  currency: string;
  status: string;
  /** Human-readable reason ("product not received"), for emails. */
  reasonLabel: string;
  /** Raw Stripe reason ("product_not_received"), for storage. */
  reason: string | null;
  evidenceDueAt: Date | null;
  /** True once the bank has ruled — terminal, no further action possible. */
  isClosed: boolean;
  /** Only meaningful when isClosed. */
  won: boolean;
}

/**
 * Stripe's dispute fee, as a positive number.
 *
 * Deliberately the largest single magnitude rather than a sum: when a dispute
 * is WON, Stripe appends a second balance transaction reversing the original,
 * carrying an equal and opposite fee. Summing nets those to zero, which would
 * make a "won — $X returned" alert understate the refund by the entire fee.
 * The largest magnitude is the fee that was actually charged, whether or not
 * it was later reversed.
 */
export function disputeFeeCents(dispute: Stripe.Dispute): number {
  const fees = dispute.balance_transactions?.map((bt) => Math.abs(bt.fee || 0)) ?? [];
  return fees.length ? Math.max(...fees) : 0;
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export function summarizeDispute(dispute: Stripe.Dispute): DisputeSummary {
  const isClosed = dispute.status === "won" || dispute.status === "lost";

  return {
    chargeId: idOf(dispute.charge),
    paymentIntentId: idOf(dispute.payment_intent),
    amountCents: dispute.amount,
    feeCents: disputeFeeCents(dispute),
    currency: dispute.currency,
    status: dispute.status,
    reason: dispute.reason ?? null,
    reasonLabel: dispute.reason?.replace(/_/g, " ") || "not stated",
    evidenceDueAt: dispute.evidence_details?.due_by
      ? new Date(dispute.evidence_details.due_by * 1000)
      : null,
    isClosed,
    won: dispute.status === "won",
  };
}
