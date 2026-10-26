import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
const REFERRER = "11111111-2222-4333-8444-555555555555";
const LOCAL = "99999999-8888-4777-8666-555555555555";

const state = vi.hoisted(() => ({
  cookie: null as string | null,
  inArea: true,
  local: null as string | null,
  atCapacity: false,
  submitted: [] as Record<string, unknown>[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (state.cookie ? { value: state.cookie } : undefined) }),
}));
vi.mock("@/lib/server/action-rate-limit", () => ({
  enforceActionRateLimit: async () => {},
  RateLimitError: class extends Error {},
}));
vi.mock("@/app/actions/customer", () => ({
  getInstallerById: async (id: string) => ({
    installer_id: id,
    installer_name: id === REFERRER ? "Referring Builds" : "Local Pros",
    installer_logo_url: null,
    installer_avatar_url: null,
    installer_is_pro: true,
    installer_completed_jobs: 12,
    installer_pricing: null,
  }),
}));
vi.mock("@/app/actions/installer", () => ({ validateServiceArea: async () => ({ inArea: state.inArea }) }));
vi.mock("@/app/actions/gatekeeper", () => ({
  gatekeeperCheck: async () => ({ available: !!state.local, installer_id: state.local, installer_name: "Local Pros" }),
  joinWaitlist: async () => ({ success: true }),
}));
vi.mock("@/app/actions/pro-trial", () => ({ checkInstallerAtCapacity: async () => ({ atCapacity: state.atCapacity }) }));
vi.mock("@/app/actions/submit-lead", () => ({
  submitNetworkLead: async (input: Record<string, unknown>) => {
    state.submitted.push(input);
    return { success: true, id: "lead-1" };
  },
}));
vi.mock("@/lib/server/plan-build-quote", () => ({
  priceDesignForInstaller: async () => ({ units: [{ desc: "Standard: 4W × 4H", price: 1200 }], total: 1200, totes: false }),
}));

import { findPlanBuilder, requestPlanBuild } from "./plan-build-request";

const design = "H4x4wt";
const request = (installerId: string, extra: Record<string, unknown> = {}) =>
  requestPlanBuild({ design, installerId, zip: "68102", includeTotes: false, name: "Pat", email: "pat@example.com", ...extra });

beforeEach(() => {
  state.cookie = null;
  state.inArea = true;
  state.local = null;
  state.atCapacity = false;
  state.submitted = [];
});

describe("findPlanBuilder", () => {
  it("sends a referred customer straight back to their installer", async () => {
    const r = await findPlanBuilder({ ref: REFERRER });
    expect(r).toMatchObject({ status: "found", builder: { id: REFERRER, referred: true } });
  });

  it("remembers the referral from the cookie", async () => {
    state.cookie = REFERRER;
    expect(await findPlanBuilder({})).toMatchObject({ status: "found", builder: { id: REFERRER, referred: true } });
  });

  it("asks for a ZIP when nobody referred the customer", async () => {
    expect(await findPlanBuilder({})).toEqual({ status: "needs_zip" });
  });

  it("finds the local installer for a ZIP, or offers the waitlist", async () => {
    state.local = LOCAL;
    expect(await findPlanBuilder({ zip: "68102" })).toMatchObject({ status: "found", builder: { id: LOCAL, referred: false } });
    state.local = null;
    expect(await findPlanBuilder({ zip: "99999" })).toEqual({ status: "none", zip: "99999" });
  });

  it("falls back to the local installer when the referring one doesn't serve the ZIP", async () => {
    state.inArea = false;
    state.local = LOCAL;
    expect(await findPlanBuilder({ ref: REFERRER, zip: "68102" })).toMatchObject({ status: "found", builder: { id: LOCAL, referred: false } });
  });
});

describe("requestPlanBuild — lead source decides the fee", () => {
  it("books the referring installer as a direct lead (3%)", async () => {
    const r = await request(REFERRER, { ref: REFERRER });
    expect(r).toEqual({ ok: true, leadId: "lead-1", waitlisted: false });
    expect(state.submitted[0]).toMatchObject({ installer_id: REFERRER, source: "partner_link", grand_total: 1200, address_zip: "68102" });
    expect(state.submitted[0]).not.toHaveProperty("referring_installer_id");
  });

  it("books a ZIP-matched installer as a network lead (15%)", async () => {
    await request(LOCAL);
    expect(state.submitted[0]).toMatchObject({ installer_id: LOCAL, source: "platform" });
  });

  it("credits the referring installer as the network-bounty referrer when someone else builds it", async () => {
    state.cookie = REFERRER;
    await request(LOCAL);
    expect(state.submitted[0]).toMatchObject({ installer_id: LOCAL, source: "platform", referring_installer_id: REFERRER });
  });

  it("captures the lead as waitlisted when the installer is at capacity", async () => {
    state.atCapacity = true;
    const r = await request(LOCAL);
    expect(r).toEqual({ ok: true, leadId: "lead-1", waitlisted: true });
    expect(state.submitted[0]).toMatchObject({ waitlisted: true });
  });

  it("prices on the server and rejects bad input", async () => {
    expect(await request(LOCAL, { zip: "12" })).toEqual({ ok: false, error: "Enter your 5-digit ZIP code." });
    expect((await request("not-an-id")).ok).toBe(false);
    expect(state.submitted).toHaveLength(0);
  });
});
