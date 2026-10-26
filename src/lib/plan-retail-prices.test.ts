import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { RETAIL_PRICES, priceShoppingList } from "./plan-retail-prices";
import { decodeTotePlanDesign } from "./tote-plans";
import { generateDIYPlan } from "@/app/actions/generate-plan";

const plan = async (code: string) => {
  const design = decodeTotePlanDesign(code)!;
  return { design, plan: await generateDIYPlan(design) };
};

describe("priceShoppingList", () => {
  it("prices a plain 4×4 from the plan's own shopping list: studs, rail boards and screws", async () => {
    const { design, plan: p } = await plan("H4x4");
    const est = priceShoppingList(p.shoppingList, design);
    expect(est.lines.map((l) => [l.label, l.qty])).toEqual([
      ["2×4×8' studs", 20],
      ['#9 × 3" screws', 2],
    ]);
    expect(est.materialsTotal).toBeCloseTo(20 * RETAIL_PRICES.stud2x4 + 2 * RETAIL_PRICES.screwBox3in, 2);
    expect(est.totes).toEqual({ count: 16, total: 143.68 });
  });

  it("adds a full plywood sheet for a worktop and full caster 4-packs for casters", async () => {
    const { design, plan: p } = await plan("H4x4wt");
    const est = priceShoppingList(p.shoppingList, design);
    const byLabel = Object.fromEntries(est.lines.map((l) => [l.label, l]));
    expect(byLabel['3/4" plywood (worktop)']).toMatchObject({ qty: 1, total: RETAIL_PRICES.plywoodSheet });
    expect(byLabel['5" swivel casters (4-pack)']).toMatchObject({ qty: 1, unit: "pack", total: RETAIL_PRICES.casterKit4 });
    expect(byLabel["Caster screws"]).toMatchObject({ qty: 1 });
    expect(byLabel['#9 × 1-5/8" screws']).toMatchObject({ qty: 1 });
    expect(est.materialsTotal).toBe(Math.round(est.lines.reduce((s, l) => s + l.total, 0) * 100) / 100);
  });

  it("prices totes by brand", () => {
    const design = decodeTotePlanDesign("H2x2.G2x2")!;
    expect(priceShoppingList([], design).totes).toEqual({
      count: 8,
      total: Math.round((4 * RETAIL_PRICES.toteHDX + 4 * RETAIL_PRICES.toteGM) * 100) / 100,
    });
  });
});
