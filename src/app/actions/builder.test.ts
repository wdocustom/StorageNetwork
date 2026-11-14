import { beforeEach, describe, expect, it, vi } from "vitest";

// ── A small in-memory Supabase: just the calls builder.ts makes ────────────
type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
const UNIQUE: Record<string, string[]> = {
  builder_subscriptions: ["email", "stripe_session_id"],
  builder_plan_purchases: ["stripe_session_id"],
};

function query(table: string) {
  const rows = (tables[table] ??= []);
  const tests: ((r: Row) => boolean)[] = [];
  let op: { kind: "select" } | { kind: "insert"; row: Row } | { kind: "update"; patch: Row } | { kind: "upsert"; row: Row; on: string } = { kind: "select" };
  let countOnly = false;
  let limit = Infinity;
  let order: { key: string; ascending: boolean } | null = null;

  const matching = () => {
    let out = rows.filter((r) => tests.every((t) => t(r)));
    if (order) {
      const { key, ascending } = order;
      out = [...out].sort((a, b) => (String(a[key]) < String(b[key]) ? -1 : 1) * (ascending ? 1 : -1));
    }
    return out.slice(0, limit);
  };

  const run = (): { data: Row[]; error: { code: string } | null; count?: number } => {
    if (op.kind === "insert" || op.kind === "upsert") {
      const incoming = op.row;
      if (op.kind === "upsert") {
        const on = op.on;
        const existing = rows.find((r) => r[on] === incoming[on]);
        if (existing) {
          Object.assign(existing, incoming);
          return { data: [existing], error: null };
        }
      }
      for (const key of UNIQUE[table] ?? []) {
        if (incoming[key] != null && rows.some((r) => r[key] === incoming[key])) return { data: [], error: { code: "23505" } };
      }
      const row: Row = { id: crypto.randomUUID(), access_token: crypto.randomUUID(), deleted_at: null, share_mode: "private", share_slug: null, ...incoming };
      rows.push(row);
      return { data: [row], error: null };
    }
    if (op.kind === "update") {
      const hit = matching();
      for (const r of hit) Object.assign(r, op.patch);
      return { data: hit, error: null };
    }
    const data = matching();
    return countOnly ? { data: [], error: null, count: data.length } : { data, error: null };
  };

  const api = {
    select: (_cols?: string, opts?: { head?: boolean }) => {
      if (opts?.head) countOnly = true;
      return api;
    },
    eq: (k: string, v: unknown) => (tests.push((r) => r[k] === v), api),
    is: (k: string, v: unknown) => (tests.push((r) => (r[k] ?? null) === v), api),
    not: (k: string, _op: string, v: unknown) => (tests.push((r) => (r[k] ?? null) !== v), api),
    order: (key: string, o: { ascending: boolean }) => ((order = { key, ascending: o.ascending }), api),
    limit: (n: number) => ((limit = n), api),
    insert: (row: Row) => ((op = { kind: "insert", row }), api),
    update: (patch: Row) => ((op = { kind: "update", patch }), api),
    upsert: (row: Row, o: { onConflict: string }) => ((op = { kind: "upsert", row, on: o.onConflict }), api),
    maybeSingle: async () => {
      const res = run();
      return { data: res.data[0] ?? null, error: res.error };
    },
    single: async () => {
      const res = run();
      return { data: res.data[0] ?? null, error: res.error ?? (res.data[0] ? null : { code: "PGRST116" }) };
    },
    then: (resolve: (v: ReturnType<typeof run>) => void) => resolve(run()),
  };
  return api;
}

// ── Everything outside the actions ─────────────────────────────────────────
let device: { ok: true } | { ok: false; emailHint: string } = { ok: true };
let adminUser: { id: string; email: string } | null = null;
const stripeSessions: Record<string, unknown> = {};
const stripeSubscriptions: Record<string, unknown> = {};
const checkoutCalls: Record<string, unknown>[] = [];
const emails: string[] = [];

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-server", () => ({ getServiceClient: () => ({ from: query }) }));
vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: async () => adminUser }));
vi.mock("@/lib/server/plan-device", () => ({
  checkPlanDevice: async () => device,
  maskEmail: (e: string) => `${e.slice(0, 2)}•••@${e.split("@")[1]}`,
  sendPlanDeviceCode: async () => ({ ok: true, emailHint: "x" }),
  verifyPlanDeviceCode: async () => ({ ok: true }),
}));
vi.mock("@/lib/server/action-rate-limit", () => ({ enforceActionRateLimit: async () => {}, RateLimitError: class extends Error {} }));
vi.mock("@/lib/stripe/http", () => ({ stripeConfig: () => ({}) }));
vi.mock("@/config/site", () => ({ siteConfig: { baseUrl: "https://example.test" } }));
vi.mock("stripe", () => ({
  default: class {
    checkout = { sessions: { retrieve: async (id: string) => stripeSessions[id] ?? Promise.reject(new Error("no such session")) } };
    subscriptions = { retrieve: async (id: string) => stripeSubscriptions[id] ?? Promise.reject(new Error("no such subscription")) };
    billingPortal = { sessions: { create: async () => ({ url: "https://billing.test/portal" }) } };
  },
}));
vi.mock("@/lib/stripe/embedded-checkout", () => ({
  FINAL_SALE_TEXT: {},
  createEmbeddedCheckoutSession: async (_stripe: unknown, params: Record<string, unknown>) => {
    checkoutCalls.push(params);
    return { id: "cs_new", client_secret: "secret_123" };
  },
}));
vi.mock("@/lib/emails/builderTemplates", () => ({
  sendBuilderWelcomeEmail: async (to: string) => (emails.push(`welcome:${to}`), { success: true }),
  sendBuilderPlanPurchaseEmail: async (to: string) => (emails.push(`plan:${to}`), { success: true }),
  sendBuilderSaleEmail: async (to: string, sale: { earningsCents: number }) => (emails.push(`sale:${to}:${sale.earningsCents}`), { success: true }),
}));

import { LIBRARY_ITEMS } from "@/lib/builder/catalog";
import { addFromLibrary, emptyScene, renameScene, type Scene } from "@/lib/builder/scene";
import { designStats, parseListingPrice, splitSale } from "@/lib/builder/store";
import {
  activateBuilderSubscription,
  createBuilderSubscriptionCheckout,
  createPlanPurchaseCheckout,
  deleteDesign,
  getBuilderAccess,
  getSharedDesign,
  listDesigns,
  listMarketplace,
  loadDesign,
  openBillingPortal,
  openBuilderPlan,
  openPurchasedPlan,
  saveDesign,
  shareDesign,
} from "./builder";

const JO = "11111111-1111-4111-8111-111111111111";
const SAM = "22222222-2222-4222-8222-222222222222";
const LAPSED = "33333333-3333-4333-8333-333333333333";
const fresh = () => new Date().toISOString();

function bench(name = "Bench"): Scene {
  let scene = renameScene(emptyScene(), name);
  for (const id of ["2x4-leg", "2x4-leg", "ply34-top"]) scene = addFromLibrary(scene, LIBRARY_ITEMS.find((i) => i.id === id)!).scene;
  return scene;
}

const subscriber = (token: string, email: string, status = "active"): Row => ({
  id: crypto.randomUUID(),
  email,
  access_token: token,
  customer_name: null,
  stripe_customer_id: "cus_1",
  stripe_subscription_id: `sub_${email}`,
  stripe_session_id: null,
  status,
  current_period_end: null,
  cancel_at_period_end: false,
  checked_at: fresh(),
});

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  tables.builder_subscriptions = [subscriber(JO, "jo@example.com"), subscriber(SAM, "sam@example.com"), subscriber(LAPSED, "old@example.com", "canceled")];
  tables.profiles = [{ id: "admin-1", is_admin: true, email: "Boss@Example.com" }];
  device = { ok: true };
  adminUser = null;
  for (const key of Object.keys(stripeSessions)) delete stripeSessions[key];
  for (const key of Object.keys(stripeSubscriptions)) delete stripeSubscriptions[key];
  stripeSubscriptions["sub_old@example.com"] = { status: "canceled", cancel_at_period_end: false, items: { data: [] } };
  checkoutCalls.length = 0;
  emails.length = 0;
});

describe("money", () => {
  it("gives the platform 20% and the creator every remaining cent", () => {
    expect(splitSale(900)).toEqual({ platformFeeCents: 180, creatorEarningsCents: 720 });
    expect(splitSale(1250)).toEqual({ platformFeeCents: 250, creatorEarningsCents: 1000 });
    const odd = splitSale(999);
    expect(odd.platformFeeCents + odd.creatorEarningsCents).toBe(999);
    expect(odd.platformFeeCents).toBe(200);
  });

  it("reads listing prices and rejects ones out of range", () => {
    expect(parseListingPrice("9")).toBe(900);
    expect(parseListingPrice("$12.50")).toBe(1250);
    for (const bad of ["0", "0.50", "501", "abc", "-5", "9.999", ""]) expect(parseListingPrice(bad)).toBeNull();
  });

  it("describes a design without giving it away", () => {
    const stats = designStats(bench());
    expect(stats.pieceCount).toBe(3);
    expect(stats.lumberFeet).toBe(6); // two 34-1/2" legs
    expect(stats.sheetSqFt).toBe(12); // 24" × 72"
    expect(Object.keys(stats)).not.toContain("pieces");
  });
});

describe("membership", () => {
  it("recognises a subscriber by their token", async () => {
    const res = await getBuilderAccess(JO);
    expect(res.ok && res.member).toMatchObject({ via: "subscription", token: JO, emailHint: "jo•••@example.com" });
  });

  it("treats no token, an unknown token and junk as a guest", async () => {
    for (const token of [null, "44444444-4444-4444-8444-444444444444", "'; drop table", ""]) {
      const res = await getBuilderAccess(token);
      expect(res).toMatchObject({ ok: false, reason: "none" });
    }
  });

  it("asks a new device for a code instead of letting it in", async () => {
    device = { ok: false, emailHint: "jo•••@example.com" };
    const res = await getBuilderAccess(JO);
    expect(res).toMatchObject({ ok: false, reason: "verify", verify: { token: JO } });
    expect(await saveDesign(JO, { scene: bench() })).toMatchObject({ ok: false, reason: "verify" });
  });

  it("closes the builder when Stripe says the subscription has ended", async () => {
    expect(await getBuilderAccess(LAPSED)).toMatchObject({ ok: false, reason: "inactive" });
    expect(await openBuilderPlan(LAPSED, bench())).toMatchObject({ ok: false, reason: "inactive" });
  });

  it("re-checks a stale status with Stripe and notices a cancellation", async () => {
    const row = tables.builder_subscriptions[0];
    row.checked_at = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    stripeSubscriptions["sub_jo@example.com"] = { status: "canceled", cancel_at_period_end: false, items: { data: [] } };
    expect(await getBuilderAccess(JO)).toMatchObject({ ok: false, reason: "inactive" });
    expect(row.status).toBe("canceled");
  });

  it("keeps the last known status if Stripe can't be reached", async () => {
    tables.builder_subscriptions[0].checked_at = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    // no entry in stripeSubscriptions → retrieve rejects
    expect((await getBuilderAccess(JO)).ok).toBe(true);
  });

  it("lets a signed-in admin in without a subscription", async () => {
    adminUser = { id: "admin-1", email: "boss@example.com" };
    const res = await getBuilderAccess(null);
    expect(res.ok && res.member).toMatchObject({ via: "admin" });
    const saved = await saveDesign(null, { scene: bench() });
    expect(saved.ok).toBe(true);
    expect(tables.builder_designs[0].owner_email).toBe("boss@example.com");
  });
});

describe("subscribing", () => {
  it("starts a $49/month subscription checkout that the Pro webhook won't mistake for an installer", async () => {
    const res = await createBuilderSubscriptionCheckout();
    expect(res).toEqual({ ok: true, clientSecret: "secret_123" });
    const params = checkoutCalls[0] as { mode: string; line_items: { price_data: { unit_amount: number; recurring: { interval: string } } }[]; subscription_data: { metadata: Record<string, string> } };
    expect(params.mode).toBe("subscription");
    expect(params.line_items[0].price_data).toMatchObject({ unit_amount: 4900, recurring: { interval: "month" } });
    expect(params.subscription_data.metadata).toEqual({ type: "builder_subscription" });
    expect("userId" in params.subscription_data.metadata).toBe(false);
  });

  const paidSession = (email: string, over: Record<string, unknown> = {}) => ({
    mode: "subscription",
    status: "complete",
    payment_status: "paid",
    metadata: { type: "builder_subscription" },
    customer: "cus_new",
    customer_details: { email, name: "New Person" },
    subscription: { id: "sub_new", status: "active", cancel_at_period_end: false, items: { data: [{ current_period_end: 1800000000 }] } },
    ...over,
  });

  it("records a paid subscription, emails the link, and is safe to reload", async () => {
    stripeSessions.cs_test_abcdefghij = paidSession("New@Example.com");
    const first = await activateBuilderSubscription("cs_test_abcdefghij");
    expect(first).toMatchObject({ ok: true, emailSentTo: "new@example.com" });
    const row = tables.builder_subscriptions.find((r) => r.email === "new@example.com")!;
    expect(row).toMatchObject({ status: "active", stripe_subscription_id: "sub_new", email_sent: true });
    expect(row.current_period_end).toBe(new Date(1800000000 * 1000).toISOString());
    expect(emails).toEqual(["welcome:new@example.com"]);

    const again = await activateBuilderSubscription("cs_test_abcdefghij");
    expect(again.ok).toBe(true);
    expect(emails).toHaveLength(1);
    expect(tables.builder_subscriptions.filter((r) => r.email === "new@example.com")).toHaveLength(1);
  });

  it("gives a returning subscriber their old link and designs back", async () => {
    stripeSessions.cs_test_returning01 = paidSession("old@example.com");
    const res = await activateBuilderSubscription("cs_test_returning01");
    expect(res.ok && res.member.token).toBe(LAPSED);
    expect((await getBuilderAccess(LAPSED)).ok).toBe(true);
  });

  it("refuses sessions that aren't a paid builder subscription", async () => {
    stripeSessions.cs_test_unpaid00001 = paidSession("x@example.com", { payment_status: "unpaid" });
    stripeSessions.cs_test_othertype01 = paidSession("x@example.com", { metadata: { type: "diy_plan" } });
    stripeSessions.cs_test_onetime0001 = paidSession("x@example.com", { mode: "payment" });
    for (const id of ["cs_test_unpaid00001", "cs_test_othertype01", "cs_test_onetime0001", "cs_test_missing0001", "not-a-session"]) {
      expect((await activateBuilderSubscription(id)).ok).toBe(false);
    }
    expect(tables.builder_subscriptions.some((r) => r.email === "x@example.com")).toBe(false);
  });

  it("opens Stripe's billing page for a subscriber only", async () => {
    expect(await openBillingPortal(JO)).toEqual({ ok: true, url: "https://billing.test/portal" });
    expect((await openBillingPortal("44444444-4444-4444-8444-444444444444")).ok).toBe(false);
  });
});

describe("saved designs", () => {
  it("is for members only", async () => {
    expect((await saveDesign(null, { scene: bench() })).ok).toBe(false);
    expect((await listDesigns(null)).ok).toBe(false);
    expect((await openBuilderPlan(null, bench())).ok).toBe(false);
    expect(tables.builder_designs ?? []).toHaveLength(0);
  });

  it("saves, updates in place, lists and reopens", async () => {
    const created = await saveDesign(JO, { scene: bench("First"), thumbnail: "data:image/jpeg;base64,AAAA" });
    expect(created.ok).toBe(true);
    const id = created.ok ? created.id : "";
    const updated = await saveDesign(JO, { id, scene: bench("Renamed") });
    expect(updated.ok && updated.id).toBe(id);
    expect(tables.builder_designs).toHaveLength(1);
    expect(tables.builder_designs[0]).toMatchObject({ name: "Renamed", piece_count: 3, owner_email: "jo@example.com", thumbnail: "data:image/jpeg;base64,AAAA" });

    const list = await listDesigns(JO);
    expect(list.ok && list.designs.map((d) => d.name)).toEqual(["Renamed"]);
    const opened = await loadDesign(JO, id);
    expect(opened.ok && opened.scene.pieces).toHaveLength(3);
  });

  it("won't store a design it can't read, or a thumbnail that isn't a small JPEG", async () => {
    expect((await saveDesign(JO, { scene: { version: 99, pieces: [] } })).ok).toBe(false);
    expect((await saveDesign(JO, { scene: "<script>" })).ok).toBe(false);
    await saveDesign(JO, { scene: bench(), thumbnail: "javascript:alert(1)" });
    await saveDesign(JO, { scene: bench(), thumbnail: `data:image/jpeg;base64,${"A".repeat(400000)}` });
    expect(tables.builder_designs.map((d) => d.thumbnail ?? null)).toEqual([null, null]);
  });

  it("keeps one subscriber out of another's designs", async () => {
    const mine = await saveDesign(JO, { scene: bench("Jo's") });
    const id = mine.ok ? mine.id : "";
    expect((await loadDesign(SAM, id)).ok).toBe(false);
    expect((await saveDesign(SAM, { id, scene: bench("Stolen") })).ok).toBe(false);
    expect((await shareDesign(SAM, id, { mode: "view" })).ok).toBe(false);
    await deleteDesign(SAM, id);
    expect(tables.builder_designs[0]).toMatchObject({ name: "Jo's", deleted_at: null, share_mode: "private" });
    const sams = await listDesigns(SAM);
    expect(sams.ok && sams.designs).toEqual([]);
  });

  it("makes a plan for a member's design on the server", async () => {
    const res = await openBuilderPlan(JO, bench());
    expect(res.ok && res.plan.parts.length).toBeGreaterThan(0);
    expect((await openBuilderPlan(JO, { nonsense: true })).ok).toBe(false);
  });

  it("deletes softly, taking the listing down", async () => {
    const saved = await saveDesign(JO, { scene: bench() });
    const id = saved.ok ? saved.id : "";
    await shareDesign(JO, id, { mode: "sale", priceCents: 900 });
    expect((await deleteDesign(JO, id)).ok).toBe(true);
    expect(tables.builder_designs[0].deleted_at).not.toBeNull();
    const market = await listMarketplace();
    expect(market.ok && market.listings).toEqual([]);
    const mine = await listDesigns(JO);
    expect(mine.ok && mine.designs).toEqual([]);
  });
});

describe("sharing and the marketplace", () => {
  async function saved(token = JO, name = "Bench") {
    const res = await saveDesign(token, { scene: bench(name), thumbnail: "data:image/jpeg;base64,AAAA" });
    return res.ok ? res.id : "";
  }

  it("makes a link once and keeps it", async () => {
    const id = await saved();
    const first = await shareDesign(JO, id, { mode: "view" });
    const slug = first.ok ? first.design.shareSlug : null;
    expect(slug).toMatch(/^[A-Za-z0-9_-]{16}$/);
    const priv = await shareDesign(JO, id, { mode: "private" });
    expect(priv.ok && priv.design.shareSlug).toBe(slug);
    expect((await getSharedDesign(slug!)).ok).toBe(false); // private again: the link stops working
    const again = await shareDesign(JO, id, { mode: "view" });
    expect(again.ok && again.design.shareSlug).toBe(slug);
  });

  it("shows a view-only design in full but never sends a listing's design", async () => {
    const id = await saved();
    const shared = await shareDesign(JO, id, { mode: "view", description: "  A sturdy bench.  " });
    const slug = shared.ok ? shared.design.shareSlug! : "";
    const view = await getSharedDesign(slug);
    expect(view.ok && view.mode === "view" && view.scene.pieces.length).toBe(3);
    expect(view.ok && view.description).toBe("A sturdy bench.");

    await shareDesign(JO, id, { mode: "sale", priceCents: 1200 });
    const listing = await getSharedDesign(slug);
    expect(listing).toMatchObject({ ok: true, mode: "sale", priceCents: 1200, stats: { pieceCount: 3 } });
    expect(JSON.stringify(listing)).not.toContain("pieces\":[");
    expect("scene" in listing).toBe(false);
    const market = await listMarketplace();
    expect(market.ok && market.listings.map((l) => [l.name, l.priceCents])).toEqual([["Bench", 1200]]);
    expect(JSON.stringify(market)).not.toContain("position");
  });

  it("holds prices to the allowed range and needs something to share", async () => {
    const id = await saved();
    for (const priceCents of [0, 50, 50001, 9.5, null, undefined]) {
      expect((await shareDesign(JO, id, { mode: "sale", priceCents: priceCents as number })).ok).toBe(false);
    }
    expect(tables.builder_designs[0].share_mode).toBe("private");
    const empty = await saveDesign(JO, { scene: emptyScene() });
    expect((await shareDesign(JO, empty.ok ? empty.id : "", { mode: "view" })).ok).toBe(false);
  });

  it("doesn't answer for links that are wrong", async () => {
    for (const slug of ["", "short", "../../etc/passwd", "a".repeat(40)]) expect((await getSharedDesign(slug)).ok).toBe(false);
  });
});

describe("buying a plan", () => {
  async function listed(priceCents = 900) {
    const res = await saveDesign(JO, { scene: bench("Garage Bench") });
    const id = res.ok ? res.id : "";
    const shared = await shareDesign(JO, id, { mode: "sale", priceCents });
    return { id, slug: shared.ok ? shared.design.shareSlug! : "" };
  }
  const paid = (designId: string, over: Record<string, unknown> = {}) => ({
    payment_status: "paid",
    amount_total: 900,
    metadata: { type: "builder_plan", design_id: designId },
    customer_details: { email: "Buyer@Example.com", name: "pat buyer" },
    ...over,
  });

  it("charges the listing's price, whatever the browser says", async () => {
    const { id, slug } = await listed(1500);
    const res = await createPlanPurchaseCheckout(slug);
    expect(res.ok).toBe(true);
    const params = checkoutCalls[0] as { mode: string; line_items: { price_data: { unit_amount: number } }[]; metadata: Record<string, string> };
    expect(params.mode).toBe("payment");
    expect(params.line_items[0].price_data.unit_amount).toBe(1500);
    expect(params.metadata).toEqual({ type: "builder_plan", design_id: id });
  });

  it("won't sell a design that isn't listed", async () => {
    const res = await saveDesign(JO, { scene: bench() });
    const shared = await shareDesign(JO, res.ok ? res.id : "", { mode: "view" });
    expect((await createPlanPurchaseCheckout(shared.ok ? shared.design.shareSlug! : "")).ok).toBe(false);
    expect((await createPlanPurchaseCheckout("nope-nope-nope")).ok).toBe(false);
    expect(checkoutCalls).toHaveLength(0);
  });

  it("records the sale, splits it 80/20, emails both sides and hands over the plan", async () => {
    const { id } = await listed();
    stripeSessions.cs_test_purchase001 = paid(id);
    const res = await openPurchasedPlan({ sessionId: "cs_test_purchase001" });
    expect(res).toMatchObject({ ok: true, name: "Garage Bench", emailSentTo: "buyer@example.com", firstName: "Pat" });
    expect(res.ok && res.plan.steps.length).toBeGreaterThan(0);
    expect(res.ok && res.license).toMatch(/^Licensed to buyer@example\.com · Order SN-[0-9A-F]{8}$/);
    expect(tables.builder_plan_purchases[0]).toMatchObject({
      design_id: id,
      buyer_email: "buyer@example.com",
      amount_cents: 900,
      platform_fee_cents: 180,
      creator_earnings_cents: 720,
      creator_email: "jo@example.com",
      email_sent: true,
    });
    expect(emails).toEqual(["plan:buyer@example.com", "sale:jo@example.com:720"]);

    const mine = await listDesigns(JO);
    expect(mine.ok && mine.owedCents).toBe(720);
    expect(mine.ok && mine.designs[0]).toMatchObject({ sales: 1, earningsCents: 720 });
  });

  it("counts a sale once however often the page is reloaded", async () => {
    const { id } = await listed();
    stripeSessions.cs_test_purchase002 = paid(id);
    await openPurchasedPlan({ sessionId: "cs_test_purchase002" });
    const again = await openPurchasedPlan({ sessionId: "cs_test_purchase002" });
    expect(again.ok).toBe(true);
    expect(again.ok && again.emailSentTo).toBeUndefined();
    expect(tables.builder_plan_purchases).toHaveLength(1);
    expect(emails).toHaveLength(2);
  });

  it("refuses unpaid sessions and sessions for something else", async () => {
    const { id } = await listed();
    stripeSessions.cs_test_notpaid0001 = paid(id, { payment_status: "unpaid" });
    stripeSessions.cs_test_wrongtype01 = paid(id, { metadata: { type: "diy_plan", design_id: id } });
    stripeSessions.cs_test_baddesign01 = paid("not-a-uuid");
    for (const sessionId of ["cs_test_notpaid0001", "cs_test_wrongtype01", "cs_test_baddesign01", "cs_test_unknown0001"]) {
      expect((await openPurchasedPlan({ sessionId })).ok).toBe(false);
    }
    expect(tables.builder_plan_purchases ?? []).toHaveLength(0);
  });

  it("keeps the plan as bought when the creator edits or deletes the design", async () => {
    const { id } = await listed();
    stripeSessions.cs_test_purchase003 = paid(id);
    const bought = await openPurchasedPlan({ sessionId: "cs_test_purchase003" });
    const token = bought.ok ? bought.token : "";
    await saveDesign(JO, { id, scene: renameScene(emptyScene(), "Gutted") });
    await deleteDesign(JO, id);
    const later = await openPurchasedPlan({ token });
    expect(later).toMatchObject({ ok: true, name: "Garage Bench" });
    expect(later.ok && later.scene.pieces).toHaveLength(3);
  });

  it("asks a new device for the buyer's code, and rejects bad links", async () => {
    const { id } = await listed();
    stripeSessions.cs_test_purchase004 = paid(id);
    const bought = await openPurchasedPlan({ sessionId: "cs_test_purchase004" });
    const token = bought.ok ? bought.token : "";
    device = { ok: false, emailHint: "bu•••@example.com" };
    expect(await openPurchasedPlan({ token })).toMatchObject({ ok: false, reason: "verify", verify: { token } });
    expect((await openPurchasedPlan({ token: "44444444-4444-4444-8444-444444444444" })).ok).toBe(false);
    expect((await openPurchasedPlan({ token: "junk" })).ok).toBe(false);
  });

  it("still delivers a plan paid for just before the listing came down", async () => {
    const { id } = await listed();
    stripeSessions.cs_test_purchase005 = paid(id);
    await shareDesign(JO, id, { mode: "private" });
    expect((await openPurchasedPlan({ sessionId: "cs_test_purchase005" })).ok).toBe(true);
  });
});
