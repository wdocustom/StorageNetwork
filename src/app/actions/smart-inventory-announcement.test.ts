import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state: { purchases: Record<string, unknown>[]; owners: string[]; campaign: { email: string }[]; sent: string[] } = {
  purchases: [],
  owners: [],
  campaign: [],
  sent: [],
};

vi.mock("@/lib/emails/plansTemplates", () => ({
  sendSmartInventoryAnnouncementEmail: async (email: string) => {
    state.sent.push(email);
    return { success: true };
  },
}));
vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: (table: string) => {
      const filters: ((r: Record<string, unknown>) => boolean)[] = [];
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (k: string, v: unknown) => (table === "public_plan_purchases" && k !== "plan_id" && filters.push((r) => r[k] === v), q),
        is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
        lt: (k: string, v: string) => (filters.push((r) => String(r[k]) < v), q),
        order: () => q,
        delete: () => q,
        insert: async (row: { email: string }) => {
          if (state.campaign.some((c) => c.email === row.email)) return { error: { message: "duplicate" } };
          state.campaign.push(row);
          return { error: null };
        },
        then: (res: (v: unknown) => unknown) =>
          res({
            data:
              table === "public_plan_purchases"
                ? state.purchases.filter((r) => filters.every((f) => f(r)))
                : table === "diy_inventory_access"
                  ? state.owners.map((email) => ({ email }))
                  : state.campaign,
            error: null,
          }),
      };
      return q;
    },
  }),
}));

import { processSmartInventoryAnnouncement } from "./smart-inventory-announcement";

const unit = { units: [{ cols: 4, rows: 4, toteType: "HDX", hasWheels: true, hasTop: true }] };

const NOW = Date.parse("2026-11-20T15:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86400000).toISOString();

beforeEach(() => {
  state.purchases = [
    { email: "A@x.com", access_token: "t-new", build_config: unit, purchased_at: daysAgo(4.5) },
    { email: "a@x.com", access_token: "t-old", build_config: unit, purchased_at: daysAgo(19) },
    { email: "owner@x.com", access_token: "t2", build_config: unit, purchased_at: daysAgo(18) },
    { email: "b@x.com", access_token: "t3", build_config: unit, purchased_at: daysAgo(17) },
    // Bought 2 days ago: not yet.
    { email: "fresh@x.com", access_token: "t4", build_config: unit, purchased_at: daysAgo(2) },
    // A plan built free under All-Access isn't a purchase.
    { email: "free@x.com", access_token: "t5", build_config: unit, purchased_at: daysAgo(10), included_from: "t3" },
  ];
  state.owners = ["Owner@x.com"];
  state.campaign = [];
  state.sent = [];
});

describe("Smart Inventory follow-up", () => {
  it("emails each buyer once, 4+ days after buying, skipping owners, and never repeats", async () => {
    const first = await processSmartInventoryAnnouncement(NOW);
    expect(state.sent.sort()).toEqual(["a@x.com", "b@x.com"]);
    expect(first.sent).toBe(2);
    const again = await processSmartInventoryAnnouncement(NOW);
    expect(again.sent).toBe(0);
    expect(state.sent).toHaveLength(2);
  });

  it("waits until the buyer is 4 days past their purchase", async () => {
    await processSmartInventoryAnnouncement(NOW);
    expect(state.sent).not.toContain("fresh@x.com");
    // Daily runs: at exactly 4 days it's not past due yet; the next run sends
    // it, so it always lands 4–5 days after buying.
    await processSmartInventoryAnnouncement(NOW + 2 * 86400000);
    expect(state.sent).not.toContain("fresh@x.com");
    await processSmartInventoryAnnouncement(NOW + 3 * 86400000);
    expect(state.sent).toContain("fresh@x.com");
    expect(state.sent.filter((e) => e === "fresh@x.com")).toHaveLength(1);
  });

  it("skips plans built free under All-Access", async () => {
    await processSmartInventoryAnnouncement(NOW + 30 * 86400000);
    expect(state.sent).not.toContain("free@x.com");
  });
});
