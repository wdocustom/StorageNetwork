import { beforeEach, describe, expect, it, vi } from "vitest";

// ── In-memory public_plan_purchases ─────────────────────────────────────────
type Row = Record<string, unknown>;
let rows: Row[] = [];
let device: { ok: true } | { ok: false; emailHint: string } = { ok: true };

function query(table: string) {
  const filters: [string, unknown][] = [];
  let insertRow: Row | null = null;
  const matches = () => rows.filter((r) => filters.every(([k, v]) => r[k] === v));
  const api = {
    select: () => api,
    eq: (k: string, v: unknown) => {
      filters.push([k, v]);
      return api;
    },
    maybeSingle: async () => ({ data: matches()[0] ?? null, error: null }),
    single: async () => {
      if (insertRow) {
        const row = { access_token: crypto.randomUUID(), ...insertRow };
        rows.push(row);
        return { data: row, error: null };
      }
      return { data: matches()[0] ?? null, error: null };
    },
    insert: (r: Row) => {
      insertRow = r;
      return api;
    },
    then: (resolve: (v: { data: Row[]; error: null }) => void) => resolve({ data: matches(), error: null }),
  };
  if (table !== "public_plan_purchases") throw new Error(`unexpected table ${table}`);
  return api;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-server", () => ({ getServiceClient: () => ({ from: query }) }));
vi.mock("@/lib/server/plan-device", () => ({ checkPlanDevice: async () => device }));
vi.mock("@/lib/server/action-rate-limit", () => ({
  enforceActionRateLimit: async () => {},
  RateLimitError: class extends Error {},
}));
vi.mock("@/app/actions/generate-plan", () => ({ generateDIYPlan: async () => ({}) }));
vi.mock("@/app/actions/diy-plan-checkout", () => ({ checkDIYPlanAccess: async () => ({ hasFreeAccess: false }) }));
vi.mock("@/lib/emails/plansTemplates", () => ({ sendTotePlanAccessEmail: async () => ({ success: true }) }));

import { checkAllAccess, createIncludedPlan } from "./tote-plan-access";

const PAID = "11111111-1111-4111-8111-111111111111";
const design = (cols: number) => ({ units: [{ cols, rows: 3, toteType: "HDX", hasWheels: true, hasTop: true }] });

beforeEach(() => {
  device = { ok: true };
  rows = [
    {
      access_token: PAID,
      email: "jo@example.com",
      plan_id: "tote-organizer",
      tier: "pdf", // bought the PDF before All-Access: still unlocks everything
      build_config: design(4),
      customer_name: "Jo Builder",
      included_from: null,
    },
    {
      access_token: "22222222-2222-4222-8222-222222222222",
      email: "jo@example.com",
      plan_id: "ladder-jig",
      tier: null,
      build_config: null,
      customer_name: null,
      included_from: null,
    },
  ];
});

describe("All-Access: build another plan", () => {
  it("any tote plan purchase unlocks it, a jig purchase or a bad link doesn't", async () => {
    expect(await checkAllAccess(PAID)).toEqual({ ok: true, emailHint: "jo•••@example.com" });
    expect((await checkAllAccess("22222222-2222-4222-8222-222222222222")).ok).toBe(false);
    expect((await checkAllAccess("not-a-token")).ok).toBe(false);
  });

  it("creates a free plan for a new design, tied to the paid purchase", async () => {
    const res = await createIncludedPlan(PAID, design(2));
    expect(res.ok).toBe(true);
    const created = rows.find((r) => r.access_token === (res as { token: string }).token)!;
    expect(created).toMatchObject({
      email: "jo@example.com",
      plan_id: "tote-organizer",
      tier: "interactive",
      included_from: PAID,
      customer_name: "Jo Builder",
    });
    expect(String(created.stripe_session_id)).toMatch(/^included_/);
  });

  it("plans built from an included plan still point at the original purchase", async () => {
    const first = (await createIncludedPlan(PAID, design(2))) as { token: string };
    const second = (await createIncludedPlan(first.token, design(1))) as { token: string };
    expect(rows.find((r) => r.access_token === second.token)?.included_from).toBe(PAID);
  });

  it("the same design opens the plan they already have instead of a duplicate", async () => {
    expect(await createIncludedPlan(PAID, design(4))).toEqual({ ok: true, token: PAID });
    const a = (await createIncludedPlan(PAID, design(2))) as { token: string };
    const b = (await createIncludedPlan(PAID, design(2))) as { token: string };
    expect(b.token).toBe(a.token);
    expect(rows.filter((r) => r.plan_id === "tote-organizer")).toHaveLength(2);
  });

  it("asks for the emailed code on a new device and creates nothing", async () => {
    device = { ok: false, emailHint: "jo•••@example.com" };
    const res = await createIncludedPlan(PAID, design(2));
    expect(res).toMatchObject({ ok: false, verify: { token: PAID, emailHint: "jo•••@example.com" } });
    expect(rows).toHaveLength(2);
  });

  it("rejects designs outside the plan limits", async () => {
    const res = await createIncludedPlan(PAID, { units: [{ cols: 99, rows: 99, toteType: "HDX" }] });
    expect(res.ok).toBe(false);
    expect(rows).toHaveLength(2);
  });
});
