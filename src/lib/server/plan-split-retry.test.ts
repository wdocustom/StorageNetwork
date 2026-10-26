import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { retryPlanSplitPayout } from "./plan-split-payouts";

type Row = Record<string, unknown>;

/** Chainable in-memory tables: select/update + eq filters, single(), awaitable. */
function fakeDb(tables: Record<string, Row[]>) {
  return {
    tables,
    from(name: string) {
      const filters: [string, unknown][] = [];
      let patch: Row | null = null;
      const matching = () => tables[name].filter((r) => filters.every(([k, v]) => r[k] === v));
      const run = () => {
        const rows = matching();
        if (patch) rows.forEach((r) => Object.assign(r, patch));
        return rows;
      };
      const q = {
        select: () => q,
        update: (p: Row) => {
          patch = p;
          return q;
        },
        eq: (k: string, v: unknown) => {
          filters.push([k, v]);
          return q;
        },
        single: async () => ({ data: run()[0] ?? null }),
        then: (resolve: (v: { data: Row[] }) => void) => resolve({ data: run() }),
      };
      return q;
    },
  };
}

function fakeStripe(existing: { id: string; metadata: Record<string, string> }[] = []) {
  const created: Row[] = [];
  const stripe = {
    transfers: {
      list: async () => ({ data: existing }),
      create: async (params: Row) => {
        created.push(params);
        return { id: "tr_retry" };
      },
    },
    checkout: { sessions: { retrieve: async () => ({ id: "cs_1", payment_intent: "pi_1" }) } },
    paymentIntents: { retrieve: async () => ({ latest_charge: "ch_1" }) },
  };
  return { stripe: stripe as unknown as Stripe, created };
}

const failedRow = () => ({
  id: "row-1",
  stripe_session_id: "cs_1",
  recipient_id: "inst-1",
  amount_cents: 250,
  reason: "bestseller",
  bestsellers: ["indiana-joe"],
  status: "failed",
  failure_reason: "transfer_error: boom",
});
const profiles = [{ id: "inst-1", stripe_account_id: "acct_1", stripe_details_submitted: true, email: "inst@example.com", first_name: "Pat" }];
const silent = async () => {};

describe("retryPlanSplitPayout", () => {
  it("re-sends a failed transfer from the sale's charge and tells the installer", async () => {
    const db = fakeDb({ plan_split_payouts: [failedRow()], profiles });
    const { stripe, created } = fakeStripe();
    const emails: string[] = [];
    const result = await retryPlanSplitPayout("row-1", {
      stripe,
      db: db as unknown as SupabaseClient,
      notify: async (email) => {
        emails.push(email);
      },
    });
    expect(emails).toEqual(["inst@example.com"]);
    expect(result).toEqual({ ok: true, status: "paid" });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ amount: 250, destination: "acct_1", source_transaction: "ch_1", transfer_group: "cs_1" });
    expect(db.tables.plan_split_payouts[0]).toMatchObject({ status: "paid", stripe_transfer_id: "tr_retry" });
  });

  it("records a transfer Stripe already made instead of paying again", async () => {
    const db = fakeDb({ plan_split_payouts: [failedRow()], profiles });
    const { stripe, created } = fakeStripe([{ id: "tr_original", metadata: { type: "plan_split" } }]);
    const result = await retryPlanSplitPayout("row-1", { stripe, db: db as unknown as SupabaseClient, notify: silent });
    expect(result.ok).toBe(true);
    expect(created).toHaveLength(0);
    expect(db.tables.plan_split_payouts[0]).toMatchObject({ status: "paid", stripe_transfer_id: "tr_original" });
  });

  it("only retries failed payouts, and only once at a time", async () => {
    const paid = { ...failedRow(), status: "paid" };
    const db = fakeDb({ plan_split_payouts: [paid], profiles });
    const { stripe, created } = fakeStripe();
    expect(await retryPlanSplitPayout("row-1", { stripe, db: db as unknown as SupabaseClient, notify: silent })).toEqual({
      ok: false,
      error: "Only failed payouts can be retried.",
    });
    expect(created).toHaveLength(0);
  });

  it("explains when the installer still has no connected Stripe account", async () => {
    const db = fakeDb({ plan_split_payouts: [failedRow()], profiles: [] });
    const { stripe } = fakeStripe();
    const result = await retryPlanSplitPayout("row-1", { stripe, db: db as unknown as SupabaseClient, notify: silent });
    expect(result.ok).toBe(false);
    expect(db.tables.plan_split_payouts[0].status).toBe("failed");
  });
});
