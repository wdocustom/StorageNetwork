import { describe, it, expect } from "vitest";

// The math + constants live in a plain lib module (not the "use server"
// action surface) precisely so we can unit-test without dragging
// `server-only` through the import graph.
import { calcInstallerPayoutCents } from "@/lib/realtor-fulfillment-payout";

describe("calcInstallerPayoutCents", () => {
  it("returns base + per-tote bonus for one gift (delivery + pickup combined)", () => {
    // Per the v2 rate ($20 base + $2/tote per gift, single payout):
    expect(calcInstallerPayoutCents(10)).toBe(4000);  // $40
    expect(calcInstallerPayoutCents(20)).toBe(6000);  // $60
    expect(calcInstallerPayoutCents(30)).toBe(8000);  // $80
    expect(calcInstallerPayoutCents(50)).toBe(12000); // $120
  });

  it("returns just the base for zero totes (edge case)", () => {
    expect(calcInstallerPayoutCents(0)).toBe(2000);
  });

  it("clamps negative/NaN inputs to zero", () => {
    expect(calcInstallerPayoutCents(-3)).toBe(0);
    expect(calcInstallerPayoutCents(NaN)).toBe(0);
    expect(calcInstallerPayoutCents(Infinity)).toBe(0);
  });

  it("floors fractional tote counts before applying the bonus", () => {
    // The DB column is int4, so this shouldn't happen in practice, but
    // the helper is defensive.
    expect(calcInstallerPayoutCents(4.9)).toBe(2800); // floor(4.9) = 4 → 2000 + 800
    expect(calcInstallerPayoutCents(4.1)).toBe(2800);
  });

  it("scales linearly with tote count", () => {
    const at5 = calcInstallerPayoutCents(5);
    const at10 = calcInstallerPayoutCents(10);
    // Bonus difference = 5 totes * $2 = $10 = 1000 cents.
    expect(at10 - at5).toBe(1000);
  });
});
