import { describe, expect, it } from "vitest";
import {
  TOTE_PLAN_TIERS,
  TOTE_PLAN_UPGRADE_PRICE,
  collapsedPresetName,
  decodeTotePlanDesign,
  designFromItems,
  designFromSearchParams,
  designLayout,
  designModules,
  encodeTotePlanDesign,
  fitTotePlanToWall,
  formatPlanPrice,
  isTotePlanTier,
  parseTotePlanDesign,
  splitHeight,
  splitWidth,
  totePlanDesignHref,
  totePlanName,
  unitOuterSize,
} from "./tote-plans";

const unit = { cols: 4, rows: 4, toteType: "HDX", hasWheels: true, hasTop: true } as const;

describe("parseTotePlanDesign", () => {
  it("accepts a design and keeps only the fields plans need", () => {
    expect(
      parseTotePlanDesign({ units: [{ ...unit, unitType: "standard", orientation: "standard", totalW: 86.5 }], name: "Shop Wall" }),
    ).toEqual({ units: [unit], name: "Shop Wall" });
  });

  it("reads a legacy single-unit config (purchases before multi-unit plans)", () => {
    expect(parseTotePlanDesign({ ...unit, unitType: "standard" })).toEqual({ units: [unit] });
  });

  it("rejects the whole design if any unit can't be modeled", () => {
    expect(parseTotePlanDesign({ units: [unit, { ...unit, unitType: "mini" }] })).toBeNull();
    expect(parseTotePlanDesign({ units: [{ ...unit, orientation: "sideways" }] })).toBeNull();
    expect(parseTotePlanDesign({ units: [{ ...unit, cols: 25 }] })).toBeNull();
    expect(parseTotePlanDesign({ units: [{ ...unit, rows: 11 }] })).toBeNull();
    expect(parseTotePlanDesign({ units: [{ ...unit, cols: 2.5 }] })).toBeNull();
    expect(parseTotePlanDesign({ units: [{ ...unit, toteType: "Sterilite" }] })).toBeNull();
    expect(parseTotePlanDesign({ units: Array(9).fill(unit) })).toBeNull();
    expect(parseTotePlanDesign({ units: [] })).toBeNull();
    expect(parseTotePlanDesign(null)).toBeNull();
  });

  it("allows big walls — any size the designer allows", () => {
    expect(parseTotePlanDesign({ units: [{ ...unit, cols: 24, rows: 10 }] })).not.toBeNull();
  });

  it("strips markup from names", () => {
    expect(parseTotePlanDesign({ units: [unit], name: "<b>Indiana Joe</b>" })?.name).toBe("bIndiana Joeb");
  });
});

describe("compact encoding", () => {
  it("round-trips through URLs and Stripe metadata", () => {
    const design = parseTotePlanDesign({
      units: [unit, { cols: 2, rows: 2, toteType: "GM", hasWheels: false, hasTop: false }],
    })!;
    const code = encodeTotePlanDesign(design);
    expect(code).toBe("H4x4wt.G2x2");
    expect(decodeTotePlanDesign(code)).toEqual(design);
  });

  it("keeps eight big units well under Stripe's 500-character metadata limit", () => {
    expect(encodeTotePlanDesign({ units: Array(8).fill({ ...unit, cols: 24, rows: 10 }) }).length).toBeLessThan(100);
  });

  it("rejects junk", () => {
    expect(decodeTotePlanDesign("H4x4q")).toBeNull();
    expect(decodeTotePlanDesign("X4x4")).toBeNull();
    expect(decodeTotePlanDesign("H0x4")).toBeNull();
    expect(decodeTotePlanDesign("")).toBeNull();
  });

  it("reads ?design= and legacy ?config= links", () => {
    const params = (o: Record<string, string>) => new URLSearchParams(o);
    expect(designFromSearchParams(params({ design: "H2x4t", name: "Long Ranger" }))).toEqual({
      units: [{ cols: 2, rows: 4, toteType: "HDX", hasWheels: false, hasTop: true }],
      name: "Long Ranger",
    });
    expect(designFromSearchParams(params({ config: JSON.stringify(unit) }))).toEqual({ units: [unit] });
    expect(designFromSearchParams(params({}))).toBeNull();
  });

  it("builds pre-filled designer links", () => {
    expect(totePlanDesignHref({ units: [unit], name: "Shop Wall" }, "quote_email")).toBe(
      "/plans/checkout?design=H4x4wt&name=Shop+Wall&utm_source=quote_email",
    );
  });
});

describe("modules — must match the build engine's split", () => {
  it("splits width into 4s and height into 6s", () => {
    expect(splitWidth(4)).toEqual([4]);
    expect(splitWidth(6)).toEqual([4, 2]);
    expect(splitWidth(9)).toEqual([4, 4, 1]);
    expect(splitHeight(6)).toEqual([6]);
    expect(splitHeight(10)).toEqual([6, 4]);
  });

  it("groups identical modules into lettered types (Indiana Joe)", () => {
    const { modules, types } = designModules(decodeTotePlanDesign("H2x4t.H2x2t.H2x4t")!);
    expect(types.map((t) => [t.letter, `${t.cols}x${t.rows}`, t.count, t.hasTop])).toEqual([
      ["A", "2x4", 2, true],
      ["B", "2x2", 1, true],
    ]);
    expect(modules.map((m) => m.type)).toEqual(["A", "B", "A"]);
  });

  it("puts casters only under bottom-tier modules and the top on the unit when split", () => {
    const { modules } = designModules(decodeTotePlanDesign("H6x8wt")!);
    expect(modules.map((m) => [m.key, m.cols, m.rows, m.hasWheels, m.hasTop])).toEqual([
      ["0-0-0", 4, 6, true, false],
      ["0-1-0", 2, 6, true, false],
      ["0-0-1", 4, 2, false, false],
      ["0-1-1", 2, 2, false, false],
    ]);
  });
});

describe("geometry", () => {
  it("matches the plan generator for one module", () => {
    expect(unitOuterSize(unit)).toEqual({ widthIn: 86.5, heightIn: 72.25, depthIn: 30 });
  });

  it("adds an upright at every module seam and plates for every tier", () => {
    // 6 wide = 4-wide (86.5) + 2-wide (44); 8 tall = 6-tier (101.5) + 2-tier (37.5)
    expect(unitOuterSize({ ...unit, cols: 6, rows: 8, hasWheels: false })).toEqual({
      widthIn: 130.5,
      heightIn: 139,
      depthIn: 30,
    });
  });

  it("fits a 150 x 104 inch wall with a 6×6", () => {
    expect(fitTotePlanToWall(150, 104, { toteType: "HDX", hasWheels: false })).toEqual({ cols: 6, rows: 6 });
  });

  it("picks the largest grid that fits, capped at plan limits", () => {
    expect(fitTotePlanToWall(86.5, 72.25, { toteType: "HDX", hasWheels: true })).toEqual({ cols: 4, rows: 4 });
    expect(fitTotePlanToWall(86, 72, { toteType: "HDX", hasWheels: true })).toEqual({ cols: 3, rows: 3 });
    expect(fitTotePlanToWall(9999, 9999, { toteType: "GM", hasWheels: false })).toEqual({ cols: 24, rows: 10 });
    expect(fitTotePlanToWall(15, 100, { toteType: "HDX", hasWheels: false })).toBeNull();
    expect(fitTotePlanToWall(NaN, 100, { toteType: "HDX", hasWheels: false })).toBeNull();
  });

  it("lays units side by side and stacks tiers from the floor", () => {
    const layout = designLayout(decodeTotePlanDesign("H4x4w.H6x8")!, 8);
    expect(layout.units.map((u) => [u.x, u.w])).toEqual([
      [0, 86.5],
      [94.5, 130.5],
    ]);
    const upper = layout.modules.find((m) => m.key === "1-0-1")!;
    expect(upper.y).toBe(101.5);
    expect(layout.modules.find((m) => m.key === "0-0-0")!.y).toBe(2.75); // on casters
  });
});

describe("designFromItems — designer carts and saved quotes", () => {
  it("breaks a designer bestseller into its sub-units and keeps its name", () => {
    const { design, covered, skipped } = designFromItems(
      [
        {
          toteType: "HDX",
          unitType: "standard",
          orientation: "standard",
          desc: "Indiana Joe (2x4 + 2x2 + 2x4)",
          presetUnits: [
            { cols: 2, rows: 4, hasTop: true, hasWheels: false },
            { cols: 2, rows: 2, hasTop: true, hasWheels: false },
            { cols: 2, rows: 4, hasTop: true, hasWheels: false },
          ],
        },
      ],
      "Indiana Joe",
    );
    expect(encodeTotePlanDesign(design!)).toBe("H2x4t.H2x2t.H2x4t");
    expect(design!.name).toBe("Indiana Joe");
    expect([covered, skipped]).toEqual([1, 0]);
  });

  it("rebuilds a bestseller the installer dashboard collapsed into one quote line", () => {
    // Saved as the FIRST sub-unit's size — must not become a single 1×4 plan
    const { design } = designFromItems([
      {
        cols: 1,
        rows: 4,
        toteType: "HDX",
        unitType: "standard",
        orientation: "standard",
        hasWheels: false,
        hasTop: true,
        desc: "The Gass Station (1×4 + 4×2 + 1×4 — 16 slots, Totes, Top)",
      },
    ]);
    expect(encodeTotePlanDesign(design!)).toBe("H1x4t.H4x2t.H1x4t");
  });

  it("skips a collapsed bestseller it can't identify rather than guess", () => {
    const { design, skipped } = designFromItems([
      { cols: 2, rows: 4, toteType: "HDX", desc: "Mystery Build (2×4 + 3×3 — 17 slots, Totes)" },
    ]);
    expect(design).toBeNull();
    expect(skipped).toBe(1);
  });

  it("repeats a unit by quantity and skips non-tote items", () => {
    const { design, covered, skipped } = designFromItems([
      { cols: 3, rows: 3, toteType: "GM", hasWheels: true, hasTop: false, quantity: 2 },
      { shelvingConfigId: "shelf-48" },
      { chairConfig: { finish: "natural" } },
      { cols: 4, rows: 3, toteType: "HDX", unitType: "mini" },
    ]);
    expect(encodeTotePlanDesign(design!)).toBe("G3x3w.G3x3w");
    expect([covered, skipped]).toEqual([1, 3]);
  });

  it("returns no design when nothing is plannable", () => {
    expect(designFromItems([{ shelvingConfigId: "x" }]).design).toBeNull();
    expect(designFromItems([]).design).toBeNull();
  });

  it("recognizes collapsed bestseller descriptions only", () => {
    expect(collapsedPresetName("Indiana Joe (2×4 + 2×2 + 2×4 — 20 slots, Totes, Top)")).toBe("Indiana Joe");
    expect(collapsedPresetName("Track Norris (4×2 — 8 slots, Totes, Top)")).toBe("Track Norris");
    expect(collapsedPresetName("Standard: 4W × 4H")).toBeNull();
    expect(collapsedPresetName("Indiana Joe (2x4 + 2x2 + 2x4)")).toBeNull();
    expect(collapsedPresetName(undefined)).toBeNull();
  });
});

describe("naming and tiers", () => {
  it("names designs", () => {
    expect(totePlanName({ units: [unit] })).toBe("4×4 Tote Organizer");
    expect(totePlanName({ units: [unit, unit] })).toBe("2-Unit Tote Organizer System");
    expect(totePlanName({ units: [unit], name: "Long Ranger" })).toBe("Long Ranger");
  });

  it("prices the upgrade as the difference between tiers", () => {
    expect(TOTE_PLAN_UPGRADE_PRICE).toBe(TOTE_PLAN_TIERS.interactive.price - TOTE_PLAN_TIERS.pdf.price);
    expect(formatPlanPrice(TOTE_PLAN_UPGRADE_PRICE)).toBe("$10");
    expect(isTotePlanTier("pdf")).toBe(true);
    expect(isTotePlanTier("pro")).toBe(false);
  });
});
