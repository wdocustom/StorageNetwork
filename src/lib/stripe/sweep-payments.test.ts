import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
import {
  finalPaymentUpdatePayload,
  kindFrom,
  leadIdFrom,
  strongestPerLead,
  sweepUnrecordedPayments,
  type SweptPayment,
} from "./sweep-payments";

const LEAD_A = "11111111-2222-4333-8444-555555555555";
const LEAD_B = "66666666-7777-4888-8999-aaaaaaaaaaaa";

function swept(overrides: Partial<SweptPayment> = {}): SweptPayment {
  return {
    leadId: LEAD_A,
    kind: "deposit",
    sourceId: "pi_1",
    amount: 208,
    accountId: "acct_1",
    createdUnix: 1_700_000_000,
    customerId: "cus_1",
    paymentMethodId: "pm_1",
    ...overrides,
  };
}

// ── Stubs ──────────────────────────────────────────────────────────────────

function makeStripe(opts: {
  intents?: Partial<Stripe.PaymentIntent>[];
  sessions?: Partial<Stripe.Checkout.Session>[];
}) {
  return {
    paymentIntents: {
      list: vi.fn(async () => ({ data: opts.intents ?? [], has_more: false })),
    },
    checkout: {
      sessions: {
        list: vi.fn(async () => ({ data: opts.sessions ?? [], has_more: false })),
      },
    },
  } as unknown as Stripe;
}

function makeDb(opts: {
  accounts?: { stripe_account_id: string | null }[];
  leads?: Record<string, unknown>[];
  updateResult?: { data: unknown; error: unknown };
}) {
  const updates: { payload: Record<string, unknown>; guards: Record<string, unknown> }[] = [];

  const db = {
    from(table: string) {
      const guards: Record<string, unknown> = {};
      let payload: Record<string, unknown> = {};
      let mode: "select" | "update" = "select";

      const builder: any = {
        select: () => builder,
        update: (p: Record<string, unknown>) => {
          mode = "update";
          payload = p;
          return builder;
        },
        eq: (col: string, val: unknown) => {
          guards[col] = val;
          return builder;
        },
        not: (col: string, op: string, val: unknown) => {
          guards[`not:${col}`] = val;
          return builder;
        },
        in: () => {
          if (table === "leads" && mode === "select") {
            return Promise.resolve({ data: opts.leads ?? [], error: null });
          }
          return builder;
        },
        maybeSingle: () => {
          updates.push({ payload, guards });
          return Promise.resolve(opts.updateResult ?? { data: { id: guards.id }, error: null });
        },
        then(resolve: (v: unknown) => void) {
          if (table === "profiles") {
            return Promise.resolve({ data: opts.accounts ?? [], error: null }).then(resolve);
          }
          return Promise.resolve({ data: [], error: null }).then(resolve);
        },
      };
      return builder;
    },
    updates,
  };
  return db;
}

// ── Pure helpers ───────────────────────────────────────────────────────────

describe("leadIdFrom", () => {
  it("reads a Checkout Session's client_reference_id", () => {
    expect(leadIdFrom({ client_reference_id: LEAD_A })).toBe(LEAD_A);
  });

  it("accepts either metadata spelling", () => {
    expect(leadIdFrom({ metadata: { lead_id: LEAD_A } as Stripe.Metadata })).toBe(LEAD_A);
    expect(leadIdFrom({ metadata: { leadId: LEAD_A } as Stripe.Metadata })).toBe(LEAD_A);
  });

  it("rejects a value that isn't a lead id rather than querying on it", () => {
    expect(leadIdFrom({ metadata: { lead_id: "gift_12" } as Stripe.Metadata })).toBeNull();
    expect(leadIdFrom({})).toBeNull();
  });
});

describe("kindFrom", () => {
  it("recognises a balance payment", () => {
    expect(kindFrom({ metadata: { type: "final_payment" } as Stripe.Metadata })).toBe(
      "final_payment"
    );
  });

  it("defaults to deposit, the recoverable wrong answer", () => {
    expect(kindFrom({ metadata: {} as Stripe.Metadata })).toBe("deposit");
    expect(kindFrom({})).toBe("deposit");
  });
});

describe("strongestPerLead", () => {
  it("lets the balance payment win over the deposit on the same lead", () => {
    const picked = strongestPerLead([
      swept({ kind: "deposit", sourceId: "pi_dep" }),
      swept({ kind: "final_payment", sourceId: "pi_bal" }),
    ]);
    expect(picked.get(LEAD_A)?.sourceId).toBe("pi_bal");
  });

  it("does not let a later deposit demote a balance payment", () => {
    const picked = strongestPerLead([
      swept({ kind: "final_payment", sourceId: "pi_bal", createdUnix: 1 }),
      swept({ kind: "deposit", sourceId: "pi_dep", createdUnix: 999 }),
    ]);
    expect(picked.get(LEAD_A)?.sourceId).toBe("pi_bal");
  });

  it("keeps leads apart", () => {
    const picked = strongestPerLead([swept(), swept({ leadId: LEAD_B, sourceId: "pi_2" })]);
    expect(picked.size).toBe(2);
  });
});

describe("finalPaymentUpdatePayload", () => {
  it("closes the job as fully settled", () => {
    expect(finalPaymentUpdatePayload()).toMatchObject({
      status: "paid",
      deposit_paid: true,
      payout_status: "paid",
    });
  });
});

// ── Sweep ──────────────────────────────────────────────────────────────────

describe("sweepUnrecordedPayments", () => {
  const sinceUnix = 1_700_000_000;

  it("repairs an expired lead the DB-first pass would never look at", async () => {
    const stripe = makeStripe({
      intents: [
        {
          id: "pi_1",
          status: "succeeded",
          amount: 20800,
          created: sinceUnix + 10,
          customer: "cus_1",
          payment_method: "pm_1",
          metadata: { lead_id: LEAD_A, type: "deposit" } as Stripe.Metadata,
        },
      ],
    });
    const db = makeDb({
      accounts: [{ stripe_account_id: "acct_1" }],
      leads: [
        {
          id: LEAD_A,
          status: "expired",
          payout_status: "pending",
          deposit_paid: false,
          estimated_price: 520,
          discount_amount: 0,
        },
      ],
    });

    const report = await sweepUnrecordedPayments({ stripe, db }, { sinceUnix });

    expect(report.repaired).toBe(1);
    expect(report.results[0].outcome).toBe("repaired");
    expect(db.updates[0].payload).toMatchObject({
      deposit_paid: true,
      status: "open",
      balance_due: 312,
      stripe_customer_id: "cus_1",
      stripe_payment_method_id: "pm_1",
    });
  });

  it("finds a balance payment that only the Checkout Session names", async () => {
    const stripe = makeStripe({
      sessions: [
        {
          id: "cs_1",
          payment_status: "paid",
          amount_total: 18000,
          created: sinceUnix + 10,
          client_reference_id: LEAD_A,
          customer: "cus_9",
          metadata: { type: "final_payment" } as Stripe.Metadata,
        },
      ],
    });
    const db = makeDb({
      accounts: [{ stripe_account_id: "acct_1" }],
      leads: [
        { id: LEAD_A, status: "open", payout_status: "deposit_collected", deposit_paid: true },
      ],
    });

    const report = await sweepUnrecordedPayments({ stripe, db }, { sinceUnix });

    expect(report.repaired).toBe(1);
    expect(report.results[0].kind).toBe("final_payment");
    expect(db.updates[0].payload).toMatchObject({ status: "paid", payout_status: "paid" });
  });

  it("leaves a cancelled job alone and flags it for a human", async () => {
    const stripe = makeStripe({
      intents: [
        {
          id: "pi_1",
          status: "succeeded",
          amount: 20800,
          created: sinceUnix + 10,
          metadata: { lead_id: LEAD_A } as Stripe.Metadata,
        },
      ],
    });
    const db = makeDb({
      accounts: [{ stripe_account_id: "acct_1" }],
      leads: [{ id: LEAD_A, status: "cancelled", deposit_paid: false }],
    });

    const report = await sweepUnrecordedPayments({ stripe, db }, { sinceUnix });

    expect(report.needsReview).toBe(1);
    expect(report.repaired).toBe(0);
    expect(db.updates).toHaveLength(0);
    expect(report.results[0].detail).toMatch(/cancelled/);
  });

  it("reports a payment whose lead no longer exists", async () => {
    const stripe = makeStripe({
      intents: [
        {
          id: "pi_1",
          status: "succeeded",
          amount: 20800,
          created: sinceUnix + 10,
          metadata: { lead_id: LEAD_A } as Stripe.Metadata,
        },
      ],
    });
    const db = makeDb({ accounts: [{ stripe_account_id: "acct_1" }], leads: [] });

    const report = await sweepUnrecordedPayments({ stripe, db }, { sinceUnix });

    expect(report.orphans).toBe(1);
    expect(db.updates).toHaveLength(0);
  });

  it("counts an already-recorded deposit without rewriting it", async () => {
    const stripe = makeStripe({
      intents: [
        {
          id: "pi_1",
          status: "succeeded",
          amount: 20800,
          created: sinceUnix + 10,
          metadata: { lead_id: LEAD_A } as Stripe.Metadata,
        },
      ],
    });
    const db = makeDb({
      accounts: [{ stripe_account_id: "acct_1" }],
      leads: [{ id: LEAD_A, status: "open", deposit_paid: true }],
    });

    const report = await sweepUnrecordedPayments({ stripe, db }, { sinceUnix });

    expect(report.alreadyRecorded).toBe(1);
    expect(report.repaired).toBe(0);
    expect(db.updates).toHaveLength(0);
  });

  it("ignores unsucceeded intents and unpaid sessions", async () => {
    const stripe = makeStripe({
      intents: [
        {
          id: "pi_1",
          status: "requires_payment_method",
          amount: 20800,
          created: sinceUnix,
          metadata: { lead_id: LEAD_A } as Stripe.Metadata,
        },
      ],
      sessions: [
        {
          id: "cs_1",
          payment_status: "unpaid",
          amount_total: 100,
          created: sinceUnix,
          client_reference_id: LEAD_B,
        },
      ],
    });
    const db = makeDb({ accounts: [{ stripe_account_id: "acct_1" }] });

    const report = await sweepUnrecordedPayments({ stripe, db }, { sinceUnix });

    expect(report.paymentsSeen).toBe(0);
  });

  it("writes nothing on a dry run but reports what it would repair", async () => {
    const stripe = makeStripe({
      intents: [
        {
          id: "pi_1",
          status: "succeeded",
          amount: 20800,
          created: sinceUnix + 10,
          metadata: { lead_id: LEAD_A } as Stripe.Metadata,
        },
      ],
    });
    const db = makeDb({
      accounts: [{ stripe_account_id: "acct_1" }],
      leads: [{ id: LEAD_A, status: "expired", deposit_paid: false, estimated_price: 520 }],
    });

    const report = await sweepUnrecordedPayments({ stripe, db }, { sinceUnix, dryRun: true });

    expect(report.repaired).toBe(1);
    expect(db.updates).toHaveLength(0);
  });

  it("always sweeps the platform account as well as connected ones", async () => {
    const stripe = makeStripe({});
    const db = makeDb({ accounts: [{ stripe_account_id: "acct_1" }] });

    const report = await sweepUnrecordedPayments({ stripe, db }, { sinceUnix });

    // platform + acct_1
    expect(report.accountsScanned).toBe(2);
  });

  it("says where to resume when it runs out of time", async () => {
    const stripe = makeStripe({});
    const db = makeDb({
      accounts: [{ stripe_account_id: "acct_1" }, { stripe_account_id: "acct_2" }],
    });

    const report = await sweepUnrecordedPayments(
      { stripe, db },
      { sinceUnix, concurrency: 1, deadlineMs: -1 }
    );

    expect(report.accountsRemaining).toBe(3);
    expect(report.errors[0]).toMatch(/offset=0/);
  });

  it("keeps the repair when the notification fails", async () => {
    const stripe = makeStripe({
      intents: [
        {
          id: "pi_1",
          status: "succeeded",
          amount: 20800,
          created: sinceUnix + 10,
          metadata: { lead_id: LEAD_A } as Stripe.Metadata,
        },
      ],
    });
    const db = makeDb({
      accounts: [{ stripe_account_id: "acct_1" }],
      leads: [{ id: LEAD_A, status: "expired", deposit_paid: false, estimated_price: 520 }],
    });

    const report = await sweepUnrecordedPayments({
      stripe,
      db,
      onRepaired: async () => {
        throw new Error("Resend is down");
      },
    }, { sinceUnix });

    expect(report.repaired).toBe(1);
    expect(report.results[0].detail).toMatch(/Resend is down/);
  });
});
