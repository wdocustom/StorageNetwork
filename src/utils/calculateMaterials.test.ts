import { describe, it, expect } from "vitest";
import { DEFAULT_MATERIAL_PRICES } from "./calculateMaterials";
import type { MaterialConfig, MaterialBreakdown } from "./calculateMaterials";

// The actual algorithm is in a server action. We test the public types
// and defaults here, and test the algorithm via integration below.
// To test the server action without Next.js runtime, we dynamically import it.

// Since "use server" is a Next.js directive that vitest doesn't understand,
// we mock around it by importing the module directly.
let calculateMaterialCostServer: (
  configs: MaterialConfig | MaterialConfig[],
) => Promise<MaterialBreakdown>;

// Direct import — vitest ignores the "use server" directive
import { calculateMaterialCostServer as calcFn } from "@/app/actions/calculate-materials";

describe("DEFAULT_MATERIAL_PRICES", () => {
  it("has all required price keys", () => {
    expect(DEFAULT_MATERIAL_PRICES).toHaveProperty("lumber_2x4_8ft");
    expect(DEFAULT_MATERIAL_PRICES).toHaveProperty("plywood_sheet");
    expect(DEFAULT_MATERIAL_PRICES).toHaveProperty("tote");
    expect(DEFAULT_MATERIAL_PRICES).toHaveProperty("wheels_4pk");
    expect(DEFAULT_MATERIAL_PRICES).toHaveProperty("screw_1in_90ct");
    expect(DEFAULT_MATERIAL_PRICES).toHaveProperty("screw_1_5_8in_158ct");
    expect(DEFAULT_MATERIAL_PRICES).toHaveProperty("screw_3in_137ct");
  });

  it("all prices are positive numbers", () => {
    for (const [key, val] of Object.entries(DEFAULT_MATERIAL_PRICES)) {
      expect(val, `${key} should be positive`).toBeGreaterThan(0);
    }
  });
});

describe("calculateMaterialCostServer", () => {
  beforeAll(() => {
    calculateMaterialCostServer = calcFn;
  });

  it("returns zero-cost breakdown for zero-sized unit", async () => {
    const result = await calculateMaterialCostServer({ cols: 0, rows: 0 });
    expect(result.totalCost).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it("calculates materials for a standard 2×2 unit", async () => {
    const result = await calculateMaterialCostServer({
      cols: 2,
      rows: 2,
      toteType: "HDX",
      hasTotes: true,
      hasWheels: false,
      hasTop: false,
    });

    expect(result.totalCost).toBeGreaterThan(0);
    expect(result.rawCounts.totes).toBe(4); // 2 cols × 2 rows
    expect(result.rawCounts.wheel_kits).toBe(0);
    expect(result.rawCounts.lumber_boards).toBeGreaterThan(0);
  });

  it("adds wheels when hasWheels is true", async () => {
    const withoutWheels = await calculateMaterialCostServer({
      cols: 2, rows: 2, hasWheels: false,
    });
    const withWheels = await calculateMaterialCostServer({
      cols: 2, rows: 2, hasWheels: true,
    });

    expect(withWheels.rawCounts.wheel_kits).toBe(1);
    expect(withWheels.totalCost).toBeGreaterThan(withoutWheels.totalCost);
  });

  it("adds plywood top sheets when hasTop is true", async () => {
    const result = await calculateMaterialCostServer({
      cols: 2, rows: 2, hasTop: true,
    });
    expect(result.rawCounts.plywood_top_sheets).toBeGreaterThan(0);
  });

  it("handles multiple units in batch", async () => {
    const single = await calculateMaterialCostServer({
      cols: 2, rows: 2, hasTotes: true,
    });
    const batch = await calculateMaterialCostServer([
      { cols: 2, rows: 2, hasTotes: true },
      { cols: 2, rows: 2, hasTotes: true },
    ]);

    // Batch should use MORE totes but potentially FEWER boards (bin packing efficiency)
    expect(batch.rawCounts.totes).toBe(single.rawCounts.totes * 2);
    expect(batch.rawCounts.lumber_boards).toBeLessThanOrEqual(single.rawCounts.lumber_boards * 2);
  });

  it("handles wide units (>4 cols, multi-module)", async () => {
    const result = await calculateMaterialCostServer({
      cols: 6, rows: 2, hasTotes: true,
    });
    expect(result.rawCounts.totes).toBe(12); // 6 cols × 2 rows
    expect(result.rawCounts.lumber_boards).toBeGreaterThan(0);
  });

  it("handles tall units (>6 rows, multi-tier)", async () => {
    const result = await calculateMaterialCostServer({
      cols: 2, rows: 8, hasTotes: true,
    });
    expect(result.rawCounts.totes).toBe(16); // 2 cols × 8 rows
  });

  it("GM totes use different opening width", async () => {
    const hdx = await calculateMaterialCostServer({
      cols: 2, rows: 2, toteType: "HDX",
    });
    const gm = await calculateMaterialCostServer({
      cols: 2, rows: 2, toteType: "GM",
    });

    // GM openings are wider, so boards may differ slightly
    // Both should produce valid results
    expect(hdx.totalCost).toBeGreaterThan(0);
    expect(gm.totalCost).toBeGreaterThan(0);
  });
});
