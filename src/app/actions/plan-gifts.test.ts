import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

// Checkout pricing for gift orders: the server prices from the volume table,
// as one line, with nothing else stacked on.

const { sessions, inserts } = vi.hoisted(() => ({
  sessions: [] as Stripe.Checkout.SessionCreateParams[],
  inserts: [] as { table: string; row: unknown }[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/action-rate-limit", () => ({ enforceActionRateLimit: async () => {}, RateLimitError: class extends Error {} }));
vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: async () => null }));
vi.mock("@/app/actions/promoter-program", () => ({ resolvePromoterAttributionForCheckout: async () => null }));
vi.mock("@/config/site", () => ({ siteConfig: { baseUrl: "https://x.test" } }));
vi.mock("@/lib/server/plan-gifts", () => ({ GIFT_SESSION_TYPE: "diy_plan_gift" }));
vi.mock("stripe", () => ({ default: class {} }));
vi.mock("@/lib/stripe/embedded-checkout", () => ({
  FINAL_SALE_TEXT: { submit: { message: "final" } },
  createEmbeddedCheckoutSession: async (_s: unknown, params: Stripe.Checkout.SessionCreateParams) => {
    sessions.push(params);
    return { id: "cs_test", client_secret: "secret" };
  },
}));
vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: (table: string) => {
      const api = {
        insert: (row: unknown) => {
          inserts.push({ table, row });
          return Object.assign(Promise.resolve({ error: null }), {
            select: () => ({ single: async () => ({ data: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }, error: null }) }),
          });
        },
        update: () => ({ eq: async () => ({ error: null }) }),
        delete: () => ({ eq: async () => ({ error: null }) }),
      };
      return api;
    },
  }),
}));

import { createGiftCheckout } from "./plan-gifts";

const order = (n: number) => ({
  gifterName: "Grandma",
  gifterEmail: "grandma@example.com",
  message: "",
  acknowledged: true,
  recipients: Array.from({ length: n }, (_, i) => ({ name: `Grandkid ${i + 1}`, email: `kid${i + 1}@example.com` })),
});

beforeEach(() => {
  sessions.length = 0;
  inserts.length = 0;
});

describe("createGiftCheckout pricing", () => {
  it.each([
    [1, 1900],
    [2, 3800],
    [3, 4500],
    [5, 6900],
    [7, 8500],
    [8, 8800],
    [10, 11000],
  ])("%i gifts charge %i cents, as one line", async (n, cents) => {
    const res = await createGiftCheckout(order(n));
    expect(res.ok).toBe(true);
    const params = sessions[0];
    expect(params.line_items).toHaveLength(1);
    expect(params.line_items![0]).toMatchObject({ quantity: 1, price_data: { unit_amount: cents, currency: "usd" } });
    // Nothing else can stack on the volume price.
    expect(params.allow_promotion_codes).toBeUndefined();
    expect(params.discounts).toBeUndefined();
    const saved = inserts.find((i) => i.table === "plan_gift_orders")?.row as { amount_cents: number; quantity: number };
    expect(saved).toMatchObject({ amount_cents: cents, quantity: n });
  });

  it("ignores any price the browser sends", async () => {
    const res = await createGiftCheckout({ ...order(3), amount: 1, price: 1, total: 1 });
    expect(res.ok).toBe(true);
    expect(sessions[0].line_items![0].price_data?.unit_amount).toBe(4500);
  });

  it("names the bundle on the receipt line", async () => {
    await createGiftCheckout(order(5));
    expect(sessions[0].line_items![0].price_data?.product_data?.name).toContain("× 5 (Bundle of 5)");
    expect(sessions[0].line_items![0].price_data?.product_data?.description).toContain("$69 instead of $95");
  });
});
