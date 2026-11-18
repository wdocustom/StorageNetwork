import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

// ── A small in-memory Supabase: enough of the query builder for the giveaway ──
type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
const UNIQUE: Record<string, string[]> = {
  public_plan_purchases: ["stripe_session_id", "access_token"],
  refund_giveaway_winners: ["entry_ref"],
};
/** Partial unique indexes on refund_giveaway_winners (rows that aren't void). */
function winnerClash(rows: Row[], row: Row): boolean {
  if (row.status === "void") return false;
  const live = rows.filter((x) => x.status !== "void");
  return live.some(
    (x) =>
      (x.draw_date === row.draw_date && String(x.email).toLowerCase() === String(row.email).toLowerCase()) ||
      (row.stripe_session_id != null && x.stripe_session_id === row.stripe_session_id)
  );
}

function from(table: string) {
  tables[table] ??= [];
  const filters: ((r: Row) => boolean)[] = [];
  let op: { kind: "select" } | { kind: "insert"; rows: Row[] } | { kind: "update"; patch: Row } | { kind: "delete" } = {
    kind: "select",
  };
  let wantRows = false;
  let order: { col: string; asc: boolean } | null = null;
  let limit = Infinity;

  const run = (): { data: Row[] | null; error: { code?: string; message: string } | null } => {
    const rows = tables[table];
    if (op.kind === "insert") {
      const made: Row[] = [];
      for (const r of op.rows) {
        const row: Row = { id: crypto.randomUUID(), ...r };
        if (table === "public_plan_purchases") row.access_token ??= crypto.randomUUID();
        if (table === "refund_giveaway_winners") {
          row.status ??= "drawn";
          row.created_at ??= new Date(Date.now() + rows.length).toISOString();
          if (winnerClash(rows, row)) return { data: null, error: { code: "23505", message: "dup" } };
        }
        for (const col of UNIQUE[table] ?? []) {
          if (row[col] != null && rows.some((x) => x[col] === row[col])) return { data: null, error: { code: "23505", message: "dup" } };
        }
        made.push(row);
      }
      rows.push(...made);
      return { data: made, error: null };
    }
    let hit = rows.filter((r) => filters.every((f) => f(r)));
    if (op.kind === "update") {
      for (const r of hit) Object.assign(r, op.patch);
      return { data: wantRows ? hit.map((r) => ({ ...r })) : null, error: null };
    }
    if (op.kind === "delete") {
      tables[table] = rows.filter((r) => !hit.includes(r));
      return { data: null, error: null };
    }
    if (order) {
      const { col, asc } = order;
      hit = [...hit].sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (asc ? 1 : -1));
    }
    return { data: hit.slice(0, limit).map((r) => ({ ...r })), error: null };
  };

  const api = {
    select: () => {
      wantRows = true;
      return api;
    },
    insert: (r: Row | Row[]) => {
      op = { kind: "insert", rows: Array.isArray(r) ? r : [r] };
      return api;
    },
    update: (patch: Row) => {
      op = { kind: "update", patch };
      return api;
    },
    delete: () => {
      op = { kind: "delete" };
      return api;
    },
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
    neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), api),
    in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), api),
    is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), api),
    lt: (k: string, v: string | number) => (filters.push((r) => r[k] != null && (r[k] as string | number) < v), api),
    gte: (k: string, v: string | number) => (filters.push((r) => r[k] != null && (r[k] as string | number) >= v), api),
    like: (k: string, pat: string) => (filters.push((r) => typeof r[k] === "string" && (r[k] as string).startsWith(pat.replace(/%$/, ""))), api),
    ilike: (k: string, v: string) => (filters.push((r) => String(r[k]).toLowerCase() === v.replace(/\\(.)/g, "$1").toLowerCase()), api),
    order: (col: string, o?: { ascending?: boolean }) => ((order = { col, asc: o?.ascending !== false }), api),
    limit: (n: number) => ((limit = n), api),
    single: async () => {
      const { data, error } = run();
      return { data: data?.[0] ?? null, error: error ?? (data?.length ? null : { message: "no rows" }) };
    },
    maybeSingle: async () => {
      const { data, error } = run();
      return { data: data?.[0] ?? null, error };
    },
    then: (resolve: (v: ReturnType<typeof run>) => void) => resolve(run()),
  };
  return api;
}


vi.mock("server-only", () => ({}));

import {
  drawWinners,
  loadEntries,
  processWinner,
  voidWinner,
  type GiveawayDeps,
  type WinnerRow,
} from "./refund-giveaway-draw";
import type { GiveawayWinnerEmail } from "@/lib/emails/giveawayTemplates";
import { REFUND_GIVEAWAY } from "@/lib/refund-giveaway";

// 2026-11-18 in Central Time (CST) runs 06:00Z Nov 18 → 06:00Z Nov 19.
const DAY = "2026-11-18";
const IN = (h: number) => new Date(Date.UTC(2026, 10, 18, 6 + h)).toISOString();

type FakeOrder = { amount: number; refunded?: boolean; disputed?: boolean; paid?: boolean };
let orders: Record<string, FakeOrder> = {};
let refunds: { payment_intent: string; key: string }[] = [];
let refundFails = false;
let sent: GiveawayWinnerEmail[] = [];

const stripe = {
  checkout: {
    sessions: {
      retrieve: async (id: string) => {
        const o = orders[id];
        if (!o) throw new Error(`No such session ${id}`);
        return {
          id,
          payment_status: o.paid === false ? "unpaid" : "paid",
          amount_total: o.amount,
          payment_intent: {
            id: `pi_${id}`,
            latest_charge: { refunded: !!o.refunded, amount_refunded: o.refunded ? o.amount : 0, disputed: !!o.disputed },
          },
        };
      },
    },
  },
  refunds: {
    create: async (p: { payment_intent: string }, opts: { idempotencyKey: string }) => {
      if (refundFails) throw new Error("Stripe is down");
      refunds.push({ payment_intent: p.payment_intent, key: opts.idempotencyKey });
      const session = p.payment_intent.replace(/^pi_/, "");
      return { id: `re_${refunds.length}`, amount: orders[session].amount };
    },
  },
} as unknown as Stripe;

const deps = (): GiveawayDeps => ({
  db: { from } as never,
  stripe,
  notify: async (p) => {
    sent.push(p);
    return { success: true };
  },
  random: () => 0, // deterministic shuffle
});

function purchase(session: string, email: string, at: string, extra: Row = {}) {
  tables.public_plan_purchases.push({
    stripe_session_id: session,
    email,
    customer_name: `${email.split("@")[0]} Buyer`,
    plan_id: "tote-organizer",
    purchased_at: at,
    included_from: null,
    gift_id: null,
    access_token: crypto.randomUUID(),
    ...extra,
  });
}

function free(email: string, source = "form") {
  tables.refund_giveaway_free_entries.push({
    id: crypto.randomUUID(),
    entry_date: DAY,
    full_name: "Free Entrant",
    email,
    source,
    created_at: IN(3),
  });
}

const original = { ...REFUND_GIVEAWAY };

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
  for (const t of ["public_plan_purchases", "plan_gift_orders", "refund_giveaway_free_entries", "refund_giveaway_winners"]) tables[t] = [];
  orders = {};
  refunds = [];
  refundFails = false;
  sent = [];
  Object.assign(REFUND_GIVEAWAY, { startDate: "2026-11-17", endDate: "2027-01-30" });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T18:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  Object.assign(REFUND_GIVEAWAY, original);
});

describe("loadEntries", () => {
  it("counts one entry per paid order that Central Time day, gift orders once, and free entries", async () => {
    purchase("cs_a", "a@x.com", IN(1));
    purchase("cs_b", "b@x.com", IN(23)); // 11:xx PM CT: still that day
    purchase("cs_late", "c@x.com", IN(24)); // midnight CT: next day
    purchase("cs_early", "d@x.com", IN(-1)); // 11 PM the day before
    purchase("included-1", "a@x.com", IN(2), { included_from: crypto.randomUUID() }); // All-Access design, not an order
    purchase("cs_g#1", "friend@x.com", IN(2), { gift_id: crypto.randomUUID() }); // a gift recipient's row
    tables.plan_gift_orders.push(
      { stripe_session_id: "cs_gift", gifter_email: "Giver@X.com", gifter_name: "Gi Ver", status: "paid", paid_at: IN(5) },
      { stripe_session_id: "cs_gift_unpaid", gifter_email: "n@x.com", gifter_name: "N N", status: "pending", paid_at: null }
    );
    free("f@x.com");

    const entries = await loadEntries({ from } as never, DAY);
    const freeId = tables.refund_giveaway_free_entries[0].id;
    expect(entries.map((e) => `${e.kind}:${e.ref}`).sort()).toEqual(
      ["free:free:" + freeId, "gift_order:cs_gift", "purchase:cs_a", "purchase:cs_b"].sort()
    );
    expect(entries.find((e) => e.kind === "gift_order")?.email).toBe("giver@x.com");
  });
});

describe("drawWinners", () => {
  it("only draws finished days inside the promotion", async () => {
    await expect(drawWinners(deps(), "2026-11-20", 1, null)).rejects.toThrow(/can't be drawn/); // today
    await expect(drawWinners(deps(), "2026-11-16", 1, null)).rejects.toThrow(/can't be drawn/); // before start
  });

  it("gives one prize per person per day and stops when entries run out", async () => {
    purchase("cs_a", "a@x.com", IN(1));
    purchase("cs_a2", "a@x.com", IN(2)); // same person, second order
    free("a@x.com");
    purchase("cs_b", "b@x.com", IN(3));
    orders = { cs_a: { amount: 1900 }, cs_a2: { amount: 1600 }, cs_b: { amount: 1900 } };

    const r = await drawWinners(deps(), DAY, 5, "admin");
    expect(r.winners.map((w) => w.email).sort()).toEqual(["a@x.com", "b@x.com"]);
    expect(r.exhausted).toBe(true);
    expect(r.winners.every((w) => w.prize === "refund" && w.status === "drawn")).toBe(true);

    const again = await drawWinners(deps(), DAY, 5, "admin");
    expect(again.winners).toHaveLength(0);
  });

  it("voids an order that was refunded or charged back since, and never draws it again", async () => {
    purchase("cs_refunded", "r@x.com", IN(1));
    purchase("cs_disputed", "d@x.com", IN(2));
    orders = { cs_refunded: { amount: 1900, refunded: true }, cs_disputed: { amount: 1900, disputed: true } };

    const r = await drawWinners(deps(), DAY, 2, null);
    expect(r.winners).toHaveLength(0);
    expect(r.voided.map((v) => v.reason).sort()).toEqual(["Already refunded", "Charged back"]);
    expect(tables.refund_giveaway_winners.every((w) => w.status === "void")).toBe(true);

    const again = await drawWinners(deps(), DAY, 2, null);
    expect(again.voided).toHaveLength(0);
  });

  it("refunds a free-entry winner's order from that day, else gives them a plans account", async () => {
    free("buyer@x.com");
    free("nobuy@x.com");
    tables.plan_gift_orders.push({ stripe_session_id: "cs_gift", gifter_email: "buyer@x.com", gifter_name: "Bu Yer", status: "paid", paid_at: IN(4) });
    orders = { cs_gift: { amount: 4500 } };

    // random() = 0 keeps the purchase entry last, so the free entries are drawn first.
    const r = await drawWinners(deps(), DAY, 2, null);
    const byEmail = Object.fromEntries(r.winners.map((w) => [w.email, w]));
    expect(byEmail["buyer@x.com"]).toMatchObject({ entry_kind: "free", prize: "refund", stripe_session_id: "cs_gift", amount_cents: 4500 });
    expect(byEmail["nobuy@x.com"]).toMatchObject({ entry_kind: "free", prize: "plans_account", stripe_session_id: null });
  });
});

describe("processWinner", () => {
  async function drawOne(): Promise<WinnerRow> {
    const r = await drawWinners(deps(), DAY, 1, null);
    return r.winners[0];
  }

  it("refunds the order once, keeps their plans link, and emails them", async () => {
    purchase("cs_a", "a@x.com", IN(1));
    orders = { cs_a: { amount: 1600 } };
    const w = await drawOne();

    const done = await processWinner(deps(), w.id);
    expect(done).toMatchObject({ status: "refunded", stripe_refund_id: "re_1", amount_cents: 1600 });
    expect(done.access_token).toBe(tables.public_plan_purchases[0].access_token);
    expect(refunds).toEqual([{ payment_intent: "pi_cs_a", key: `refund-giveaway-${w.id}` }]);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "a@x.com", prize: "refund", amountCents: 1600, drawDate: DAY });
    expect(tables.refund_giveaway_winners[0].notified_at).toBeTruthy();

    await expect(processWinner(deps(), w.id)).rejects.toThrow(/already processed/);
    expect(refunds).toHaveLength(1);
  });

  it("records a failed refund, and a retry uses the same idempotency key", async () => {
    purchase("cs_a", "a@x.com", IN(1));
    orders = { cs_a: { amount: 1900 } };
    const w = await drawOne();

    refundFails = true;
    const failed = await processWinner(deps(), w.id);
    expect(failed).toMatchObject({ status: "failed", error: "Stripe is down" });
    expect(sent).toHaveLength(0);

    refundFails = false;
    const retried = await processWinner(deps(), w.id);
    expect(retried.status).toBe("refunded");
    expect(refunds[0].key).toBe(`refund-giveaway-${w.id}`);
  });

  it("gives a free-entry winner with no purchase a lifetime plans account", async () => {
    free("new@x.com");
    const w = await drawOne();
    const done = await processWinner(deps(), w.id);
    expect(done.status).toBe("granted");
    const row = tables.public_plan_purchases.find((r) => r.stripe_session_id === `giveaway_${w.id}`);
    expect(row).toMatchObject({ email: "new@x.com", plan_id: "tote-organizer", tier: "interactive" });
    expect(done.access_token).toBe(row?.access_token);
    expect(sent[0]).toMatchObject({ prize: "plans_account", accessToken: row?.access_token });
    expect(refunds).toHaveLength(0);
  });

  it("uses the plans they already own instead of making a second account", async () => {
    purchase("cs_old", "Owner@X.com", "2026-10-01T12:00:00Z"); // bought before the promotion
    free("owner@x.com");
    const w = await drawOne();
    const done = await processWinner(deps(), w.id);
    expect(done.access_token).toBe(tables.public_plan_purchases[0].access_token);
    expect(tables.public_plan_purchases).toHaveLength(1);
  });

  it("voids only prizes not yet issued", async () => {
    purchase("cs_a", "a@x.com", IN(1));
    orders = { cs_a: { amount: 1900 } };
    const w = await drawOne();
    await processWinner(deps(), w.id);
    await expect(voidWinner({ from } as never, w.id, "x")).rejects.toThrow(/hasn't been issued/);
  });
});
