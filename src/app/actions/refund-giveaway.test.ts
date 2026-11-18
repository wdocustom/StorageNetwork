import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const inserted: Record<string, unknown>[] = [];
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "vitest", "x-forwarded-for": "203.0.113.9" }),
}));
vi.mock("@/lib/server/action-rate-limit", () => ({
  enforceActionRateLimit: vi.fn(async () => undefined),
  RateLimitError: class RateLimitError extends Error {},
}));
vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        // Same rule as the table's unique (email, entry_date) index.
        if (inserted.some((r) => r.email === row.email && r.entry_date === row.entry_date)) {
          return { error: { code: "23505", message: "duplicate key" } };
        }
        inserted.push(row);
        return { error: null };
      },
    }),
  }),
}));

import { submitFreeEntry } from "./refund-giveaway";
import { REFUND_GIVEAWAY, centralDate, formatGiveawayDate, giveawayStatus } from "@/lib/refund-giveaway";

const original = { ...REFUND_GIVEAWAY };

describe("refund giveaway helpers", () => {
  afterEach(() => Object.assign(REFUND_GIVEAWAY, original));

  it("uses the Central Time calendar day", () => {
    // 03:30 UTC on Dec 2 is still Dec 1 in Chicago (CST, UTC-6).
    expect(centralDate(new Date("2026-12-02T03:30:00Z"))).toBe("2026-12-01");
    expect(centralDate(new Date("2026-12-02T06:30:00Z"))).toBe("2026-12-02");
  });

  it("is unscheduled until both dates are set, then follows the CT window", () => {
    expect(giveawayStatus()).toBe("unscheduled");
    Object.assign(REFUND_GIVEAWAY, { startDate: "2026-12-01", endDate: "2026-12-24" });
    expect(giveawayStatus(new Date("2026-12-01T05:59:00Z"))).toBe("upcoming"); // 11:59 PM Nov 30 CT
    expect(giveawayStatus(new Date("2026-12-01T06:00:00Z"))).toBe("active");
    expect(giveawayStatus(new Date("2026-12-25T05:59:00Z"))).toBe("active"); // 11:59 PM Dec 24 CT
    expect(giveawayStatus(new Date("2026-12-25T06:00:00Z"))).toBe("ended");
  });

  it("formats dates for the rules", () => {
    expect(formatGiveawayDate("2026-12-01")).toBe("December 1, 2026");
  });
});

describe("submitFreeEntry", () => {
  beforeEach(() => {
    inserted.length = 0;
    const today = centralDate();
    Object.assign(REFUND_GIVEAWAY, { startDate: today, endDate: today });
  });
  afterEach(() => Object.assign(REFUND_GIVEAWAY, original));

  it("refuses entries when the promotion isn't running", async () => {
    Object.assign(REFUND_GIVEAWAY, { startDate: null, endDate: null });
    const r = await submitFreeEntry({ name: "Jane Doe", email: "jane@example.com" });
    expect(r.ok).toBe(false);
    expect(inserted).toHaveLength(0);
  });

  it("stores one entry per email per day", async () => {
    const first = await submitFreeEntry({ name: "  Jane   Doe ", email: "Jane@Example.com" });
    expect(first).toEqual({ ok: true, entryDate: centralDate() });
    expect(inserted[0]).toMatchObject({ full_name: "Jane Doe", email: "jane@example.com", user_agent: "vitest" });

    const again = await submitFreeEntry({ name: "Jane Doe", email: "jane@example.com" });
    expect(again.ok).toBe(false);
    expect(!again.ok && again.error).toMatch(/already entered today/);
    expect(inserted).toHaveLength(1);
  });

  it("validates the full name and email", async () => {
    expect(await submitFreeEntry({ name: "Jane", email: "jane@example.com" })).toMatchObject({ ok: false, field: "name" });
    expect(await submitFreeEntry({ name: "Jane Doe", email: "not-an-email" })).toMatchObject({ ok: false, field: "email" });
    expect(inserted).toHaveLength(0);
  });

  it("quietly drops honeypot submissions", async () => {
    const r = await submitFreeEntry({ name: "Bot Person", email: "bot@example.com", website: "http://spam" });
    expect(r.ok).toBe(true);
    expect(inserted).toHaveLength(0);
  });
});
