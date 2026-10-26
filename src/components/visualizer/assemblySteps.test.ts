import { describe, expect, it } from "vitest";
import { computeMaterials, getStepsForConfig, railTopMarks2x4, resolveTokens, upright2x4 } from "./assemblySteps";

describe("assembly steps", () => {
  it("keeps the installer default (plywood rails) unchanged", () => {
    const steps = getStepsForConfig({ hasWheels: true, hasTop: true, toteType: "HDX" });
    expect(steps.map((s) => s.id)).toContain("install-back-supports");
    const rip = steps.find((s) => s.id === "rip-rails")!;
    expect(rip.title).toBe("Rip the Plywood Rails");
    const ladders = steps.find((s) => s.id === "build-ladders")!;
    expect(ladders.screwType?.label).toBe('#9 × 1-5/8" Star Drive');
    const config = { hasWheels: true, hasTop: true, toteType: "HDX" as const };
    expect(computeMaterials(steps[0], 4, 4, config)).toEqual([{ name: "2×4 × 8' Studs", qty: "10", detail: 'Cut to 64"' }]);
    expect(resolveTokens("Space at OPENING_SPAN, plates PLATE_LENGTH", 4, 4, config)).toBe('Space at 19-3/4", plates 86-1/2"');
  });

  it("swaps in 2×4-rail steps without changing ids", () => {
    const plywood = getStepsForConfig({ hasWheels: false, hasTop: false });
    const twoByFour = getStepsForConfig({ hasWheels: false, hasTop: false, rails: "2x4" });
    expect(twoByFour.map((s) => s.id)).toEqual(plywood.map((s) => s.id));
    const config = { hasWheels: false, hasTop: false, rails: "2x4" as const };
    expect(resolveTokens("OPENING_SPAN / PLATE_LENGTH / UPRIGHT_HEIGHT", 4, 4, config)).toBe('21" / 91-1/2" / 63-3/4"');
  });

  it("braces 2×4-rail frames with ripped 2×4s right after the top plates", () => {
    const config = { hasWheels: true, hasTop: false, rails: "2x4" as const };
    const steps = getStepsForConfig(config);
    const ids = steps.map((s) => s.id);
    expect(ids.indexOf("install-back-supports")).toBe(ids.indexOf("attach-top-plates") + 1);
    const brace = steps[ids.indexOf("install-back-supports")];
    expect(brace.title).toBe("Install Back Braces");
    expect(brace.screwType?.label).toBe('#9 × 3" Star Drive');
    expect(brace.partStates.backSupports).toBe("visible");
    expect(steps[ids.indexOf("attach-top-plates")].partStates.backSupports).toBe("hidden");
    expect(computeMaterials(brace, 4, 4, config).map((m) => [m.name, m.qty])).toEqual([
      ["2×4 Back Braces", "4"],
      ['#9 × 3" Screws', "16"],
    ]);
    expect(resolveTokens(brace.instruction, 4, 4, config)).not.toMatch(/BACK_BRACE_EXTRA|middle upright/);
    expect(resolveTokens(brace.instruction, 6, 4, config)).toContain("2 more at the middle upright");
    // 4×4: 32 rails + 4 braces = 36 pieces = 6 boards
    const rip = steps[ids.indexOf("rip-rails")];
    expect(computeMaterials(rip, 4, 4, config).find((m) => m.name === "2×4 × 8' Boards")?.qty).toBe("6");
  });

  it("matches the build engine's 2×4-rail heights", () => {
    expect([1, 2, 3, 4, 5, 6].map(upright2x4)).toEqual([16.5, 32.25, 48, 63.75, 79.5, 96]);
    expect(railTopMarks2x4(6)).toEqual([14.625, 30.375, 46.125, 61.875, 77.625, 93.375]);
  });
});
