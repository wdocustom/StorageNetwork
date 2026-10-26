import { describe, expect, it } from "vitest";
import { braceLayout2x4, computeMaterials, getStepsForConfig, railTopMarks2x4, resolveTokens, upright2x4 } from "./assemblySteps";

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
    expect(resolveTokens(brace.instruction, 4, 4, config)).toContain("Use the 30\" ripped pieces as-is");
    expect(resolveTokens(brace.instruction, 4, 4, config)).not.toMatch(/BACK_BRACE_LAYOUT|middle upright/);
    expect(resolveTokens(brace.instruction, 6, 4, config)).toContain("2 more at the middle upright");
    // 4×4: 32 rails + 4 braces = 36 pieces = 6 boards
    const rip = steps[ids.indexOf("rip-rails")];
    expect(computeMaterials(rip, 4, 4, config).find((m) => m.name === "2×4 × 8' Boards")?.qty).toBe("6");
  });

  it("sizes 2×4 back braces to the frame: shorter corners at 2 high, plate-to-plate diagonals at 1 high", () => {
    expect(braceLayout2x4(4, 4)).toMatchObject({ style: "corner", length: 30 });
    expect(braceLayout2x4(2, 2)).toMatchObject({ style: "corner", length: 21.5 });
    expect(braceLayout2x4(2, 2).segments).toHaveLength(4);
    expect(braceLayout2x4(2, 1)).toMatchObject({ style: "diagonal", length: 25.25 });
    expect(braceLayout2x4(2, 1).segments).toHaveLength(2);
    expect(braceLayout2x4(1, 1).segments).toHaveLength(1);
    const config = { hasWheels: false, hasTop: true, rails: "2x4" as const };
    const brace = getStepsForConfig(config).find((s) => s.id === "install-back-supports")!;
    expect(resolveTokens(brace.instruction, 2, 2, config)).toContain('Cut 4 of your 30" ripped pieces to 21-1/2"');
    expect(resolveTokens(brace.instruction, 2, 1, config)).toContain("from the bottom plate at the corner up to the top plate");
    expect(computeMaterials(brace, 2, 1, config)[0]).toEqual({ name: "2×4 Back Braces", qty: "2", detail: 'Ripped 2×4, cut to 25-1/4"' });
  });

  it("never lets 2×4 back braces cross, overlap or leave the frame", () => {
    const pitch = 22.5;
    // Two centerline segments intersect (or touch) — proper orientation test
    const cross = (a: number[], b: number[]) => {
      const o = (p: number[], q: number[], r: number[]) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
      const [p1, p2, p3, p4] = [a.slice(0, 2), a.slice(2), b.slice(0, 2), b.slice(2)];
      return o(p1, p2, p3) !== o(p1, p2, p4) && o(p3, p4, p1) !== o(p3, p4, p2);
    };
    for (let cols = 1; cols <= 10; cols++) {
      for (let rows = 1; rows <= 6; rows++) {
        const { length, segments } = braceLayout2x4(cols, rows);
        const d = upright2x4(rows) + 1.5;
        expect(length).toBeLessThanOrEqual(30);
        expect(length).toBeGreaterThanOrEqual(13);
        const segs = segments.map((g) => [g.x1, g.y1, g.x2, g.y2]);
        for (const [x1, y1, x2, y2] of segs) {
          for (const x of [x1, x2]) expect(x).toBeGreaterThanOrEqual(0), expect(x).toBeLessThanOrEqual(cols * pitch);
          for (const y of [y1, y2]) expect(y).toBeGreaterThanOrEqual(0), expect(y).toBeLessThanOrEqual(d + 1e-9);
          expect(Math.hypot(x2 - x1, y2 - y1)).toBeCloseTo(length, 6);
        }
        for (let i = 0; i < segs.length; i++)
          for (let j = i + 1; j < segs.length; j++) expect(cross(segs[i], segs[j]), `${cols}×${rows} braces ${i}/${j}`).toBe(false);
      }
    }
  });

  it("matches the build engine's 2×4-rail heights", () => {
    expect([1, 2, 3, 4, 5, 6].map(upright2x4)).toEqual([16.5, 32.25, 48, 63.75, 79.5, 96]);
    expect(railTopMarks2x4(6)).toEqual([14.625, 30.375, 46.125, 61.875, 77.625, 93.375]);
  });
});
