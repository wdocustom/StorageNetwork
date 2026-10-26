import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { processPlanSplits } from "./plan-split-payouts";
import { BESTSELLER_OWNERS } from "@/lib/plan-splits";

const ELITE = BESTSELLER_OWNERS["indiana-joe"].profileId;
const RACK_CITY = BESTSELLER_OWNERS["rack-city-roller"].profileId;
const REFERRER = "11111111-2222-4333-8444-555555555555";

/** In-memory plan_split_payouts + profiles, enough for the calls the payout makes. */
function fakeDb(accounts: Record<string, string | null>) {
  const rows: Record<string, Record<string, unknown>> = {};
  let nextId = 1;
  const db = {
    rows,
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          return {
            select: () => ({
              single: async () => {
                const dup = Object.values(rows).some(
                  (r) => r.stripe_session_id === row.stripe_session_id && r.recipient_id === row.recipient_id,
                );
                if (dup) return { data: null, error: { code: "23505" } };
                const id = `row-${nextId++}`;
                rows[id] = { ...row, id };
                return { data: { id }, error: null };
              },
            }),
          };
        },
        update(patch: Record<string, unknown>) {
          return {
            eq: async (_col: string, id: string) => {
              Object.assign(rows[id], patch);
              return { error: null };
            },
          };
        },
        select() {
          return {
            eq: (_col: string, id: string) => ({
              single: async () => {
                if (table !== "profiles") return { data: null };
                const acct = accounts[id];
                return {
                  data: acct
                    ? { stripe_account_id: acct, stripe_details_submitted: true, email: `${id}@example.com`, first_name: "Pat", business_name: "Shop" }
                    : null,
                };
              },
            }),
          };
        },
      };
    },
  };
  return db;
}

function fakeStripe() {
  const transfers: Array<{ params: Record<string, unknown>; opts: Record<string, unknown> }> = [];
  const stripe = {
    paymentIntents: { retrieve: async () => ({ latest_charge: "ch_123" }) },
    transfers: {
      create: async (params: Record<string, unknown>, opts: Record<string, unknown>) => {
        transfers.push({ params, opts });
        return { id: `tr_${transfers.length}` };
      },
    },
  };
  return { stripe: stripe as unknown as Stripe, transfers };
}

function spyNotify() {
  const sent: { email: string; data: Record<string, unknown> }[] = [];
  const notify = async (email: string, data: Record<string, unknown>) => {
    sent.push({ email, data });
  };
  return { notify, sent };
}

const session = (metadata: Record<string, string>, extra: Partial<Stripe.Checkout.Session> = {}) =>
  ({ id: "cs_test_1", payment_status: "paid", payment_intent: "pi_1", metadata: { type: "diy_plan", tier: "pdf", ...metadata }, ...extra }) as Stripe.Checkout.Session;

afterEach(() => {
  delete process.env.PLAN_SPLITS_ENABLED;
});

describe("processPlanSplits", () => {
  it("transfers $5 to the referring installer from the sale's charge", async () => {
    const db = fakeDb({ [REFERRER]: "acct_ref" });
    const { stripe, transfers } = fakeStripe();
    const { notify, sent } = spyNotify();
    const results = await processPlanSplits(session({ design: "H2x4t_ij.H2x2t_ij.H2x4t_ij", referral_installer_id: REFERRER }), {
      stripe,
      db: db as unknown as SupabaseClient,
      notify,
    });
    expect(results).toEqual([{ recipientId: REFERRER, cents: 500, status: "paid" }]);
    expect(transfers).toHaveLength(1);
    expect(transfers[0].params).toMatchObject({ amount: 500, destination: "acct_ref", source_transaction: "ch_123", transfer_group: "cs_test_1" });
    expect(transfers[0].opts).toEqual({ idempotencyKey: `plan-split-cs_test_1-${REFERRER}` });
    expect(Object.values(db.rows)[0]).toMatchObject({ status: "paid", stripe_transfer_id: "tr_1", reason: "referral" });
    expect(sent).toEqual([
      {
        email: `${REFERRER}@example.com`,
        data: { name: "Pat", cents: 500, reason: "referral", bestsellerNames: [], productName: "PDF Build Plan", shared: false },
      },
    ]);
  });

  it("splits $5 between the bestseller owners, and never pays twice on a webhook retry", async () => {
    const db = fakeDb({ [ELITE]: "acct_elite", [RACK_CITY]: "acct_rct" });
    const { stripe, transfers } = fakeStripe();
    const s = session({ design: "H2x4t_ij.H2x2t_ij.H2x4t_ij.H3x2wt_rcr" });
    const { notify, sent } = spyNotify();
    const first = await processPlanSplits(s, { stripe, db: db as unknown as SupabaseClient, notify });
    expect(first.map((r) => [r.recipientId, r.cents, r.status])).toEqual([
      [ELITE, 250, "paid"],
      [RACK_CITY, 250, "paid"],
    ]);
    const retry = await processPlanSplits(s, { stripe, db: db as unknown as SupabaseClient, notify });
    expect(retry.map((r) => r.status)).toEqual(["skipped", "skipped"]);
    expect(transfers).toHaveLength(2);
    // one email per paid share, naming their own bestseller; none on the retry
    expect(sent.map((m) => [m.email, m.data.cents, m.data.bestsellerNames, m.data.shared])).toEqual([
      [`${ELITE}@example.com`, 250, ["Indiana Joe"], true],
      [`${RACK_CITY}@example.com`, 250, ["The Rack City Roller"], true],
    ]);
  });

  it("records a failure when the installer has no connected Stripe account", async () => {
    const db = fakeDb({});
    const { stripe, transfers } = fakeStripe();
    const { notify, sent } = spyNotify();
    const results = await processPlanSplits(session({ design: "H3x2wt_rcr" }), { stripe, db: db as unknown as SupabaseClient, notify });
    expect(results).toEqual([{ recipientId: RACK_CITY, cents: 500, status: "failed", reason: "no_connected_stripe_account" }]);
    expect(transfers).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it("does nothing for unpaid sessions, other purchase types, plain designs, or when switched off", async () => {
    const db = fakeDb({ [ELITE]: "acct_elite" });
    const { stripe, transfers } = fakeStripe();
    const deps = { stripe, db: db as unknown as SupabaseClient, notify: spyNotify().notify };
    expect(await processPlanSplits(session({ design: "H2x4t_ij.H2x2t_ij.H2x4t_ij" }, { payment_status: "unpaid" }), deps)).toEqual([]);
    expect(await processPlanSplits(session({ type: "diy_plan_upgrade", design: "H2x4t_ij.H2x2t_ij.H2x4t_ij" }), deps)).toEqual([]);
    expect(await processPlanSplits(session({ design: "H5x7wt" }), deps)).toEqual([]);
    process.env.PLAN_SPLITS_ENABLED = "false";
    expect(await processPlanSplits(session({ design: "H2x4t_ij.H2x2t_ij.H2x4t_ij" }), deps)).toEqual([]);
    expect(transfers).toHaveLength(0);
  });
});

describe("earnings email", () => {
  it("still pays when the email can't be sent", async () => {
    const db = fakeDb({ [ELITE]: "acct_elite" });
    const { stripe } = fakeStripe();
    const results = await processPlanSplits(session({ design: "H2x4t_ij.H2x2t_ij.H2x4t_ij" }), {
      stripe,
      db: db as unknown as SupabaseClient,
      notify: async () => {
        throw new Error("mail down");
      },
    });
    expect(results.map((r) => r.status)).toEqual(["paid"]);
  });
});
