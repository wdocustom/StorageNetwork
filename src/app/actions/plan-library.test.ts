import { describe, expect, it, vi } from "vitest";

const rows = [
  { access_token: "11111111-1111-4111-8111-111111111111", email: "jo@example.com", plan_id: "tote-organizer", tier: "pdf", build_config: { units: [{ cols: 4, rows: 4, toteType: "HDX", hasWheels: true, hasTop: true }] }, purchased_at: "2026-10-01T00:00:00Z" },
  { access_token: "22222222-2222-4222-8222-222222222222", email: "jo@example.com", plan_id: "adirondack-chair", tier: null, build_config: null, purchased_at: "2026-09-01T00:00:00Z" },
  { access_token: "33333333-3333-4333-8333-333333333333", email: "someone-else@example.com", plan_id: "tote-organizer", tier: "interactive", build_config: { units: [{ cols: 2, rows: 2, toteType: "GM" }] }, purchased_at: "2026-10-02T00:00:00Z" },
];

function query() {
  const filters: [string, unknown][] = [];
  const match = () => rows.filter((r) => filters.every(([c, v]) => (r as Record<string, unknown>)[c] === v));
  const api = {
    select: () => api,
    eq: (c: string, v: unknown) => (filters.push([c, v]), api),
    order: () => Promise.resolve({ data: match() }),
    maybeSingle: async () => ({ data: match()[0] ?? null }),
  };
  return api;
}
vi.mock("@/lib/supabase-server", () => ({ getServiceClient: () => ({ from: () => query() }) }));

import { listMyPlans } from "./plan-library";

describe("My Builds", () => {
  it("lists only this buyer's purchases, each opening with its own token", async () => {
    const res = await listMyPlans("22222222-2222-4222-8222-222222222222");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.emailHint).toBe("jo•••@example.com");
    expect(res.items.map((i) => i.href)).toEqual([
      "/plans/build?token=11111111-1111-4111-8111-111111111111",
      "/plans/access?token=22222222-2222-4222-8222-222222222222",
    ]);
    expect(res.items[0]).toMatchObject({ kind: "tote", title: "4×4 Tote Organizer", badge: "PDF Build Plan" });
    expect(res.jigOffer).toEqual({ href: "/plans/jig?owner=11111111-1111-4111-8111-111111111111", price: 500 });
  });

  it("rejects unknown or malformed tokens", async () => {
    expect((await listMyPlans("99999999-9999-4999-8999-999999999999")).ok).toBe(false);
    expect((await listMyPlans("abc")).ok).toBe(false);
  });
});
