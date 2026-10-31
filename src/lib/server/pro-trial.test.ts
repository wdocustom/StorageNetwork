import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const promo = vi.hoisted(() => ({ on: true }));
vi.mock("@/config/pro-pricing", () => ({
  get PRO_FREE_PROMO() {
    return promo.on;
  },
}));

// ── In-memory profiles + leads ───────────────────────────────────────────
type Row = Record<string, unknown>;
let profiles: Row[];
let leads: Row[];

function table(name: string) {
  const rows = name === "profiles" ? profiles : leads;
  let patch: Row | null = null;
  let head = false;
  const filters: ((r: Row) => boolean)[] = [];
  const hits = () => rows.filter((r) => filters.every((f) => f(r)));
  const b: Record<string, unknown> = {
    select: (_c?: string, o?: { head?: boolean }) => ((head = !!o?.head), b),
    update: (p: Row) => ((patch = p), b),
    eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
    neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), b),
    in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b),
    single: async () => ({ data: hits()[0] ?? null }),
    maybeSingle: async () => ({ data: hits()[0] ?? null }),
    then: (resolve: (v: unknown) => unknown) => {
      if (patch) {
        hits().forEach((r) => Object.assign(r, patch));
        return resolve({ error: null });
      }
      return resolve(head ? { count: hits().length } : { data: hits() });
    },
  };
  return b;
}
vi.mock("@/lib/supabase-server", () => ({ getServiceClient: () => ({ from: table }) }));

import { checkProTrial } from "./pro-trial";

const DAY = 86_400_000;
const installer = (over: Row = {}): Row => ({
  id: "inst-1",
  is_pro: true,
  slug: "rack-city",
  business_name: "Rack City Totes",
  first_name: "Bob",
  stripe_subscription_id: null,
  pro_trial_partner: null,
  pro_trial_ends_at: new Date(Date.now() - 60 * DAY).toISOString(), // long expired
  ...over,
});
const paidJobs = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `l${i}`, installer_id: "inst-1", deposit_paid: true, status: "paid" }));

beforeEach(() => {
  promo.on = true;
  profiles = [installer()];
  leads = paidJobs(5);
});

describe("checkProTrial while Pro is free", () => {
  it("never caps or expires a trial — even one long past its 45 days and 3 jobs", async () => {
    const t = await checkProTrial("inst-1");
    expect(t).toMatchObject({ freePro: true, onTrial: false, trialExpired: false, softLocked: false, jobCapReached: false });
    expect(profiles[0].is_pro).toBe(true);
    // Trial clock kept, so ending the promo resumes the normal flow
    expect(profiles[0].pro_trial_ends_at).toBeTruthy();
  });

  it("turns Pro back on (with a slug) for a trial installer who had lost it", async () => {
    profiles = [installer({ is_pro: false, slug: null })];
    await checkProTrial("inst-1");
    expect(profiles[0]).toMatchObject({ is_pro: true, slug: "rack-city-totes" });
  });

  it("leaves paying subscribers alone", async () => {
    profiles = [installer({ stripe_subscription_id: "sub_1" })];
    const t = await checkProTrial("inst-1");
    expect(t.freePro).toBeUndefined();
    expect(profiles[0].pro_trial_ends_at).toBeNull();
  });
});

describe("checkProTrial after the promo ends", () => {
  it("suspends an expired trial again", async () => {
    promo.on = false;
    leads = [];
    const t = await checkProTrial("inst-1");
    expect(t).toMatchObject({ trialExpired: true, softLocked: false });
    expect(profiles[0].is_pro).toBe(false);
  });

  it("caps a live trial at 3 jobs again", async () => {
    promo.on = false;
    profiles = [installer({ pro_trial_ends_at: new Date(Date.now() + 10 * DAY).toISOString() })];
    const t = await checkProTrial("inst-1");
    expect(t).toMatchObject({ onTrial: true, jobCapReached: true, jobsRemaining: 0 });
  });
});
