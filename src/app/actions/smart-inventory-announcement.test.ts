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
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        lt: () => q,
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
                ? state.purchases
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

beforeEach(() => {
  state.purchases = [
    { email: "A@x.com", access_token: "t-new", build_config: unit, purchased_at: "2026-11-15" },
    { email: "a@x.com", access_token: "t-old", build_config: unit, purchased_at: "2026-11-01" },
    { email: "owner@x.com", access_token: "t2", build_config: unit, purchased_at: "2026-11-02" },
    { email: "b@x.com", access_token: "t3", build_config: unit, purchased_at: "2026-11-03" },
  ];
  state.owners = ["Owner@x.com"];
  state.campaign = [];
  state.sent = [];
});

describe("Smart Inventory announcement", () => {
  it("emails each earlier buyer once, skipping owners, and never repeats", async () => {
    const first = await processSmartInventoryAnnouncement();
    expect(state.sent.sort()).toEqual(["a@x.com", "b@x.com"]);
    expect(first.sent).toBe(2);
    const again = await processSmartInventoryAnnouncement();
    expect(again.sent).toBe(0);
    expect(state.sent).toHaveLength(2);
  });
});
