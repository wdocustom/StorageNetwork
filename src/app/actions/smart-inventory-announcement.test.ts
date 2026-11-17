import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ── In-memory tables ─────────────────────────────────────────────────────────
type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const sent: string[] = [];

function from(table: string) {
  db[table] ??= [];
  const filters: ((r: Row) => boolean)[] = [];
  let op: "select" | "delete" = "select";
  let limit = Infinity;
  const rows = () => db[table].filter((r) => filters.every((f) => f(r)));
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
    neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), q),
    is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
    in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
    lt: (k: string, v: string) => (filters.push((r) => String(r[k]) < v), q),
    order: () => q,
    limit: (n: number) => ((limit = n), q),
    delete: () => ((op = "delete"), q),
    insert: async (row: Row) => {
      if (table === "plan_buyer_campaigns" && db[table].some((c) => c.email === row.email && c.campaign === row.campaign)) {
        return { error: { code: "23505", message: "duplicate" } };
      }
      db[table].push({ sent_at: new Date(clock).toISOString(), ...row });
      return { error: null };
    },
    then: (res: (v: unknown) => unknown) => {
      if (op === "delete") {
        const gone = rows();
        db[table] = db[table].filter((r) => !gone.includes(r));
        return res({ error: null });
      }
      return res({ data: rows().slice(0, limit), error: null });
    },
  };
  return q;
}

let clock = Date.parse("2026-11-20T15:00:00Z");
vi.mock("@/lib/supabase-server", () => ({ getServiceClient: () => ({ from }) }));
vi.mock("@/lib/emails/plansTemplates", () => ({
  sendSmartInventoryAnnouncementEmail: async (email: string) => {
    sent.push(email);
    return { success: true };
  },
}));

import { processSmartInventoryAnnouncement } from "./smart-inventory-announcement";
import { queueSmartInventoryFollowUp } from "@/lib/server/smart-inventory-follow-up";

const DAY = 86400000;
const unit = { units: [{ cols: 4, rows: 4, toteType: "HDX", hasWheels: true, hasTop: true }] };
const purchase = (email: string, token: string, daysAgo: number, extra: Row = {}) =>
  db.public_plan_purchases.push({
    email,
    access_token: token,
    plan_id: "tote-organizer",
    build_config: unit,
    purchased_at: new Date(clock - daysAgo * DAY).toISOString(),
    included_from: null,
    ...extra,
  });

/** A new buyer as fulfilment records them: purchase row, then queue (at that time). */
async function newBuyer(email: string, token: string, daysAgo: number) {
  purchase(email, token, daysAgo);
  const now = clock;
  clock -= daysAgo * DAY;
  await queueSmartInventoryFollowUp(email, token);
  clock = now;
}

beforeEach(() => {
  clock = Date.parse("2026-11-20T15:00:00Z");
  for (const k of Object.keys(db)) delete db[k];
  db.public_plan_purchases = [];
  db.diy_inventory_access = [];
  db.plan_buyer_campaigns = [];
  sent.length = 0;
});

describe("Smart Inventory follow-up", () => {
  it("emails a new buyer once, 4–5 days after buying", async () => {
    await newBuyer("jo@x.com", "t1", 2);
    await processSmartInventoryAnnouncement(clock);
    expect(sent).toEqual([]); // 2 days: not yet
    await processSmartInventoryAnnouncement(clock + 2 * DAY);
    expect(sent).toEqual([]); // exactly 4 days: next run
    await processSmartInventoryAnnouncement(clock + 3 * DAY);
    expect(sent).toEqual(["jo@x.com"]);
    await processSmartInventoryAnnouncement(clock + 10 * DAY);
    expect(sent).toEqual(["jo@x.com"]); // never again
  });

  it("never emails buyers whose purchase email already pitched it (bought before the queue existed)", async () => {
    purchase("early@x.com", "t-early", 1); // recorded by the old code: never queued
    await processSmartInventoryAnnouncement(clock + 30 * DAY);
    expect(sent).toEqual([]);
  });

  it("never re-emails the earlier buyers who got the Nov 16 announcement", async () => {
    db.plan_buyer_campaigns.push({ email: "told@x.com", campaign: "smart_inventory_nov2026", sent_at: "2026-11-16T15:00:00Z" });
    purchase("told@x.com", "t-old", 20);
    // Even if they buy again now, they aren't queued (an earlier purchase exists)…
    await newBuyer("told@x.com", "t-new", 6);
    // …and the campaign row would stop it anyway.
    await processSmartInventoryAnnouncement(clock);
    expect(sent).toEqual([]);
  });

  it("doesn't queue a repeat buyer (their first purchase email told them)", async () => {
    purchase("repeat@x.com", "t-first", 10);
    await queueSmartInventoryFollowUp("repeat@x.com", "t-second");
    expect(db.plan_buyer_campaigns).toEqual([]);
  });

  it("skips buyers who already own Smart Inventory", async () => {
    await newBuyer("owner@x.com", "t2", 6);
    db.diy_inventory_access.push({ email: "owner@x.com" });
    await processSmartInventoryAnnouncement(clock);
    expect(sent).toEqual([]);
  });
});
