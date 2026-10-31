import { beforeEach, describe, expect, it, vi } from "vitest";

// ── In-memory public_plan_purchases ──────────────────────────────────────
type Row = { access_token: string; email: string; plan_id: string; stripe_session_id?: string; email_sent?: boolean };
let rows: Row[] = [];

function query() {
  const filters: [string, unknown][] = [];
  let pendingInsert: Row | null = null;
  const api = {
    select: () => api,
    eq: (col: string, val: unknown) => {
      filters.push([col, val]);
      return api;
    },
    limit: () => api,
    order: () => api,
    update: () => api,
    insert: (row: Omit<Row, "access_token">) => {
      pendingInsert = { ...row, access_token: "00000000-0000-4000-8000-00000000000" + (rows.length + 1) } as Row;
      rows.push(pendingInsert);
      return api;
    },
    maybeSingle: async () => ({ data: rows.find((r) => filters.every(([c, v]) => (r as Record<string, unknown>)[c] === v)) ?? null }),
    single: async () => ({ data: pendingInsert ?? rows.find((r) => filters.every(([c, v]) => (r as Record<string, unknown>)[c] === v)) ?? null, error: null }),
    then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
  };
  return api;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-server", () => ({ getServiceClient: () => ({ from: () => query() }) }));
vi.mock("@/lib/server/action-rate-limit", () => ({ enforceActionRateLimit: vi.fn(), RateLimitError: class extends Error {} }));
vi.mock("@/lib/emails/plansTemplates", () => ({ sendLadderJigAccessEmail: vi.fn(async () => {}) }));
const { checkPlanDevice } = vi.hoisted(() => ({
  checkPlanDevice: vi.fn(async (_email: string, _opts?: { trusted?: boolean }) => ({ ok: true }) as { ok: true } | { ok: false; emailHint: string }),
}));
vi.mock("@/lib/server/plan-device", () => ({ checkPlanDevice }));
vi.mock("@/config/site", () => ({ siteConfig: { baseUrl: "https://x.test" } }));

const created: { unit_amount: number; metadata: Record<string, string> }[] = [];
let sessionToReturn: Record<string, unknown> = {};
vi.mock("stripe", () => ({
  default: class {
    checkout = {
      sessions: {
        create: async (args: { line_items: { price_data: { unit_amount: number } }[]; metadata: Record<string, string> }) => {
          created.push({ unit_amount: args.line_items[0].price_data.unit_amount, metadata: args.metadata });
          return { url: "https://stripe.test/session" };
        },
        retrieve: async () => sessionToReturn,
      },
    };
  },
}));

import { createLadderJigCheckout, getLadderJigOffer, openLadderJig } from "./ladder-jig-retail";

const TOTE = "11111111-1111-4111-8111-111111111111";
const CHAIR = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  rows = [
    { access_token: TOTE, email: "jo@example.com", plan_id: "tote-organizer" },
    { access_token: CHAIR, email: "sam@example.com", plan_id: "adirondack-chair" },
  ];
  created.length = 0;
});

describe("ladder jig pricing can't be faked", () => {
  it("gives the $5 owner price only for a real tote plan token", async () => {
    expect((await getLadderJigOffer(TOTE)).price).toBe(500);
    expect((await getLadderJigOffer("33333333-3333-4333-8333-333333333333")).price).toBe(900);
    expect((await getLadderJigOffer(CHAIR)).price).toBe(900);
    expect((await getLadderJigOffer("not-a-uuid")).price).toBe(900);
    expect((await getLadderJigOffer(null)).price).toBe(900);
  });

  it("charges what the server decides at checkout", async () => {
    await createLadderJigCheckout(TOTE);
    await createLadderJigCheckout("33333333-3333-4333-8333-333333333333");
    await createLadderJigCheckout(CHAIR);
    expect(created.map((c) => c.unit_amount)).toEqual([500, 900, 900]);
    expect(created[0].metadata).toMatchObject({ type: "ladder_jig", plan_id: "ladder-jig", owner_token: TOTE });
  });

  it("sends owners who already bought the jig to their copy", async () => {
    rows.push({ access_token: "44444444-4444-4444-8444-444444444444", email: "jo@example.com", plan_id: "ladder-jig" });
    expect((await getLadderJigOffer(TOTE)).ownedJigToken).toBe("44444444-4444-4444-8444-444444444444");
  });
});

describe("ladder jig content is gated", () => {
  it("refuses unpaid sessions and non-jig tokens", async () => {
    sessionToReturn = { payment_status: "unpaid", metadata: { type: "ladder_jig" } };
    expect((await openLadderJig({ sessionId: "cs_1" })).ok).toBe(false);
    sessionToReturn = { payment_status: "paid", metadata: { type: "diy_plan" } };
    expect((await openLadderJig({ sessionId: "cs_2" })).ok).toBe(false);
    expect((await openLadderJig({ token: TOTE })).ok).toBe(false);
  });

  it("records a paid session once and returns 2×4-rail marks", async () => {
    sessionToReturn = { payment_status: "paid", metadata: { type: "ladder_jig" }, customer_details: { email: "New@Example.com" } };
    const first = await openLadderJig({ sessionId: "cs_paid" });
    const again = await openLadderJig({ sessionId: "cs_paid" });
    expect(first.ok && again.ok && first.token === again.token).toBe(true);
    expect(rows.filter((r) => r.plan_id === "ladder-jig")).toHaveLength(1);
    expect(rows.find((r) => r.plan_id === "ladder-jig")?.email).toBe("new@example.com");
    if (first.ok) expect(first.content.marks).toEqual([14.625, 30.375, 46.125, 61.875, 77.625, 93.375]);
    // The device that paid is remembered without a code.
    expect(checkPlanDevice).toHaveBeenCalledWith("new@example.com", { trusted: true });
  });

  it("asks for the emailed code when the link is opened on a new device", async () => {
    sessionToReturn = { payment_status: "paid", metadata: { type: "ladder_jig" }, customer_details: { email: "new@example.com" } };
    const paid = await openLadderJig({ sessionId: "cs_paid_2" });
    const token = paid.ok ? paid.token : "";
    checkPlanDevice.mockResolvedValueOnce({ ok: false, emailHint: "ne•••@example.com" });
    const res = await openLadderJig({ token });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.verify).toEqual({ token, emailHint: "ne•••@example.com" });
  });
});
