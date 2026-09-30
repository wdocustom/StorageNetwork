import { describe, it, expect } from "vitest";
import { checkSlot, canCustomerChange, effectiveLeadTime, type SlotRules } from "./install-slots";

// 2026-10-01 is a Thursday.
const TODAY = "2026-10-01";
const rules = (over: Partial<SlotRules> = {}): SlotRules => ({
  leadTimeDays: 5,
  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  blackouts: [],
  blocks: {},
  ...over,
});

describe("checkSlot", () => {
  it("accepts a working day after the lead time", () => {
    expect(checkSlot("2026-10-07", "morning", rules(), TODAY)).toEqual({ ok: true }); // Wed
  });

  it("rejects dates inside the lead time", () => {
    expect(checkSlot("2026-10-05", null, rules(), TODAY).ok).toBe(false); // Mon, 4 days out
  });

  it("applies the 3-day minimum for wheels even with a shorter lead time", () => {
    const r = rules({ leadTimeDays: 1, hasWheels: true });
    expect(effectiveLeadTime(r)).toBe(3);
    expect(checkSlot("2026-10-02", null, r, TODAY).ok).toBe(false); // Fri, 1 day out
    expect(checkSlot("2026-10-05", null, r, TODAY).ok).toBe(true); // Mon, 4 days out
  });

  it("rejects non-working days", () => {
    expect(checkSlot("2026-10-10", null, rules(), TODAY).ok).toBe(false); // Sat
  });

  it("rejects blackout ranges", () => {
    const r = rules({ blackouts: [{ start_date: "2026-10-12", end_date: "2026-10-14" }] });
    expect(checkSlot("2026-10-13", null, r, TODAY).ok).toBe(false);
    expect(checkSlot("2026-10-15", null, r, TODAY).ok).toBe(true);
  });

  it("respects morning/afternoon blocks", () => {
    const r = rules({ blocks: { "2026-10-07": { morning: false, afternoon: true } } });
    expect(checkSlot("2026-10-07", "morning", r, TODAY).ok).toBe(false);
    expect(checkSlot("2026-10-07", "afternoon", r, TODAY).ok).toBe(true);
    const full = rules({ blocks: { "2026-10-07": { morning: false, afternoon: false } } });
    expect(checkSlot("2026-10-07", null, full, TODAY).ok).toBe(false);
  });

  it("rejects malformed and far-future dates", () => {
    expect(checkSlot("10/07/2026", null, rules(), TODAY).ok).toBe(false);
    expect(checkSlot("2027-06-01", null, rules(), TODAY).ok).toBe(false);
  });
});

describe("canCustomerChange", () => {
  const now = new Date("2026-10-01T15:00:00Z");
  it("allows setting a first date", () => {
    expect(canCustomerChange(null, now)).toBe(true);
  });
  it("allows changes more than 48 hours out", () => {
    expect(canCustomerChange("2026-10-06", now)).toBe(true);
  });
  it("blocks changes inside 48 hours", () => {
    expect(canCustomerChange("2026-10-03", now)).toBe(false);
  });
});
