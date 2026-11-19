import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateDIYPlan } from "./generate-plan";
import { decodeTotePlanDesign, encodeTotePlanDesign, isMiniDesign, parseTotePlanDesign, unitOuterSize, designModules } from "@/lib/tote-plans";
import { miniUpright, miniPlateLength, miniRailTops, miniMaxModuleCols, miniMaxRowsPerTier } from "@/lib/mini-rack";

const design = (s: string) => decodeTotePlanDesign(s)!;

describe("mini rack geometry (measured from the built 4×4)", () => {
  it("matches the built unit", () => {
    expect(miniUpright(4)).toBe(27.75);
    expect(miniPlateLength(4)).toBe(40.5);
    expect(miniRailTops(4)).toEqual([5.75, 12.25, 18.75, 25.25]);
    expect(unitOuterSize(design("M4x4").units[0])).toEqual({ widthIn: 40.5, heightIn: 30.75, depthIn: 12.75 });
  });

  it("keeps every plate and upright on one 8' 2×3", () => {
    expect(miniMaxModuleCols()).toBe(9);
    expect(miniMaxModuleCols(true)).toBe(6);
    expect(miniMaxRowsPerTier()).toBe(14);
    expect(miniPlateLength(9)).toBeLessThanOrEqual(96);
    expect(miniUpright(14)).toBeLessThanOrEqual(96);
    // 10 wide splits into 9 + 1 like the big racks split at 4
    expect(designModules(design("M10x4")).modules.map((m) => m.cols)).toEqual([9, 1]);
  });

  it("sideways: 13\" bays, 8\" deep", () => {
    expect(unitOuterSize(design("M2x3s").units[0])).toMatchObject({ widthIn: 2 * 13 + 3 * 1.5, depthIn: 8 });
  });
});

describe("mini designs", () => {
  it("encode as M… and never roll", () => {
    const d = parseTotePlanDesign({ units: [{ cols: 4, rows: 4, toteType: "MINI", hasWheels: true, hasTop: true }] })!;
    expect(d.units[0].hasWheels).toBe(false);
    expect(encodeTotePlanDesign(d)).toBe("M4x4t");
    expect(isMiniDesign(d)).toBe(true);
  });

  it("can't mix mini and 27-gal units, and allow up to 14 high", () => {
    expect(decodeTotePlanDesign("M4x4.H4x4")).toBeNull();
    expect(decodeTotePlanDesign("M4x14")).not.toBeNull();
    expect(decodeTotePlanDesign("M4x15")).toBeNull();
    expect(decodeTotePlanDesign("H4x14")).toBeNull();
  });
});

describe("generateDIYPlan for a mini design", () => {
  it("builds the 4×4 the way it was built", async () => {
    const plan = await generateDIYPlan(design("M4x4t"));
    expect(plan.kind).toBe("mini");
    expect(plan.name).toBe("4×4 Mini Tote Rack");
    expect(plan.dimensions).toEqual({ totalWidth: '40-1/2"', totalHeight: '30-3/4"', depth: '12-3/4"' });
    const parts = Object.fromEntries(plan.moduleTypes[0].parts.map((p) => [p.name, p]));
    expect(parts.Upright).toMatchObject({ qty: 10, length: '27-3/4"', material: "2×3" });
    expect(parts.Plate).toMatchObject({ qty: 4, length: '40-1/2"' });
    expect(parts.Rail).toMatchObject({ qty: 32, length: '12-3/4"' });
    // 8 rail screws per tote slot
    const ladders = plan.moduleTypes[0].steps.find((s) => s.id === "build-ladders")!;
    expect(ladders.materials.find((m) => m.name === '#8 × 1-1/4" Screws')?.qty).toBe(String(16 * 8));
    const marks = plan.moduleTypes[0].steps.find((s) => s.id === "mark-posts")!;
    expect(marks.instruction).toContain('5-3/4", 12-1/4", 18-3/4" and 25-1/4"');
    // no casters anywhere
    expect(plan.moduleTypes[0].steps.some((s) => s.id === "attach-casters")).toBe(false);
    expect(plan.shoppingList.map((i) => i.name)).toEqual(
      expect.arrayContaining(["2×3 Lumber", "HDX 6.5 qt Totes", '#8 × 1-1/4" Star-Drive Screws', '#9 × 3" Star-Drive Screws']),
    );
    expect(plan.shoppingList.find((i) => i.name === "HDX 6.5 qt Totes")?.qty).toBe(16);
    // 10 × 27-3/4" uprights + 4 × 40-1/2" plates, packed on 8' boards
    expect(plan.cutBoards.flatMap((b) => b.cuts)).toHaveLength(14);
    expect(plan.cutBoards.every((b) => b.cuts.reduce((s, c) => s + c.length, 0) <= 96)).toBe(true);
    expect(plan.miniRails?.[0]).toMatchObject({ stockName: "4' × 4' sheet", pieces: 1, rails: 32 });
    expect(plan.shoppingList.find((i) => i.name.startsWith('3/4" Plywood'))).toMatchObject({ name: '3/4" Plywood Half Sheet', qty: 1 });
  });

  it("plans a sideways mini with 8\" rails", async () => {
    const plan = await generateDIYPlan(design("M3x3s"));
    expect(plan.moduleTypes[0].parts.find((p) => p.name === "Rail")?.length).toBe('8"');
    expect(plan.dimensions.depth).toBe('8"');
  });
});

describe("mini PDF", () => {
  it("uses the mini numbers, never the 2×4 rack's", async () => {
    const { generateDIYPDF } = await import("@/lib/diy-pdf-generator");
    const plan = await generateDIYPlan(design("M4x4t"));
    const pdf = generateDIYPDF({ plan, snapshots: {} }).output();
    expect(pdf).toContain('6-1/2" top to top');
    expect(pdf).not.toContain('16" top to top');
    expect(pdf).not.toMatch(/1-9\/16/);
    expect(pdf).toContain('8-1/4"');
  });
});

describe("mini checkout products", () => {
  it("prices Mini Tote Rack Plans separately from All-Access", async () => {
    const { TOTE_PLAN_MINI, planIdForDesign, TOTE_PLAN_ID } = await import("@/lib/tote-plans");
    expect(TOTE_PLAN_MINI).toMatchObject({ id: "mini-tote-rack", price: 1200, ownerPrice: 900 });
    expect(planIdForDesign(design("M4x4"))).toBe("mini-tote-rack");
    expect(planIdForDesign(design("H4x4"))).toBe(TOTE_PLAN_ID);
  });
});

describe("mini plywood: one stock size for rails + top", () => {
  const ply = async (code: string) => (await generateDIYPlan(design(code))).shoppingList.find((i) => i.name.startsWith('3/4" Plywood'));
  it("buys the smallest piece that holds everything", async () => {
    expect(await ply("M4x4")).toMatchObject({ name: '3/4" Plywood Panel', qty: 1 }); // rails only: 2' × 4'
    expect(await ply("M2x2t")).toMatchObject({ name: '3/4" Plywood Panel', qty: 1 }); // small top fits the panel too
    expect(await ply("M4x4t")).toMatchObject({ name: '3/4" Plywood Half Sheet', qty: 1 }); // 4' × 4', not two panels
    expect(await ply("M9x6t")).toMatchObject({ name: '3/4" Plywood Sheet', qty: 1 }); // 89" top needs a 4' × 8'
  });
});
