import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
import {
  depositSearchQuery,
  depositUpdatePayload,
  hoursUnrecorded,
  isSafeLeadId,
  reconcileDeposits,
  type CandidateLead,
} from "./reconcile-deposits";

const LEAD_A = "11111111-2222-4333-8444-555555555555";
const LEAD_B = "66666666-7777-4888-8999-aaaaaaaaaaaa";

function makePI(overrides: Partial<Stripe.PaymentIntent> = {}): Stripe.PaymentIntent {
  return {
    id: "pi_1",
    amount: 20800,
    created: Math.floor(Date.now() / 1000) - 3600,
    customer: "cus_1",
    payment_method: "pm_1",
    metadata: { lead_id: LEAD_A, type: "deposit" },
    ...overrides,
  } as Stripe.PaymentIntent;
}

function makeLead(overrides: Partial<CandidateLead> = {}): CandidateLead {
  return {
    id: LEAD_A,
    installer_id: "inst_1",
    customer_name: "Tori Hanson",
    customer_email: "tori@example.com",
    estimated_price: 520,
    discount_amount: 0,
    created_at: new Date().toISOString(),
    referring_installer_id: null,
    bounty_status: null,
    ...overrides,
  };
}

// ── Minimal Supabase stub ──────────────────────────────────────────────────
// Every builder method returns `this`; the terminal call resolves whatever the
// scripted result for that table+operation is.
function makeDb(opts: {
  leads?: CandidateLead[];
  leadsError?: unknown;
  profiles?: { id: string; stripe_account_id: string | null }[];
  updateResult?: { data: unknown; error: unknown };
  onUpdate?: (payload: Record<string, unknown>) => void;
}) {
  const updates: { payload: Record<string, unknown>; guards: Record<string, unknown> }[] = [];

  const db = {
    from(table: string) {
      const guards: Record<string, unknown> = {};
      let payload: Record<string, unknown> = {};
      let mode: "select" | "update" = "select";

      const builder: any = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          guards[col] = val;
          return builder;
        },
        in: () => builder,
        gte: () => builder,
        order: () => builder,
        update: (p: Record<string, unknown>) => {
          mode = "update";
          payload = p;
          return builder;
        },
        limit: () => {
          if (table === "leads") {
            return Promise.resolve({ data: opts.leads ?? [], error: opts.leadsError ?? null });
          }
          return Promise.resolve({ data: [], error: null });
        },
        maybeSingle: () => {
          if (mode === "update") {
            updates.push({ payload, guards });
            opts.onUpdate?.(payload);
            return Promise.resolve(opts.updateResult ?? { data: { id: guards.id }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        // `.in()` on profiles is terminal in this module.
        then(resolve: (v: unknown) => void) {
          if (table === "profiles") {
            return Promise.resolve({ data: opts.profiles ?? [], error: null }).then(resolve);
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

function makeStripe(searchResults: Record<string, Stripe.PaymentIntent[]>) {
  const searchCalls: { query: string; options: unknown }[] = [];
  return {
    stripe: {
      paymentIntents: {
        search: vi.fn(async (params: { query: string }, options: unknown) => {
          searchCalls.push({ query: params.query, options });
          const leadId = params.query.match(/metadata\['lead_id'\]:'([^']+)'/)?.[1] ?? "";
          return { data: searchResults[leadId] ?? [] };
        }),
      },
    } as unknown as Stripe,
    searchCalls,
  };
}

describe("isSafeLeadId", () => {
  it("accepts a UUID", () => {
    expect(isSafeLeadId(LEAD_A)).toBe(true);
  });

  it("rejects an id carrying a quote that would break out of the search literal", () => {
    expect(isSafeLeadId("' OR status:'succeeded")).toBe(false);
    expect(isSafeLeadId(`${LEAD_A}'`)).toBe(false);
  });
});

describe("depositSearchQuery", () => {
  it("asks only for succeeded intents belonging to the lead", () => {
    expect(depositSearchQuery(LEAD_A)).toBe(
      `status:'succeeded' AND metadata['lead_id']:'${LEAD_A}'`
    );
  });
});

describe("depositUpdatePayload", () => {
  it("records the deposit and reopens the job", () => {
    const payload = depositUpdatePayload(
      { estimated_price: 520, discount_amount: 0 },
      makePI(),
      "acct_1"
    );
    expect(payload).toMatchObject({
      deposit_paid: true,
      deposit_amount: 208,
      balance_due: 312,
      payout_status: "deposit_collected",
      status: "open",
    });
  });

  it("takes the discount off the balance, never the deposit", () => {
    const payload = depositUpdatePayload(
      { estimated_price: 520, discount_amount: 50 },
      makePI(),
      "acct_1"
    );
    expect(payload.deposit_amount).toBe(208);
    expect(payload.balance_due).toBe(262);
  });

  it("scopes the saved card to the connected account it lives on", () => {
    const payload = depositUpdatePayload(
      { estimated_price: 520, discount_amount: 0 },
      makePI(),
      "acct_1"
    );
    expect(payload.stripe_customer_id).toBe("cus_1");
    expect(payload.stripe_payment_method_id).toBe("pm_1");
    expect(payload.stripe_customer_account_id).toBe("acct_1");
  });

  it("records a platform charge's card with a null account, not a missing one", () => {
    const payload = depositUpdatePayload(
      { estimated_price: 520, discount_amount: 0 },
      makePI(),
      null
    );
    expect("stripe_customer_account_id" in payload).toBe(true);
    expect(payload.stripe_customer_account_id).toBeNull();
  });

  it("leaves the card fields alone when the intent saved no card", () => {
    const payload = depositUpdatePayload(
      { estimated_price: 520, discount_amount: 0 },
      makePI({ customer: null, payment_method: null }),
      "acct_1"
    );
    expect("stripe_customer_id" in payload).toBe(false);
    expect("stripe_customer_account_id" in payload).toBe(false);
  });
});

describe("hoursUnrecorded", () => {
  it("measures from when the customer paid", () => {
    const now = new Date("2026-09-17T10:41:00Z");
    const paid = Math.floor(new Date("2026-09-17T01:46:00Z").getTime() / 1000);
    expect(hoursUnrecorded(paid, now)).toBe(8.9);
  });
});

describe("reconcileDeposits", () => {
  it("repairs a lead whose deposit succeeded in Stripe", async () => {
    const db = makeDb({
      leads: [makeLead()],
      profiles: [{ id: "inst_1", stripe_account_id: "acct_1" }],
    });
    const { stripe, searchCalls } = makeStripe({ [LEAD_A]: [makePI()] });

    const report = await reconcileDeposits({ stripe, db });

    expect(report.scanned).toBe(1);
    expect(report.found).toBe(1);
    expect(report.repaired).toBe(1);
    expect(report.findings[0]).toMatchObject({
      leadId: LEAD_A,
      accountId: "acct_1",
      paymentIntentId: "pi_1",
      amount: 208,
      repaired: true,
    });
    // Searched the installer's connected account, not the platform.
    expect(searchCalls[0].options).toEqual({ stripeAccount: "acct_1" });
    expect(db.updates[0].payload).toMatchObject({ deposit_paid: true, status: "open" });
    // Guarded so a webhook landing first cannot be overwritten.
    expect(db.updates[0].guards).toMatchObject({ id: LEAD_A, deposit_paid: false });
  });

  it("leaves a genuinely unpaid quote alone", async () => {
    const db = makeDb({
      leads: [makeLead()],
      profiles: [{ id: "inst_1", stripe_account_id: "acct_1" }],
    });
    const { stripe } = makeStripe({}); // no succeeded intent

    const report = await reconcileDeposits({ stripe, db });

    expect(report.scanned).toBe(1);
    expect(report.found).toBe(0);
    expect(report.repaired).toBe(0);
    expect(db.updates).toHaveLength(0);
  });

  it("writes nothing on a dry run but still reports the damage", async () => {
    const db = makeDb({
      leads: [makeLead()],
      profiles: [{ id: "inst_1", stripe_account_id: "acct_1" }],
    });
    const { stripe } = makeStripe({ [LEAD_A]: [makePI()] });

    const report = await reconcileDeposits({ stripe, db }, { dryRun: true });

    expect(report.found).toBe(1);
    expect(report.repaired).toBe(0);
    expect(report.findings[0].repaired).toBe(false);
    expect(db.updates).toHaveLength(0);
  });

  it("searches the platform for an installer with no Stripe connected", async () => {
    const db = makeDb({
      leads: [makeLead({ installer_id: "inst_2" })],
      profiles: [{ id: "inst_2", stripe_account_id: null }],
    });
    const { stripe, searchCalls } = makeStripe({ [LEAD_A]: [makePI()] });

    await reconcileDeposits({ stripe, db });

    expect(searchCalls[0].options).toBeUndefined();
  });

  it("treats a lead the webhook recorded mid-pass as already handled", async () => {
    const db = makeDb({
      leads: [makeLead()],
      profiles: [{ id: "inst_1", stripe_account_id: "acct_1" }],
      updateResult: { data: null, error: null }, // guard matched nothing
    });
    const { stripe } = makeStripe({ [LEAD_A]: [makePI()] });

    const report = await reconcileDeposits({ stripe, db });

    expect(report.found).toBe(1);
    expect(report.repaired).toBe(0);
    expect(report.findings[0].repaired).toBe(false);
    expect(report.findings[0].error).toMatch(/already recorded/i);
  });

  it("keeps the repair when the notification fails", async () => {
    const db = makeDb({
      leads: [makeLead()],
      profiles: [{ id: "inst_1", stripe_account_id: "acct_1" }],
    });
    const { stripe } = makeStripe({ [LEAD_A]: [makePI()] });

    const report = await reconcileDeposits({
      stripe,
      db,
      onRepaired: async () => {
        throw new Error("Resend is down");
      },
    });

    expect(report.repaired).toBe(1);
    expect(report.findings[0].repaired).toBe(true);
    expect(report.findings[0].error).toMatch(/Resend is down/);
  });

  it("flags a repaired lead whose referral bounty is still owed", async () => {
    const db = makeDb({
      leads: [makeLead({ referring_installer_id: "inst_9", bounty_status: "pending" })],
      profiles: [{ id: "inst_1", stripe_account_id: "acct_1" }],
    });
    const { stripe } = makeStripe({ [LEAD_A]: [makePI()] });

    const report = await reconcileDeposits({ stripe, db });

    expect(report.findings[0].bountyPending).toBe(true);
  });

  it("keeps going when one lead's Stripe search fails", async () => {
    const db = makeDb({
      leads: [makeLead(), makeLead({ id: LEAD_B })],
      profiles: [{ id: "inst_1", stripe_account_id: "acct_1" }],
    });
    const stripe = {
      paymentIntents: {
        search: vi.fn(async (params: { query: string }) => {
          if (params.query.includes(LEAD_A)) throw new Error("account no longer connected");
          return { data: [makePI({ id: "pi_2", metadata: { lead_id: LEAD_B } })] };
        }),
      },
    } as unknown as Stripe;

    const report = await reconcileDeposits({ stripe, db });

    expect(report.errors[0]).toMatch(/account no longer connected/);
    expect(report.repaired).toBe(1);
    expect(report.findings[0].leadId).toBe(LEAD_B);
  });

  it("reports a failed lead query instead of throwing", async () => {
    const db = makeDb({ leadsError: { message: "boom" } });
    const { stripe } = makeStripe({});

    const report = await reconcileDeposits({ stripe, db });

    expect(report.errors[0]).toMatch(/Lead query failed/);
    expect(report.scanned).toBe(0);
  });
});
