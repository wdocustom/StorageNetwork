import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks: signed-in user + a service client that serves canned rows ──────
const auth = vi.hoisted(() => ({ user: null as { id: string; email?: string } | null }));
const store = vi.hoisted(() => ({
  profiles: [] as Record<string, unknown>[],
  splits: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: async () => auth.user }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from(table: string) {
      const rows = table === "profiles" ? store.profiles : store.splits;
      const filters: ((r: Record<string, unknown>) => boolean)[] = [];
      const run = () => rows.filter((r) => filters.every((f) => f(r)));
      const q = {
        select: () => q,
        order: () => q,
        limit: () => q,
        eq: (k: string, v: unknown) => {
          filters.push((r) => r[k] === v);
          return q;
        },
        in: (k: string, vs: unknown[]) => {
          filters.push((r) => vs.includes(r[k]));
          return q;
        },
        single: async () => ({ data: run()[0] ?? null }),
        then: (resolve: (v: { data: Record<string, unknown>[] }) => void) => resolve({ data: run() }),
      };
      return q;
    },
  }),
}));

import { getMyPlanEarnings, getPlanSplitsAdmin, retryPlanSplit } from "./plan-split-earnings";

const OWNER = { id: "owner-1", email: "info@wdocustom.com" };
const OTHER_ADMIN = { id: "admin-2", email: "someone@else.com" };
const ELITE = "elite-1";

beforeEach(() => {
  store.profiles = [
    { id: OWNER.id, is_admin: true },
    { id: OTHER_ADMIN.id, is_admin: true },
    { id: ELITE, is_admin: false, business_name: "Elite Storage Systems" },
  ];
  store.splits = [
    { id: "s1", stripe_session_id: "cs_1", recipient_id: ELITE, amount_cents: 500, reason: "bestseller", bestsellers: ["indiana-joe"], status: "paid", created_at: "2026-10-20T00:00:00Z" },
    { id: "s2", stripe_session_id: "cs_2", recipient_id: ELITE, amount_cents: 250, reason: "bestseller", bestsellers: ["long-ranger"], status: "failed", created_at: "2026-10-21T00:00:00Z" },
  ];
});

describe("plan split admin — owner only", () => {
  it("shows the owner every split, totaled by installer", async () => {
    auth.user = OWNER;
    const data = await getPlanSplitsAdmin();
    expect(data?.totals).toEqual({ paidCents: 500, owedCents: 250, sales: 2, failed: 1 });
    expect(data?.byInstaller).toEqual([{ id: ELITE, name: "Elite Storage Systems", paidCents: 500, owedCents: 250, sales: 2 }]);
  });

  it("returns nothing to other admins, installers or signed-out visitors", async () => {
    for (const user of [OTHER_ADMIN, { id: ELITE, email: "elite@example.com" }, null]) {
      auth.user = user;
      expect(await getPlanSplitsAdmin()).toBeNull();
      expect(await retryPlanSplit("00000000-0000-4000-8000-000000000000")).toEqual({ ok: false, error: "Not allowed." });
    }
  });

  it("doesn't trust an owner email on a non-admin profile", async () => {
    store.profiles[0].is_admin = false;
    auth.user = OWNER;
    expect(await getPlanSplitsAdmin()).toBeNull();
  });
});

describe("installer earnings", () => {
  it("shows an installer only their own splits", async () => {
    auth.user = { id: ELITE, email: "elite@example.com" };
    const mine = await getMyPlanEarnings();
    expect(mine).toMatchObject({ paidCents: 500, owedCents: 250, sales: 2 });
    expect(mine?.recent.map((r) => r.id)).toEqual(["s1", "s2"]);
  });

  it("hides the card for accounts that never received a split", async () => {
    auth.user = OTHER_ADMIN;
    expect(await getMyPlanEarnings()).toBeNull();
    auth.user = null;
    expect(await getMyPlanEarnings()).toBeNull();
  });
});
