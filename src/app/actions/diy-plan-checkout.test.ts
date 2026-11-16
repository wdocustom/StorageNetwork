import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

// One offer per checkout, priced on the server: a retention offer (save3, or
// save5 on an old link) OR the FRIDAY code, which is once per email and locks
// that email at Stripe.

const { sessions, fridayUsers } = vi.hoisted(() => ({
  sessions: [] as Stripe.Checkout.SessionCreateParams[],
  fridayUsers: new Set<string>(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/server/action-rate-limit", () => ({ enforceActionRateLimit: async () => {}, RateLimitError: class extends Error {} }));
vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: async () => null }));
vi.mock("@/app/actions/promoter-program", () => ({ resolvePromoterAttributionForCheckout: async () => null }));
vi.mock("@/config/site", () => ({ siteConfig: { baseUrl: "https://x.test" } }));
vi.mock("stripe", () => ({ default: class {} }));
vi.mock("@/lib/stripe/embedded-checkout", () => ({
  FINAL_SALE_TEXT: { submit: { message: "All sales are final." } },
  createEmbeddedCheckoutSession: async (_s: unknown, params: Stripe.Checkout.SessionCreateParams) => {
    sessions.push(params);
    return { id: `cs_${sessions.length}`, client_secret: "secret" };
  },
}));
vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      const api = {
        select: () => api,
        eq: (k: string, v: unknown) => ((filters[k] = v), api),
        limit: async () => ({
          data:
            table === "public_plan_purchases" && filters.offer_code === "friday" && fridayUsers.has(filters.email as string)
              ? [{ access_token: "x" }]
              : [],
          error: null,
        }),
        maybeSingle: async () => ({ data: null, error: null }),
        insert: async () => ({ error: null }),
      };
      return api;
    },
  }),
}));

import { checkPlanPromo, createDIYPlanCheckout } from "./diy-plan-checkout";

const design = { units: [{ cols: 4, rows: 4, toteType: "HDX", hasWheels: true, hasTop: true }] };
const charged = () => sessions.at(-1)!.line_items![0].price_data!.unit_amount;

beforeEach(() => {
  sessions.length = 0;
  fridayUsers.clear();
});

describe("retention offer", () => {
  it("is $3 off now, $5 off on old links, $19 otherwise", async () => {
    await createDIYPlanCheckout(design, "t", null, null, "save3");
    expect(charged()).toBe(1600);
    expect(sessions.at(-1)!.metadata).toMatchObject({ offer: "save3" });
    await createDIYPlanCheckout(design, "t", null, null, "save5");
    expect(charged()).toBe(1400);
    await createDIYPlanCheckout(design, "t", null, null, "bogus");
    expect(charged()).toBe(1900);
    expect(sessions.at(-1)!.metadata?.offer).toBeUndefined();
  });
});

describe("FRIDAY", () => {
  it("checks the code (any case) and the email", async () => {
    expect(await checkPlanPromo(" Friday ", "Jo@Example.com")).toMatchObject({ ok: true, code: "friday", price: 1400, email: "jo@example.com" });
    expect(await checkPlanPromo("SATURDAY", "jo@example.com")).toMatchObject({ ok: false, field: "code" });
    expect(await checkPlanPromo("friday", "not-an-email")).toMatchObject({ ok: false, field: "email" });
    expect(await checkPlanPromo("", "jo@example.com")).toMatchObject({ ok: false, field: "code" });
  });

  it("takes $5 off and locks the email it was checked for", async () => {
    const res = await createDIYPlanCheckout(design, "t", null, null, "FRIDAY", "Jo@Example.com");
    expect(res.success).toBe(true);
    expect(charged()).toBe(1400);
    const params = sessions.at(-1)!;
    expect(params.customer_email).toBe("jo@example.com");
    expect(params.metadata).toMatchObject({ offer: "friday" });
    expect(JSON.stringify(params.custom_text)).toContain("FRIDAY applied");
  });

  it("is once per email", async () => {
    fridayUsers.add("jo@example.com");
    expect(await checkPlanPromo("friday", "jo@example.com")).toMatchObject({ ok: false, field: "code" });
    const res = await createDIYPlanCheckout(design, "t", null, null, "friday", "JO@example.com");
    expect(res).toMatchObject({ success: false });
    expect(sessions).toHaveLength(0);
    // Someone else can still use it.
    expect((await createDIYPlanCheckout(design, "t", null, null, "friday", "sam@example.com")).success).toBe(true);
  });

  it("needs the email: no email, no discount and no checkout", async () => {
    const res = await createDIYPlanCheckout(design, "t", null, null, "friday");
    expect(res).toMatchObject({ success: false });
    expect(sessions).toHaveLength(0);
  });

  it("is never combined with the retention offer (one offer per checkout)", async () => {
    await createDIYPlanCheckout(design, "t", null, null, "friday", "jo@example.com");
    expect(charged()).toBe(1400); // $19 - $5, not $19 - $5 - $3
    expect(sessions.at(-1)!.metadata?.offer).toBe("friday");
    expect(sessions.at(-1)!.allow_promotion_codes).toBeUndefined();
    expect(sessions.at(-1)!.discounts).toBeUndefined();
  });
});
