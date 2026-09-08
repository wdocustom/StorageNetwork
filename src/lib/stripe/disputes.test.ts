import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { disputeFeeCents, summarizeDispute } from "./disputes";

function makeDispute(overrides: Partial<Stripe.Dispute> = {}): Stripe.Dispute {
  return {
    id: "dp_1",
    amount: 28815,
    currency: "usd",
    status: "needs_response",
    reason: "product_not_received",
    charge: "ch_1",
    payment_intent: "pi_1",
    balance_transactions: [{ fee: 1500 } as Stripe.BalanceTransaction],
    evidence_details: { due_by: 1767225600 } as Stripe.Dispute.EvidenceDetails,
    ...overrides,
  } as Stripe.Dispute;
}

describe("disputeFeeCents", () => {
  it("reads the fee from the balance transaction", () => {
    expect(disputeFeeCents(makeDispute())).toBe(1500);
  });

  it("returns the charged fee on a WON dispute, not the netted-out zero", () => {
    // Stripe appends a reversing balance transaction when a dispute is won.
    // Summing these nets to 0, which would understate the refund by the fee.
    const won = makeDispute({
      status: "won",
      balance_transactions: [
        { fee: 1500 } as Stripe.BalanceTransaction,
        { fee: -1500 } as Stripe.BalanceTransaction,
      ],
    });
    expect(disputeFeeCents(won)).toBe(1500);
  });

  it("handles a dispute with no balance transactions yet", () => {
    expect(disputeFeeCents(makeDispute({ balance_transactions: [] }))).toBe(0);
  });
});

describe("summarizeDispute", () => {
  it("summarizes an open dispute as needing a response", () => {
    const s = summarizeDispute(makeDispute());
    expect(s).toMatchObject({
      chargeId: "ch_1",
      paymentIntentId: "pi_1",
      amountCents: 28815,
      feeCents: 1500,
      status: "needs_response",
      isClosed: false,
      won: false,
    });
  });

  it("humanizes the reason for emails but stores Stripe's raw value", () => {
    const s = summarizeDispute(makeDispute());
    expect(s.reasonLabel).toBe("product not received");
    expect(s.reason).toBe("product_not_received");
  });

  it("falls back to a readable label when Stripe gives no reason", () => {
    const s = summarizeDispute(makeDispute({ reason: undefined as never }));
    expect(s.reasonLabel).toBe("not stated");
    expect(s.reason).toBeNull();
  });

  it("converts the evidence deadline from a unix timestamp", () => {
    const s = summarizeDispute(makeDispute());
    expect(s.evidenceDueAt?.getTime()).toBe(1767225600 * 1000);
  });

  it("has no deadline when Stripe supplies none", () => {
    const s = summarizeDispute(
      makeDispute({ evidence_details: undefined as never })
    );
    expect(s.evidenceDueAt).toBeNull();
  });

  it("marks a won dispute closed", () => {
    const s = summarizeDispute(makeDispute({ status: "won" }));
    expect(s.isClosed).toBe(true);
    expect(s.won).toBe(true);
  });

  it("marks a lost dispute closed but not won", () => {
    const s = summarizeDispute(makeDispute({ status: "lost" }));
    expect(s.isClosed).toBe(true);
    expect(s.won).toBe(false);
  });

  it("does not treat under_review as closed — evidence can still be submitted", () => {
    const s = summarizeDispute(makeDispute({ status: "under_review" }));
    expect(s.isClosed).toBe(false);
  });

  it("unwraps expanded charge and payment_intent objects", () => {
    const s = summarizeDispute(
      makeDispute({
        charge: { id: "ch_expanded" } as Stripe.Charge,
        payment_intent: { id: "pi_expanded" } as Stripe.PaymentIntent,
      })
    );
    expect(s.chargeId).toBe("ch_expanded");
    expect(s.paymentIntentId).toBe("pi_expanded");
  });

  it("tolerates a dispute with no payment intent to map back to a job", () => {
    const s = summarizeDispute(makeDispute({ payment_intent: null }));
    expect(s.paymentIntentId).toBeNull();
  });
});
