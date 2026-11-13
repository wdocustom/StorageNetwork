import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const INSTALLER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const LEAD = "33333333-3333-4333-8333-333333333333";

const state: {
  user: { id: string } | null;
  lead: Record<string, unknown> | null;
  admin: boolean;
} = { user: null, lead: null, admin: false };

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: async () => state.user }));
vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: table === "leads" ? state.lead : { is_admin: state.admin } }),
      };
      return q;
    },
  }),
}));
vi.mock("@/app/actions/generate-plan", () => ({
  generateDIYPlan: async (design: unknown) => ({ design }),
}));
vi.mock("@/app/actions/diy-plan-checkout", () => ({ checkDIYPlanAccess: async () => ({ hasFreeAccess: false }) }));
vi.mock("@/lib/emails/plansTemplates", () => ({ sendTotePlanAccessEmail: async () => ({}) }));
vi.mock("@/lib/server/plan-device", () => ({ checkPlanDevice: async () => ({ ok: true }) }));
vi.mock("@/lib/server/action-rate-limit", () => ({
  enforceActionRateLimit: async () => {},
  RateLimitError: class extends Error {},
}));

import { openTotePlan } from "./tote-plan-access";

beforeEach(() => {
  state.user = { id: INSTALLER };
  state.lead = { installer_id: INSTALLER, plan_design: "H4x4wts", plan_design_name: null };
  state.admin = false;
});

describe("openTotePlan — the customer's plan on a lead", () => {
  it("opens the exact design for the installer the job belongs to, whatever their plan", async () => {
    const r = await openTotePlan({ leadId: LEAD });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.access).toBe("installer");
    expect(r.design.units[0]).toMatchObject({ cols: 4, rows: 4, sideways: true });
    expect(r.token).toBeUndefined();
  });

  it("refuses anyone else, signed out users, and leads without a design", async () => {
    state.user = { id: OTHER };
    expect((await openTotePlan({ leadId: LEAD })).ok).toBe(false);
    state.user = null;
    expect((await openTotePlan({ leadId: LEAD })).ok).toBe(false);
    state.user = { id: INSTALLER };
    state.lead = { installer_id: INSTALLER, plan_design: null, plan_design_name: null };
    expect((await openTotePlan({ leadId: LEAD })).ok).toBe(false);
    expect((await openTotePlan({ leadId: "not-a-uuid" })).ok).toBe(false);
  });

  it("lets an admin look", async () => {
    state.user = { id: OTHER };
    state.admin = true;
    const r = await openTotePlan({ leadId: LEAD });
    expect(r.ok && r.access).toBe("admin");
  });
});
