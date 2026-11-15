import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const PLAN_TOKEN = "11111111-1111-4111-8111-111111111111";
const EMAIL = "pat@example.com";

const state: {
  purchases: Record<string, unknown>[];
  racks: Record<string, unknown>[];
  access: boolean;
  inserted: Record<string, unknown>[];
  deviceOk: boolean;
  user: { id: string; email?: string } | null;
  free: boolean;
} = { purchases: [], racks: [], access: false, inserted: [], deviceOk: true, user: null, free: false };

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: async () => state.user }));
vi.mock("@/app/actions/diy-plan-checkout", () => ({ checkDIYPlanAccess: async () => ({ hasFreeAccess: state.free, reason: state.free ? "admin" : undefined }) }));

vi.mock("@/lib/server/plan-device", () => ({
  checkPlanDevice: async () => (state.deviceOk ? { ok: true } : { ok: false, emailHint: "pa•••@example.com" }),
}));
vi.mock("@/lib/server/diy-inventory", () => ({
  hasDiyInventory: async () => state.access,
  grantDiyInventory: async () => {},
}));
vi.mock("@/lib/server/action-rate-limit", () => ({ enforceActionRateLimit: async () => {}, RateLimitError: class extends Error {} }));
vi.mock("@/lib/stripe/embedded-checkout", () => ({ FINAL_SALE_TEXT: {}, createEmbeddedCheckoutSession: async () => ({ client_secret: "cs_secret" }) }));
vi.mock("stripe", () => ({ default: class {} }));
vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: (table: string) => {
      const filters: [string, unknown][] = [];
      let head = false;
      const rows = () => {
        const src =
          table === "public_plan_purchases"
            ? state.purchases
            : table === "inventory_racks"
              ? state.racks
              : table === "profiles"
                ? [{ id: "admin-1", email: "Owner@Example.com" }]
                : [];
        return src.filter((r) => filters.every(([k, v]) => r[k] === v));
      };
      const q: Record<string, unknown> = {
        select: (_c?: string, o?: { head?: boolean }) => ((head = !!o?.head), q),
        eq: (k: string, v: unknown) => (filters.push([k, v]), q),
        in: () => q,
        order: () => q,
        maybeSingle: async () => ({ data: rows()[0] ?? null }),
        insert: (row: Record<string, unknown>) => {
          state.inserted.push(row);
          return { select: () => ({ single: async () => ({ data: { access_token: "abcdef0123456789abcdef0123456789" }, error: null }) }) };
        },
        then: (res: (v: unknown) => unknown) =>
          res(head ? { count: rows().length } : table === "inventory_slots" ? { data: [] } : { data: rows() }),
      };
      return q;
    },
  }),
}));

import { addDiyRack, getDiyInventory } from "./diy-inventory";

beforeEach(() => {
  state.purchases = [
    { access_token: PLAN_TOKEN, email: EMAIL, plan_id: "tote-organizer", purchased_at: "2026-11-10", build_config: { units: [{ cols: 4, rows: 4, toteType: "HDX", hasWheels: true, hasTop: true }, { cols: 4, rows: 2, toteType: "HDX", hasWheels: false, hasTop: false }] } },
  ];
  state.racks = [];
  state.access = false;
  state.inserted = [];
  state.deviceOk = true;
  state.user = null;
  state.free = false;
});

describe("Smart Inventory for DIY buyers", () => {
  it("needs the add-on before racks can be added", async () => {
    expect(await addDiyRack({ token: PLAN_TOKEN }, { label: "Garage", cols: 4, rows: 4 })).toEqual({ ok: false, error: "Add Smart Inventory first." });
    expect(state.inserted).toHaveLength(0);
  });

  it("adds any size within limits, as a DIY rack on the buyer's email", async () => {
    state.access = true;
    const r = await addDiyRack({ token: PLAN_TOKEN }, { label: "  Garage   wall ", cols: 4, rows: 2, hasWheels: true });
    expect(r.ok).toBe(true);
    expect(state.inserted[0]).toMatchObject({ customer_email: EMAIL, label: "Garage wall", cols: 4, rows: 2, has_wheels: true, source: "diy" });
    expect((await addDiyRack({ token: PLAN_TOKEN }, { label: "x", cols: 25, rows: 2 })).ok).toBe(false);
    expect((await addDiyRack({ token: PLAN_TOKEN }, { label: "x", cols: 4, rows: 0 })).ok).toBe(false);
  });

  it("suggests the racks from their plans that they haven't added yet", async () => {
    state.access = true;
    state.racks = [{ id: "r1", access_token: "t1", label: "Garage", cols: 4, rows: 4, has_wheels: true, customer_email: EMAIL, created_at: "2026-11-11" }];
    const r = await getDiyInventory({ token: PLAN_TOKEN });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.hasAccess).toBe(true);
    expect(r.racks).toHaveLength(1);
    expect(r.suggestions.map((s) => `${s.cols}x${s.rows}`)).toEqual(["4x2"]);
  });

  it("asks a new device to confirm, and rejects bad links", async () => {
    state.deviceOk = false;
    const r = await getDiyInventory({ token: PLAN_TOKEN });
    expect(r.ok === false && r.verify?.token).toBe(PLAN_TOKEN);
    expect((await getDiyInventory({ token: "nope" })).ok).toBe(false);
    expect((await getDiyInventory({ rack: "not-hex!" })).ok).toBe(false);
  });

  it("opens a rack's hub only for DIY racks", async () => {
    state.racks = [
      { access_token: "a".repeat(32), customer_email: EMAIL, source: "diy" },
      { access_token: "b".repeat(32), customer_email: EMAIL, source: null },
    ];
    expect((await getDiyInventory({ rack: "a".repeat(32) })).ok).toBe(true);
    expect((await getDiyInventory({ rack: "b".repeat(32) })).ok).toBe(false);
  });

  it("is included for a signed-in admin / Pro, and refused for anyone else signed in", async () => {
    state.user = { id: "admin-1" };
    state.free = true;
    const r = await getDiyInventory({ account: true });
    expect(r.ok && r.hasAccess && r.included).toBe(true);
    const added = await addDiyRack({ account: true }, { label: "Test rack", cols: 2, rows: 2 });
    expect(added.ok).toBe(true);
    expect(state.inserted[0]).toMatchObject({ customer_email: "owner@example.com", source: "diy" });

    state.free = false;
    expect((await getDiyInventory({ account: true })).ok).toBe(false);
    state.user = null;
    expect((await getDiyInventory({ account: true })).ok).toBe(false);
  });
});
