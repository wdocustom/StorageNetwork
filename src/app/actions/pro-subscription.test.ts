import { beforeEach, describe, expect, it, vi } from "vitest";

const promo = vi.hoisted(() => ({ on: true, user: { id: "inst-1" } as { id: string } | null }));
vi.mock("@/config/pro-pricing", () => ({
  get PRO_FREE_PROMO() {
    return promo.on;
  },
  PRO_MONTHLY_PRICE: 49,
}));
vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: async () => promo.user }));
vi.mock("@/lib/email", () => ({
  sendWaitlistedLeadsUnlocked: vi.fn(async () => {}),
  sendWaitlistedLeadPaymentReady: vi.fn(async () => {}),
}));
vi.mock("@/lib/emails/plansTemplates", () => ({ diyPlansEmailUrl: () => null }));
vi.mock("@/app/actions/fee-engine", () => ({ getDepositAmount: async () => 40 }));
vi.mock("stripe", () => ({ default: class {} }));

// ── In-memory profiles + leads ───────────────────────────────────────────
type Row = Record<string, unknown>;
let profiles: Row[];
let leads: Row[];

function table(name: string) {
  const rows = name === "profiles" ? profiles : leads;
  let patch: Row | null = null;
  const filters: ((r: Row) => boolean)[] = [];
  const hits = () => rows.filter((r) => filters.every((f) => f(r)));
  const b: Record<string, unknown> = {
    select: () => b,
    update: (p: Row) => ((patch = p), b),
    eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
    neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), b),
    single: async () => ({ data: hits()[0] ?? null }),
    maybeSingle: async () => ({ data: hits()[0] ?? null }),
    then: (resolve: (v: unknown) => unknown) => {
      if (patch) hits().forEach((r) => Object.assign(r, patch));
      return resolve(patch ? { error: null } : { data: hits() });
    },
  };
  return b;
}
vi.mock("@/lib/supabase-server", () => ({ getServiceClient: () => ({ from: table }) }));

import { activateFreePro, createProCheckoutSession, deactivateProSubscription } from "./pro-subscription";

const installer = (over: Row = {}): Row => ({
  id: "inst-1",
  is_pro: false,
  slug: null,
  business_name: "Rack City Totes",
  first_name: "Bob",
  last_name: "Lynch",
  service_zips: ["68102"],
  stripe_subscription_id: null,
  pro_comped: false,
  pro_trial_ends_at: null,
  email: "bob@example.com",
  ...over,
});

beforeEach(() => {
  promo.on = true;
  promo.user = { id: "inst-1" };
  profiles = [installer()];
  leads = [];
});

describe("activateFreePro", () => {
  it("turns Pro on with a slug and a trial clock, no Stripe", async () => {
    expect(await activateFreePro()).toEqual({ success: true });
    expect(profiles[0]).toMatchObject({ is_pro: true, slug: "rack-city-totes" });
    expect(profiles[0].pro_trial_ends_at).toBeTruthy();
  });

  it("releases customers who were waiting on the installer", async () => {
    leads = [{ id: "l1", installer_id: "inst-1", status: "waitlisted", customer_email: "c@example.com", estimated_price: 268 }];
    await activateFreePro();
    expect(leads[0].status).toBe("pending_payment");
  });

  it("is for installers only", async () => {
    profiles = [installer({ service_zips: null })];
    expect((await activateFreePro()).success).toBe(false);
    expect(profiles[0].is_pro).toBe(false);
  });

  it("doesn't touch paying subscribers", async () => {
    profiles = [installer({ is_pro: true, stripe_subscription_id: "sub_1" })];
    expect(await activateFreePro()).toEqual({ success: true });
    expect(profiles[0].pro_trial_ends_at).toBeNull();
  });

  it("needs a signed-in user, and the promo", async () => {
    promo.user = null;
    expect((await activateFreePro()).success).toBe(false);
    promo.user = { id: "inst-1" };
    promo.on = false;
    expect(await activateFreePro()).toEqual({ success: false, error: "Free Pro has ended." });
  });

  it("skips Stripe checkout while Pro is free", async () => {
    expect((await createProCheckoutSession("inst-1")).success).toBe(false);
  });
});

describe("deactivateProSubscription", () => {
  it("keeps Pro on when a subscriber cancels during the promo", async () => {
    profiles = [installer({ is_pro: true, stripe_subscription_id: "sub_1" })];
    await deactivateProSubscription("inst-1");
    expect(profiles[0]).toMatchObject({ is_pro: true, stripe_subscription_id: null });
    expect(profiles[0].pro_trial_ends_at).toBeTruthy();
  });

  it("suspends as before once the promo is off", async () => {
    promo.on = false;
    profiles = [installer({ is_pro: true, stripe_subscription_id: "sub_1" })];
    await deactivateProSubscription("inst-1");
    expect(profiles[0]).toMatchObject({ is_pro: false, stripe_subscription_id: null });
  });
});
