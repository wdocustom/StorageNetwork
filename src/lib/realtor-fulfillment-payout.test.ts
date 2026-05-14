import { describe, it, expect } from "vitest";

// The math + constants live in a plain lib module (not the "use server"
// action surface) precisely so we can unit-test without dragging
// `server-only` through the import graph.
import { calcInstallerLegFeeCents } from "@/lib/realtor-fulfillment-payout";

describe("calcInstallerLegFeeCents", () => {
  it("returns base + per-tote bonus per leg", () => {
    // Per the v1 rate ($20 base + $2/tote per leg):
    expect(calcInstallerLegFeeCents(4)).toBe(2800);  // Starter — $28/leg → $56/gift
    expect(calcInstallerLegFeeCents(8)).toBe(3600);  // Standard — $36/leg → $72/gift
    expect(calcInstallerLegFeeCents(12)).toBe(4400); // Pro — $44/leg → $88/gift
    expect(calcInstallerLegFeeCents(20)).toBe(6000); // Premium — $60/leg → $120/gift
  });

  it("returns just the base for zero totes (edge case)", () => {
    expect(calcInstallerLegFeeCents(0)).toBe(2000);
  });

  it("clamps negative/NaN inputs to zero", () => {
    expect(calcInstallerLegFeeCents(-3)).toBe(0);
    expect(calcInstallerLegFeeCents(NaN)).toBe(0);
    expect(calcInstallerLegFeeCents(Infinity)).toBe(0);
  });

  it("floors fractional tote counts before applying the bonus", () => {
    // The DB column is int4, so this shouldn't happen in practice, but
    // the helper is defensive.
    expect(calcInstallerLegFeeCents(4.9)).toBe(2800); // floor(4.9) = 4
    expect(calcInstallerLegFeeCents(4.1)).toBe(2800);
  });

  it("scales linearly with tote count", () => {
    const at5 = calcInstallerLegFeeCents(5);
    const at10 = calcInstallerLegFeeCents(10);
    // Bonus difference = 5 totes * $2 = $10 = 1000 cents.
    expect(at10 - at5).toBe(1000);
  });
});
