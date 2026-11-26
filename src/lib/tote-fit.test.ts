import { describe, expect, it } from "vitest";
import { rails2x4Bay, RAIL_2X4_BAY, RAIL_2X4_BAY_SIDEWAYS, toteFit2x4, toteSizeClass } from "./rails2x4";

// Every 27-gallon tote must hang by its rim on both rails AND drop its body
// between them, in the bay the app gives it. Minimums: 1/2" of rim on each
// rail, 1/8" of body clearance each side (the Greenmade body is an estimate,
// so its real clearance is likely larger).

const MIN_BEARING = 0.5;
const MIN_CLEARANCE = 0.125;

describe("2×4-rail bays fit the totes they're built for", () => {
  for (const tote of ["HDX", "GM"] as const) {
    for (const sideways of [false, true]) {
      it(`${tote} ${sideways ? "sideways" : "upright"}`, () => {
        const fit = toteFit2x4(tote, sideways);
        expect(fit.rimBearing).toBeGreaterThanOrEqual(MIN_BEARING);
        expect(fit.bodyClearance).toBeGreaterThanOrEqual(MIN_CLEARANCE);
      });
    }
  }

  it("uses one universal upright bay", () => {
    expect(rails2x4Bay(false, "HDX")).toBe(RAIL_2X4_BAY);
    expect(rails2x4Bay(false, "GM")).toBe(RAIL_2X4_BAY);
  });

  it("can't share a sideways bay: each brand fails in the other's", () => {
    // Greenmade body jams in the HDX sideways bay
    expect(toteFit2x4("GM", true, RAIL_2X4_BAY_SIDEWAYS.HDX).bodyClearance).toBeLessThan(MIN_CLEARANCE);
    // HDX rim falls through the Greenmade sideways bay
    expect(toteFit2x4("HDX", true, RAIL_2X4_BAY_SIDEWAYS.GM).rimBearing).toBeLessThan(0);
  });

  it("treats unknown / legacy tote types as HDX size", () => {
    expect(toteSizeClass(undefined)).toBe("HDX");
    expect(toteSizeClass("MINI")).toBe("HDX");
    expect(rails2x4Bay(true, null)).toBe(30.25);
    expect(rails2x4Bay(true, "GM")).toBe(32);
  });
});
