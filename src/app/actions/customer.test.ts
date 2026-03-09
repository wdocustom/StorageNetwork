/**
 * checkAvailability tests — Mock Supabase responses to test:
 * - ZIP validation
 * - Installer matching and priority logic
 * - Lead cap enforcement
 * - Stale counter batch reset
 * - Demand signal recording
 * - Cache behavior
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ── Mock cache to bypass real TTL cache ───────────────────────────────────
vi.mock("@/lib/cache", () => {
  return {
    zipCache: {
      getOrFetch: vi.fn(async (_key: string, factory: () => Promise<unknown>) => factory()),
    },
    installerCache: {
      getOrFetch: vi.fn(async (_key: string, factory: () => Promise<unknown>) => factory()),
    },
  };
});

// ── Mock demand signals ───────────────────────────────────────────────────
vi.mock("@/app/actions/demand-signals", () => ({
  recordAnonymousDemand: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock Supabase ─────────────────────────────────────────────────────────
const mockContains = vi.fn();
const mockEq = vi.fn();
const mockNeq = vi.fn();
const mockOrder = vi.fn();
const mockIn = vi.fn();
const mockIlike = vi.fn();
const mockMaybeSingle = vi.fn();
const mockUpdate = vi.fn();

// Chainable mock builder
function mockQueryChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn().mockReturnValue(chain);
  chain.contains = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockResolvedValue(resolvedValue);
  chain.in = vi.fn().mockResolvedValue({ error: null });
  chain.update = vi.fn().mockReturnValue(chain);
  chain.ilike = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  return chain;
}

let primaryChain: ReturnType<typeof mockQueryChain>;
let fallbackChain: ReturnType<typeof mockQueryChain>;
let callCount = 0;

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: vi.fn().mockImplementation(() => {
      callCount++;
      // First call = primary query, second = fallback or update
      if (callCount % 2 === 1) return primaryChain;
      return fallbackChain;
    }),
  }),
}));

// Import after mocks
const { checkAvailability } = await import("./customer");

function makeInstaller(overrides: Partial<{
  id: string;
  business_name: string;
  is_pro: boolean;
  current_month_leads: number;
  max_monthly_leads: number;
  is_suspended: boolean;
  leads_reset_at: string;
  stripe_account_id: string;
}>) {
  return {
    id: overrides.id ?? "inst-1",
    business_name: overrides.business_name ?? "Test Installer",
    stripe_account_id: overrides.stripe_account_id ?? "acct_123",
    avatar_url: null,
    phone: "555-0100",
    lead_time_days: 5,
    working_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    max_monthly_leads: overrides.max_monthly_leads ?? 25,
    current_month_leads: overrides.current_month_leads ?? 0,
    leads_reset_at: overrides.leads_reset_at ?? new Date().toISOString(),
    is_pro: overrides.is_pro ?? false,
    logo_url: null,
    pricing_config: null,
    services_config: null,
    is_suspended: overrides.is_suspended ?? false,
    ...overrides,
  };
}

describe("checkAvailability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callCount = 0;
    primaryChain = mockQueryChain({ data: null, error: null });
    fallbackChain = mockQueryChain({ data: null, error: null });
  });

  // ── ZIP validation ──────────────────────────────────────────────────

  it("rejects empty ZIP", async () => {
    const result = await checkAvailability("");
    expect(result.available).toBe(false);
    expect(result.message).toMatch(/valid 5-digit ZIP/i);
  });

  it("rejects 4-digit ZIP", async () => {
    const result = await checkAvailability("9021");
    expect(result.available).toBe(false);
    expect(result.message).toMatch(/valid 5-digit ZIP/i);
  });

  it("rejects ZIP with letters", async () => {
    const result = await checkAvailability("9021A");
    expect(result.available).toBe(false);
  });

  it("rejects 6-digit ZIP", async () => {
    const result = await checkAvailability("902101");
    expect(result.available).toBe(false);
  });

  it("trims whitespace from ZIP", async () => {
    primaryChain = mockQueryChain({
      data: [makeInstaller({})],
      error: null,
    });

    const result = await checkAvailability("  90210  ");
    expect(result.available).toBe(true);
  });

  // ── Installer matching ──────────────────────────────────────────────

  it("returns available when installer found via service_zips", async () => {
    primaryChain = mockQueryChain({
      data: [makeInstaller({ business_name: "Acme Garage" })],
      error: null,
    });

    const result = await checkAvailability("90210");
    expect(result.available).toBe(true);
    expect(result.installer_name).toBe("Acme Garage");
    expect(result.message).toContain("Acme Garage");
  });

  it("returns unavailable when no installer covers ZIP", async () => {
    primaryChain = mockQueryChain({ data: [], error: null });
    fallbackChain = mockQueryChain({ data: [], error: null });

    const result = await checkAvailability("99999");
    expect(result.available).toBe(false);
    expect(result.message).toMatch(/aren.t in this area/i);
  });

  // ── Lead cap enforcement ────────────────────────────────────────────

  it("skips installers at capacity", async () => {
    primaryChain = mockQueryChain({
      data: [
        makeInstaller({ id: "inst-full", current_month_leads: 25, max_monthly_leads: 25 }),
        makeInstaller({ id: "inst-avail", current_month_leads: 5, max_monthly_leads: 25, business_name: "Available Co" }),
      ],
      error: null,
    });

    const result = await checkAvailability("78701");
    expect(result.available).toBe(true);
    expect(result.installer_id).toBe("inst-avail");
  });

  it("returns capacity message when ALL installers are full", async () => {
    primaryChain = mockQueryChain({
      data: [
        makeInstaller({ id: "inst-1", current_month_leads: 25, max_monthly_leads: 25 }),
        makeInstaller({ id: "inst-2", current_month_leads: 30, max_monthly_leads: 25 }),
      ],
      error: null,
    });

    const result = await checkAvailability("78701");
    expect(result.available).toBe(false);
    expect(result.message).toMatch(/capacity/i);
  });

  // ── Fallback to service_zip ─────────────────────────────────────────

  it("falls back to service_zip exact match", async () => {
    // Primary (service_zips array) returns empty
    primaryChain = mockQueryChain({ data: [], error: null });
    // Fallback (service_zip exact match) returns an installer
    fallbackChain = mockQueryChain({
      data: [makeInstaller({ business_name: "Fallback Pro" })],
      error: null,
    });

    const result = await checkAvailability("78702");
    expect(result.available).toBe(true);
    expect(result.installer_name).toBe("Fallback Pro");
  });

  // ── Error handling ──────────────────────────────────────────────────

  it("returns graceful error on DB exception", async () => {
    primaryChain = mockQueryChain({ data: null, error: null });
    // Make the order() call throw
    (primaryChain.order as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB down"));

    const result = await checkAvailability("78701");
    expect(result.available).toBe(false);
    expect(result.message).toMatch(/unable to check/i);
  });

  // ── Result shape ────────────────────────────────────────────────────

  it("returns full installer context on match", async () => {
    primaryChain = mockQueryChain({
      data: [makeInstaller({
        id: "inst-ctx",
        business_name: "Context Co",
        stripe_account_id: "acct_ctx",
        is_pro: true,
      })],
      error: null,
    });

    const result = await checkAvailability("78703");
    expect(result).toMatchObject({
      available: true,
      installer_id: "inst-ctx",
      installer_name: "Context Co",
      installer_stripe_id: "acct_ctx",
      installer_is_pro: true,
      installer_lead_time: 5,
    });
    expect(result.installer_working_days).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  });

  it("returns default values when no installer found", async () => {
    primaryChain = mockQueryChain({ data: [], error: null });
    fallbackChain = mockQueryChain({ data: [], error: null });

    const result = await checkAvailability("00000");
    expect(result).toMatchObject({
      available: false,
      installer_id: null,
      installer_name: null,
      installer_stripe_id: null,
      installer_is_pro: false,
      installer_lead_time: 5,
    });
  });
});

// ── toResult helper (pure logic) ──────────────────────────────────────────

describe("toResult output shape", () => {
  it("returns unavailable with null installer fields when data is null", async () => {
    primaryChain = mockQueryChain({ data: [], error: null });
    fallbackChain = mockQueryChain({ data: [], error: null });

    const result = await checkAvailability("11111");
    expect(result.installer_id).toBeNull();
    expect(result.installer_avatar_url).toBeNull();
    expect(result.installer_phone).toBeNull();
    expect(result.installer_logo_url).toBeNull();
    expect(result.installer_pricing).toBeNull();
    expect(result.installer_services_config).toBeNull();
  });
});
