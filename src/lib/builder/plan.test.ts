import { describe, expect, it } from "vitest";
import { LIBRARY_ITEMS, type LibraryItem } from "@/lib/builder/catalog";
import { generateCustomPlan, type CustomPlan } from "@/lib/builder/plan";
import {
  SAW_KERF,
  addFromLibrary,
  emptyScene,
  groupPieces,
  resizePiece,
  rotatePieces,
  setOrientation,
  setPieceEdge,
  type Orientation,
  type Scene,
} from "@/lib/builder/scene";

const item = (id: string): LibraryItem => LIBRARY_ITEMS.find((i) => i.id === id) as LibraryItem;

interface Spec {
  item: string;
  length?: number;
  width?: number;
  sits?: Orientation;
  at: [number, number, number];
}

/** Build a scene from specs; `at` is each piece's low corner. */
function build(specs: Spec[]): { scene: Scene; ids: string[] } {
  let scene = emptyScene("Test build");
  const ids: string[] = [];
  for (const spec of specs) {
    const added = addFromLibrary(scene, item(spec.item));
    const id = added.id as string;
    scene = added.scene;
    if (spec.length || spec.width) scene = resizePiece(scene, id, { length: spec.length, width: spec.width });
    if (spec.sits) scene = setOrientation(scene, id, spec.sits);
    scene = setPieceEdge(setPieceEdge(setPieceEdge(scene, id, "x", spec.at[0]), id, "y", spec.at[1]), id, "z", spec.at[2]);
    ids.push(id);
  }
  return { scene, ids };
}

/** 60" × 27" workbench: 4 legs, 2 aprons on edge outside the legs, a 3/4" top. */
const WORKBENCH: Spec[] = [
  { item: "2x4-leg", sits: "upright", at: [0, 0, 0] },
  { item: "2x4-leg", sits: "upright", at: [58.5, 0, 0] },
  { item: "2x4-leg", sits: "upright", at: [0, 0, 20.5] },
  { item: "2x4-leg", sits: "upright", at: [58.5, 0, 20.5] },
  { item: "2x4-8", length: 60, sits: "edge", at: [0, 31, -1.5] },
  { item: "2x4-8", length: 60, sits: "edge", at: [0, 31, 24] },
  { item: "ply34-top", length: 60, width: 27, at: [0, 34.5, -1.5] },
];

const boardCount = (plan: CustomPlan) => plan.boards.reduce((s, b) => s + b.count, 0);

describe("parts", () => {
  const plan = generateCustomPlan(build(WORKBENCH).scene);

  it("letters identical pieces as one part, longest lumber first, panels after", () => {
    expect(plan.parts.map((p) => [p.letter, p.qty, p.size])).toEqual([
      ["A", 2, '60"'],
      ["B", 4, '34-1/2"'],
      ["C", 1, '27" × 60"'],
    ]);
    expect(Object.values(plan.letterOf).sort().join("")).toBe("AABBBBC");
  });

  it("reports the overall size", () => {
    expect(plan.dimensions).toEqual({ width: '60"', height: '35-1/4"', depth: '27"' });
    expect(plan.warnings).toEqual([]);
  });
});

describe("lumber cut list", () => {
  it("packs the workbench onto three 8 ft studs", () => {
    const plan = generateCustomPlan(build(WORKBENCH).scene);
    expect(boardCount(plan)).toBe(3);
    expect(plan.boards.every((b) => b.length === 96)).toBe(true);
    expect(plan.shoppingList.find((i) => i.name === "2×4 × 8 ft")?.qty).toBe(3);
  });

  it("never puts more on a board than fits, kerf included, and loses no piece", () => {
    const specs: Spec[] = [50, 47, 46, 30, 30, 22, 22, 22, 13, 9, 9, 70, 96].map((length, i) => ({
      item: "2x4-8",
      length,
      at: [0, 0, i * 10],
    }));
    const plan = generateCustomPlan(build(specs).scene);
    let cuts = 0;
    for (const board of plan.boards) {
      for (const lane of board.lanes) {
        const used = lane.cuts.reduce((s, c) => s + c.length, 0) + (lane.cuts.length - 1) * SAW_KERF;
        expect(used).toBeLessThanOrEqual(board.length + 1e-6);
        expect(lane.offcut).toBeLessThanOrEqual(board.length - used + 1e-6);
        cuts += lane.cuts.length * board.count;
      }
    }
    expect(cuts).toBe(specs.length);
    // 466" of parts can't fit on fewer than five 8 ft boards; a good packing needs no more than six.
    expect(boardCount(plan)).toBeGreaterThanOrEqual(5);
    expect(boardCount(plan)).toBeLessThanOrEqual(6);
  });

  it("gets six half-rip rails out of one stud: two rips side by side, three rails each", () => {
    const specs: Spec[] = Array.from({ length: 6 }, (_, i) => ({ item: "rip-half", at: [0, 0, i * 5] as [number, number, number] }));
    const plan = generateCustomPlan(build(specs).scene);
    expect(boardCount(plan)).toBe(1);
    expect(plan.boards[0].lanes.map((l) => l.cuts.length)).toEqual([3, 3]);
    expect(plan.parts[0].ripped).toBe(true);
    expect(plan.tools).toContain("Table Saw");
  });

  it("buys a longer board only for a part that needs one", () => {
    const plan = generateCustomPlan(build([
      { item: "2x4-8", length: 110, at: [0, 0, 0] },
      { item: "2x4-8", length: 40, at: [0, 0, 10] },
    ]).scene);
    expect(plan.shoppingList.filter((i) => i.name.startsWith("2×4")).map((i) => [i.name, i.qty])).toEqual([
      ["2×4 × 8 ft", 1],
      ["2×4 × 10 ft", 1],
    ]);
  });

  it("groups boards that are cut the same way", () => {
    const specs: Spec[] = Array.from({ length: 6 }, (_, i) => ({ item: "2x4-8", length: 48 - SAW_KERF, at: [0, 0, i * 5] as [number, number, number] }));
    const plan = generateCustomPlan(build(specs).scene);
    expect(plan.boards).toHaveLength(1);
    expect(plan.boards[0].count).toBe(3);
  });

  it("leaves an unbuyable part off the cut list and says so", () => {
    const plan = generateCustomPlan(build([{ item: "2x4-8", length: 150, at: [0, 0, 0] }]).scene);
    expect(plan.boards).toEqual([]);
    expect(plan.warnings[0]).toMatch(/longer than a 12 ft board/);
  });
});

describe("plywood cut list", () => {
  it("nests panels on as few sheets as fit, without overlap, inside the sheet", () => {
    const specs: Spec[] = [
      { item: "ply34-top", length: 60, width: 27, at: [0, 0, 0] },
      { item: "ply34-top", length: 60, width: 20, at: [0, 5, 0] },
      { item: "ply34-top", length: 30, width: 20, at: [0, 10, 0] },
      { item: "ply34-top", length: 30, width: 20, at: [0, 15, 0] },
      { item: "ply12-shelf", at: [0, 20, 0] },
    ];
    const plan = generateCustomPlan(build(specs).scene);
    expect(plan.sheets.map((s) => s.label)).toEqual(['3/4" Plywood', '1/2" Plywood']);
    for (const sheet of plan.sheets) {
      sheet.placements.forEach((p, i) => {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x + p.w).toBeLessThanOrEqual(96 + 1e-6);
        expect(p.y + p.h).toBeLessThanOrEqual(48 + 1e-6);
        for (const q of sheet.placements.slice(i + 1)) {
          const apart = p.x + p.w <= q.x + 1e-6 || q.x + q.w <= p.x + 1e-6 || p.y + p.h <= q.y + 1e-6 || q.y + q.h <= p.y + 1e-6;
          expect(apart).toBe(true);
        }
      });
      expect(sheet.used).toBeGreaterThan(0);
      expect(sheet.used).toBeLessThanOrEqual(1);
    }
  });

  it("turns a part to fit and opens a second sheet when the first is full", () => {
    const specs: Spec[] = Array.from({ length: 3 }, (_, i) => ({ item: "ply34-sheet", length: 48, width: 40, at: [0, i * 5, 0] as [number, number, number] }));
    const plan = generateCustomPlan(build(specs).scene);
    expect(plan.sheets).toHaveLength(2);
    expect(plan.shoppingList.find((i) => i.name.startsWith('3/4" Plywood'))?.qty).toBe(2);
  });

  it("flags a panel bigger than a sheet", () => {
    const plan = generateCustomPlan(build([{ item: "ply34-sheet", length: 96, width: 60, at: [0, 0, 0] }]).scene);
    expect(plan.sheets).toEqual([]);
    expect(plan.warnings[0]).toMatch(/bigger than a 4 × 8 sheet/);
  });
});

describe("joints and fasteners", () => {
  const plan = generateCustomPlan(build(WORKBENCH).scene);

  it("finds every place pieces touch", () => {
    // 4 leg-to-apron joints, the top on 2 aprons and 4 leg ends
    expect(plan.joints).toHaveLength(10);
    const framing = plan.joints.filter((j) => j.fastener.includes('3"'));
    expect(framing).toHaveLength(4);
    expect(framing.every((j) => j.count === 2 && !j.angled)).toBe(true);
  });

  it("screws the top down about every 8 inches along each apron", () => {
    const top = plan.joints.filter((j) => j.fastener.includes("1-5/8"));
    expect(top.map((j) => j.count).sort((a, b) => a - b)).toEqual([2, 2, 2, 2, 9, 9]);
  });

  it("buys screws by the box with spare", () => {
    const three = plan.shoppingList.find((i) => i.name === '#9 × 3" Star-Drive Screws');
    expect(three?.qty).toBe("1 Box");
    expect(three?.detail).toContain("9 incl. 10% spare"); // 8 × 1.1, rounded up
    expect(plan.shoppingList.find((i) => i.name === '#9 × 1-5/8" Star-Drive Screws')?.detail).toContain("29 incl."); // 26 × 1.1
  });

  it("calls for an angled screw when the piece is too thick to go straight through", () => {
    // Two flat 2×4s end to face: the only way through is 3-1/2"
    const { scene } = build([
      { item: "2x4-8", length: 30, at: [0, 0, 0] },
      { item: "2x4-8", length: 20, at: [30, 0, 0] },
    ]);
    const tee = generateCustomPlan(scene);
    expect(tee.joints).toHaveLength(1);
    expect(tee.joints[0].angled).toBe(true);
    expect(tee.steps.at(-1)?.instruction).toMatch(/toe-screw/);
  });

  it("doesn't join pieces that only meet at an edge, or don't meet", () => {
    const { scene } = build([
      { item: "2x4-leg", at: [0, 0, 0] },
      { item: "2x4-leg", at: [34.5, 1.5, 0] }, // corner to corner
      { item: "2x4-leg", at: [0, 0, 20] },
    ]);
    const plan2 = generateCustomPlan(scene);
    expect(plan2.joints).toEqual([]);
    expect(plan2.warnings.join(" ")).toMatch(/aren't touching anything/);
  });

  it("fastens an angled brace where it lands", () => {
    let { scene, ids } = build([
      { item: "2x4-leg", sits: "upright", at: [0, 0, 0] },
      { item: "2x4-leg", length: 20, at: [1.5, 5, 0] },
    ]);
    scene = rotatePieces(scene, [ids[1]], "z", 30);
    scene = setPieceEdge(scene, ids[1], "x", 1.45);
    expect(generateCustomPlan(scene).joints).toHaveLength(1);
  });
});

describe("steps", () => {
  it("cuts first, then builds from the floor up", () => {
    const plan = generateCustomPlan(build(WORKBENCH).scene);
    expect(plan.steps.map((s) => s.title)).toEqual([
      "Cut Every Part",
      "Start With the 4 2×4s (B)",
      "Add the 2 2×4s (A)",
      'Add the 3/4" Plywood Panel (C)',
    ]);
    expect(plan.steps.map((s) => s.number)).toEqual([1, 2, 3, 4]);
    expect(plan.steps[0].parts.map((p) => p.letter)).toEqual(["A", "B", "C"]);
  });

  it("uses every piece exactly once and every screw exactly once", () => {
    const { scene } = build(WORKBENCH);
    const plan = generateCustomPlan(scene);
    const used = plan.steps.flatMap((s) => s.pieceIds).sort();
    expect(used).toEqual(scene.pieces.map((p) => p.id).sort());
    const inSteps = plan.steps.flatMap((s) => s.fasteners).reduce((sum, f) => sum + f.qty, 0);
    expect(inSteps).toBe(plan.joints.reduce((sum, j) => sum + j.count, 0));
  });

  it("mounts casters after the frame they bolt to, and loads totes last", () => {
    const { scene } = build([
      { item: "tote-27", at: [0, 7.4, 0] },
      { item: "caster", at: [0, 0, 0] },
      { item: "caster", at: [40, 0, 0] },
      { item: "2x4-8", length: 48, at: [0, 5.9, 0] },
    ]);
    const plan = generateCustomPlan(scene);
    expect(plan.steps.map((s) => s.title)).toEqual([
      "Cut Every Part",
      "Start With the 2×4 (A)",
      'Mount the 2 5" Swivel Casters',
      "Slide In the Tote",
    ]);
    expect(plan.steps[2].fasteners).toEqual([{ name: '1/4" × 1" Structural Screws', qty: 8 }]);
    expect(plan.shoppingList.find((i) => i.name === "Caster Kits")).toMatchObject({ qty: 1 });
    expect(plan.shoppingList.find((i) => i.name === "Caster Kits")?.detail).toContain("2 needed (2 spare)");
    expect(plan.shoppingList.find((i) => i.name === "27-Gallon Totes")?.qty).toBe(1);
    expect(plan.parts.find((p) => p.kind === "hardware")?.letter).toBe("");
  });

  it("finishes one group before starting the next, and names it", () => {
    let { scene, ids } = build([
      { item: "2x4-leg", sits: "upright", at: [0, 0, 0] },
      { item: "2x4-leg", length: 20, at: [1.5, 0, 0] },
      { item: "2x4-leg", sits: "upright", at: [60, 0, 0] },
      { item: "2x4-leg", length: 20, at: [61.5, 0, 0] },
    ]);
    scene = groupPieces(scene, [ids[0], ids[1]], "Left end").scene;
    scene = groupPieces(scene, [ids[2], ids[3]], "Right end").scene;
    const plan = generateCustomPlan(scene);
    const order = plan.steps.slice(1).map((s) => (ids.indexOf(s.pieceIds[0]) < 2 ? "L" : "R"));
    expect(order.join("")).toMatch(/^(LLRR|RRLL)$/);
    expect(plan.steps[1].instruction).toMatch(/for (Left|Right) end/);
  });

  it("handles an empty design", () => {
    const plan = generateCustomPlan(emptyScene());
    expect(plan.steps).toEqual([]);
    expect(plan.shoppingList).toEqual([]);
    expect(plan.pieceCount).toBe(0);
  });
});
