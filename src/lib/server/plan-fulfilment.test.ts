import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

vi.mock("server-only", () => ({}));

const state: { rows: Record<string, unknown>[]; emails: string[] } = { rows: [], emails: [] };

vi.mock("@/lib/emails/plansTemplates", () => ({
  sendTotePlanAccessEmail: async (email: string) => (state.emails.push(`tote:${email}`), { success: true }),
  sendLadderJigAccessEmail: async (email: string) => (state.emails.push(`jig:${email}`), { success: true }),
}));
vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: () => {
      const filters: [string, unknown][] = [];
      let pending: Record<string, unknown> | null = null;
      const find = () => state.rows.find((r) => filters.every(([k, v]) => r[k] === v)) ?? null;
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (k: string, v: unknown) => (filters.push([k, v]), q),
        maybeSingle: async () => ({ data: find() }),
        insert: (row: Record<string, unknown>) => {
          pending = row;
          return q;
        },
        single: async () => {
          if (pending) {
            if (state.rows.some((r) => r.stripe_session_id === pending!.stripe_session_id)) return { data: null, error: { code: "23505" } };
            const row = { ...pending, access_token: `tok-${state.rows.length}`, purchased_at: new Date().toISOString(), tier: pending.tier ?? null, included_from: null };
            state.rows.push(row);
            return { data: row, error: null };
          }
          return { data: find(), error: null };
        },
        update: () => q,
      };
      return q;
    },
  }),
}));

import { fulfilPlanSession } from "./plan-fulfilment";

const session = (over: Partial<Stripe.Checkout.Session> = {}) =>
  ({
    id: "cs_1",
    payment_status: "paid",
    customer_details: { email: "Buyer@Example.com", name: "Pat Lee" },
    metadata: { type: "diy_plan", design: "H4x4wt", tier: "interactive" },
    ...over,
  }) as unknown as Stripe.Checkout.Session;

beforeEach(() => {
  state.rows = [];
  state.emails = [];
});

describe("fulfilPlanSession", () => {
  it("records a paid tote plan once and emails the link once", async () => {
    const first = await fulfilPlanSession(session());
    expect(first).toMatchObject({ ok: true, created: true, email: "buyer@example.com" });
    expect(state.rows[0]).toMatchObject({ plan_id: "tote-organizer", stripe_session_id: "cs_1", customer_name: "Pat Lee" });
    // The buyer's return (or the reconcile job) after the webhook: same row, no second email
    const again = await fulfilPlanSession(session());
    expect(again).toMatchObject({ ok: true, created: false });
    expect(state.rows).toHaveLength(1);
    expect(state.emails).toEqual(["tote:buyer@example.com"]);
  });

  it("records a ladder jig", async () => {
    const r = await fulfilPlanSession(session({ id: "cs_j", metadata: { type: "ladder_jig" } }));
    expect(r).toMatchObject({ ok: true, created: true });
    expect(state.emails).toEqual(["jig:buyer@example.com"]);
  });

  it("refuses unpaid sessions and other purchase types", async () => {
    expect((await fulfilPlanSession(session({ payment_status: "unpaid" }))).ok).toBe(false);
    expect((await fulfilPlanSession(session({ metadata: { type: "booking" } }))).ok).toBe(false);
    expect(state.rows).toHaveLength(0);
    expect(state.emails).toHaveLength(0);
  });
});
