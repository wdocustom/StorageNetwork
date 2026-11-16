import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

// ── A small in-memory Supabase: enough of the query builder for plan-gifts ──
type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
const UNIQUE: Record<string, string[]> = {
  public_plan_purchases: ["stripe_session_id", "access_token"],
  plan_gifts: ["purchase_token"],
};

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
      hit = [...hit].sort((a, b) => ((a[col] as number) - (b[col] as number)) * (asc ? 1 : -1));
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

const emails: { kind: "recipient" | "receipt"; to: string; payload: Record<string, unknown> }[] = [];
let failFor = new Set<string>();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-server", () => ({ getServiceClient: () => ({ from }) }));
vi.mock("@/lib/url-helper", () => ({ getAppUrl: () => "https://app.test" }));
vi.mock("@/lib/emails/giftTemplates", () => ({
  sendGiftRecipientEmail: async (p: { to: string }) => {
    emails.push({ kind: "recipient", to: p.to, payload: p });
    return failFor.has(p.to) ? { success: false, error: "bounced" } : { success: true };
  },
  sendGiftReceiptEmail: async (p: { to: string }) => {
    emails.push({ kind: "receipt", to: p.to, payload: p });
    return { success: true };
  },
}));

import {
  correctGiftEmail,
  fulfilGiftSession,
  giftOrderView,
  giftWelcome,
  giftsForOrder,
  markGiftOpened,
  orderById,
  resendGift,
} from "./plan-gifts";

const ORDER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MANAGE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function seed(recipients: [string, string][]) {
  for (const k of Object.keys(tables)) delete tables[k];
  tables.plan_gift_orders = [
    {
      id: ORDER,
      stripe_session_id: "cs_test_1",
      manage_token: MANAGE,
      gifter_name: "Sky Camacho",
      gifter_email: "sky@example.com",
      message: "Enjoy!",
      quantity: recipients.length,
      amount_cents: 1900 * recipients.length,
      status: "pending",
      paid_at: null,
      receipt_claimed_at: null,
      receipt_sent_at: null,
      promoter_id: null,
    },
  ];
  tables.plan_gifts = recipients.map(([name, email], i) => ({
    id: `gift-${i + 1}`,
    order_id: ORDER,
    position: i + 1,
    recipient_name: name,
    recipient_email: email,
    purchase_token: null,
    email_status: "pending",
    email_attempts: 0,
    email_error: null,
    email_claimed_at: null,
    sent_at: null,
    resend_count: 0,
    last_resent_at: null,
    email_corrections: 0,
    opened_at: null,
  }));
  tables.public_plan_purchases = [];
  tables.plan_buyer_devices = [];
}

const session = (over: Partial<Stripe.Checkout.Session> = {}) =>
  ({
    id: "cs_test_1",
    created: 1_794_800_000,
    payment_status: "paid",
    metadata: { type: "diy_plan_gift", gift_order_id: ORDER },
    ...over,
  }) as unknown as Stripe.Checkout.Session;

const recipientEmails = () => emails.filter((e) => e.kind === "recipient").map((e) => e.to);
const receipts = () => emails.filter((e) => e.kind === "receipt");

beforeEach(() => {
  emails.length = 0;
  failFor = new Set();
  seed([
    ["Jo Builder", "jo@example.com"],
    ["Sam Smith", "sam@example.com"],
    ["Alex Lee", "alex@example.com"],
  ]);
});

describe("fulfilGiftSession", () => {
  it("gives each recipient their own purchase and their own email, then one receipt", async () => {
    const res = await fulfilGiftSession(session());
    expect(res.ok).toBe(true);

    const purchases = tables.public_plan_purchases;
    expect(purchases).toHaveLength(3);
    expect(purchases.map((p) => p.email)).toEqual(["jo@example.com", "sam@example.com", "alex@example.com"]);
    expect(purchases.map((p) => p.stripe_session_id)).toEqual([
      "cs_test_1__gift_1",
      "cs_test_1__gift_2",
      "cs_test_1__gift_3",
    ]);
    expect(purchases[0]).toMatchObject({ plan_id: "tote-organizer", tier: "interactive", gift_id: "gift-1", customer_name: "Jo Builder" });
    expect(purchases.every((p) => p.email_sent === true)).toBe(true);

    // Three separate sends, one per address, with that person's own link.
    expect(recipientEmails()).toEqual(["jo@example.com", "sam@example.com", "alex@example.com"]);
    const tokens = emails.filter((e) => e.kind === "recipient").map((e) => e.payload.accessToken);
    expect(new Set(tokens).size).toBe(3);
    expect(emails[0].payload).toMatchObject({ gifterEmail: "sky@example.com", gifterName: "Sky Camacho", message: "Enjoy!" });

    expect(receipts()).toHaveLength(1);
    expect(receipts()[0].to).toBe("sky@example.com");
    const order = await orderById(ORDER);
    expect(order).toMatchObject({ status: "paid" });
    expect(order?.receipt_sent_at).toBeTruthy();
    expect(tables.plan_gifts.every((g) => g.email_status === "sent")).toBe(true);
  });

  it("is idempotent: a second caller sends nothing again", async () => {
    await fulfilGiftSession(session());
    emails.length = 0;
    const again = await fulfilGiftSession(session());
    expect(again.ok).toBe(true);
    expect(emails).toHaveLength(0);
    expect(tables.public_plan_purchases).toHaveLength(3);
  });

  it("two callers at once still send each email once", async () => {
    await Promise.all([fulfilGiftSession(session()), fulfilGiftSession(session())]);
    expect(recipientEmails().sort()).toEqual(["alex@example.com", "jo@example.com", "sam@example.com"]);
    expect(receipts().length).toBeLessThanOrEqual(1);
    expect(tables.public_plan_purchases).toHaveLength(3);
  });

  it("refuses unpaid sessions and sessions that don't match the order", async () => {
    expect((await fulfilGiftSession(session({ payment_status: "unpaid" }))).ok).toBe(false);
    expect((await fulfilGiftSession(session({ id: "cs_other" }))).ok).toBe(false);
    expect((await fulfilGiftSession(session({ metadata: { type: "diy_plan" } }))).ok).toBe(false);
    expect(emails).toHaveLength(0);
    expect(tables.public_plan_purchases).toHaveLength(0);
  });

  it("one bad address doesn't stop the others; the receipt says which", async () => {
    failFor = new Set(["sam@example.com"]);
    await fulfilGiftSession(session());
    const sam = tables.plan_gifts.find((g) => g.recipient_email === "sam@example.com")!;
    expect(sam).toMatchObject({ email_status: "failed", email_attempts: 1 });
    expect(tables.plan_gifts.filter((g) => g.email_status === "sent")).toHaveLength(2);
    const listed = receipts()[0].payload.recipients as { email: string; sent: boolean }[];
    expect(listed.find((r) => r.email === "sam@example.com")?.sent).toBe(false);

    // The reconcile retries failed sends (a few times, not forever).
    failFor = new Set();
    emails.length = 0;
    await fulfilGiftSession(session(), { retryFailed: true });
    expect(recipientEmails()).toEqual(["sam@example.com"]);
    expect(tables.plan_gifts.find((g) => g.recipient_email === "sam@example.com")?.email_status).toBe("sent");
  });

  it("stops automatic retries after three attempts", async () => {
    failFor = new Set(["sam@example.com"]);
    for (let i = 0; i < 5; i++) await fulfilGiftSession(session(), { retryFailed: true });
    expect(recipientEmails().filter((e) => e === "sam@example.com")).toHaveLength(3);
  });
});

describe("the gifter's controls", () => {
  beforeEach(async () => {
    await fulfilGiftSession(session());
    emails.length = 0;
    // Pretend the sends happened a while ago (past the resend cooldown).
    for (const g of tables.plan_gifts) g.sent_at = new Date(Date.now() - 5 * 60_000).toISOString();
  });

  it("shows each recipient's status and personal link", async () => {
    const order = (await orderById(ORDER))!;
    const view = await giftOrderView(order, await giftsForOrder(ORDER));
    expect(view.paid).toBe(true);
    expect(view.recipients).toHaveLength(3);
    expect(view.recipients[0]).toMatchObject({ status: "sent", canResend: true, canCorrectEmail: true, resendsLeft: 3 });
    expect(view.recipients[0].giftUrl).toMatch(/^https:\/\/app\.test\/plans\/gift\/open\?token=/);
    expect(view.manageUrl).toBe(`https://app.test/plans/gift/sent?order=${MANAGE}`);
  });

  it("resends one email, then throttles", async () => {
    const first = await resendGift(MANAGE, "gift-2");
    expect(first.ok).toBe(true);
    expect(recipientEmails()).toEqual(["sam@example.com"]);
    const second = await resendGift(MANAGE, "gift-2");
    expect(second).toMatchObject({ ok: false });
    expect(recipientEmails()).toHaveLength(1);
  });

  it("caps resends", async () => {
    for (let i = 0; i < 4; i++) {
      const g = tables.plan_gifts.find((x) => x.id === "gift-1")!;
      g.last_resent_at = new Date(Date.now() - 5 * 60_000).toISOString();
      await resendGift(MANAGE, "gift-1");
    }
    expect(recipientEmails()).toHaveLength(3);
  });

  it("rejects a bad manage token or someone else's gift", async () => {
    expect((await resendGift("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "gift-1")).ok).toBe(false);
    expect((await resendGift(MANAGE, "gift-99")).ok).toBe(false);
  });

  it("fixes a mistyped email: new link, old link dead, emailed to the new address", async () => {
    const before = tables.plan_gifts.find((g) => g.id === "gift-3")!.purchase_token as string;
    const res = await correctGiftEmail(MANAGE, "gift-3", "Alex.Lee@Example.com");
    expect(res.ok).toBe(true);
    const gift = tables.plan_gifts.find((g) => g.id === "gift-3")!;
    expect(gift).toMatchObject({ recipient_email: "alex.lee@example.com", email_status: "sent", email_corrections: 1 });
    expect(gift.purchase_token).not.toBe(before);
    const purchase = tables.public_plan_purchases.find((p) => p.gift_id === "gift-3")!;
    expect(purchase).toMatchObject({ email: "alex.lee@example.com", access_token: gift.purchase_token });
    expect(recipientEmails()).toEqual(["alex.lee@example.com"]);
    expect(await giftWelcome(before)).toBeNull();
    expect(await giftWelcome(gift.purchase_token as string)).toMatchObject({ gifterName: "Sky Camacho", recipientFirstName: "Alex" });
  });

  it("won't change the address once the gift has been opened", async () => {
    const token = tables.plan_gifts.find((g) => g.id === "gift-1")!.purchase_token as string;
    await markGiftOpened(token);
    const res = await correctGiftEmail(MANAGE, "gift-1", "other@example.com");
    expect(res).toMatchObject({ ok: false });
    expect(tables.public_plan_purchases.find((p) => p.gift_id === "gift-1")?.email).toBe("jo@example.com");
  });

  it("won't change the address once their device has been registered", async () => {
    tables.plan_buyer_devices.push({ email: "jo@example.com", created_at: new Date().toISOString() });
    expect((await correctGiftEmail(MANAGE, "gift-1", "other@example.com")).ok).toBe(false);
  });

  it("won't move a gift onto another recipient's address", async () => {
    const res = await correctGiftEmail(MANAGE, "gift-1", "sam@example.com");
    expect(res).toMatchObject({ ok: false });
  });
});
