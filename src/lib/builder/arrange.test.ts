import { describe, expect, it } from "vitest";
import { LIBRARY_ITEMS, type LibraryItem } from "@/lib/builder/catalog";
import { beginDrag, dragPositions, snapTargets } from "@/lib/builder/drag";
import {
  SAW_KERF,
  addFromLibrary,
  alignPieces,
  boundsOf,
  distributePieces,
  duplicatePieces,
  emptyScene,
  expandToGroups,
  findOverlaps,
  gapBetween,
  groupPieces,
  mirrorPieces,
  parseScene,
  pickSelection,
  pieceBounds,
  rotatePieces,
  serializeScene,
  setOrientation,
  setPieceEdge,
  splitPiece,
  translatePieces,
  ungroupPieces,
  type Bounds,
  type Scene,
} from "@/lib/builder/scene";

const item = (id: string): LibraryItem => LIBRARY_ITEMS.find((i) => i.id === id) as LibraryItem;

function sceneWith(...ids: string[]): { scene: Scene; ids: string[] } {
  let scene = emptyScene();
  const out: string[] = [];
  for (const id of ids) {
    const added = addFromLibrary(scene, item(id));
    scene = added.scene;
    out.push(added.id as string);
  }
  return { scene, ids: out };
}

/** Put a piece's low corner at (x, y, z). */
function place(scene: Scene, id: string, x: number, y: number, z: number): Scene {
  return setPieceEdge(setPieceEdge(setPieceEdge(scene, id, "x", x), id, "y", y), id, "z", z);
}

const box = (scene: Scene, id: string): Bounds => pieceBounds(scene.pieces.find((p) => p.id === id)!);

describe("groups", () => {
  it("picks a whole group with one click, one piece with a deep click", () => {
    const { scene, ids } = sceneWith("2x4-leg", "2x4-leg", "2x4-leg");
    const { scene: grouped, groupId } = groupPieces(scene, [ids[0], ids[1]]);
    expect(groupId).not.toBeNull();
    expect(grouped.groups[0].name).toBe("Group 1");
    expect(pickSelection(grouped, [], ids[0])).toEqual([ids[0], ids[1]]);
    expect(pickSelection(grouped, [], ids[0], { deep: true })).toEqual([ids[0]]);
    expect(pickSelection(grouped, [], ids[2])).toEqual([ids[2]]);
    expect(expandToGroups(grouped, [ids[1]])).toEqual([ids[0], ids[1]]);
  });

  it("adds to and removes from the selection", () => {
    const { scene, ids } = sceneWith("2x4-leg", "2x4-leg", "2x4-leg");
    const { scene: grouped } = groupPieces(scene, [ids[0], ids[1]]);
    const added = pickSelection(grouped, [ids[2]], ids[0], { additive: true });
    expect(added).toEqual([ids[2], ids[0], ids[1]]);
    expect(pickSelection(grouped, added, ids[1], { additive: true })).toEqual([ids[2]]);
  });

  it("needs two pieces, and regrouping moves a piece to the new group", () => {
    const { scene, ids } = sceneWith("2x4-leg", "2x4-leg", "2x4-leg");
    expect(groupPieces(scene, [ids[0]]).groupId).toBeNull();
    const first = groupPieces(scene, [ids[0], ids[1]]).scene;
    const second = groupPieces(first, [ids[0], ids[1], ids[2]]).scene;
    expect(second.groups).toHaveLength(1);
    expect(new Set(second.pieces.map((p) => p.groupId)).size).toBe(1);
  });

  it("ungroups", () => {
    const { scene, ids } = sceneWith("2x4-leg", "2x4-leg");
    const grouped = groupPieces(scene, ids).scene;
    const loose = ungroupPieces(grouped, [ids[0]]);
    expect(loose.groups).toEqual([]);
    expect(loose.pieces.every((p) => p.groupId === null)).toBe(true);
  });

  it("gives a duplicated group a group of its own", () => {
    const { scene, ids } = sceneWith("2x4-leg", "2x4-leg");
    const grouped = groupPieces(scene, ids).scene;
    const { scene: next, ids: copies } = duplicatePieces(grouped, ids);
    expect(next.groups).toHaveLength(2);
    const copyGroups = new Set(next.pieces.filter((p) => copies.includes(p.id)).map((p) => p.groupId));
    expect(copyGroups.size).toBe(1);
    expect(copyGroups.has(grouped.groups[0].id)).toBe(false);
    expect(parseScene(serializeScene(next))).toEqual(next);
  });
});

describe("align and distribute", () => {
  it("aligns left edges, tops and middles", () => {
    let { scene, ids } = sceneWith("2x4-leg", "rip-square", "ply12-shelf");
    scene = place(scene, ids[0], 0, 0, 0);
    scene = place(scene, ids[1], 10, 5, 20);
    scene = place(scene, ids[2], 30, 9, 40);
    const left = alignPieces(scene, ids, "x", "min");
    expect(ids.map((id) => box(left, id).min[0])).toEqual([0, 0, 0]);
    const top = alignPieces(scene, ids, "y", "max");
    const highest = (boundsOf(scene.pieces) as Bounds).max[1];
    ids.forEach((id) => expect(box(top, id).max[1]).toBeCloseTo(highest));
    const mid = alignPieces(scene, ids, "z", "center");
    const mids = ids.map((id) => (box(mid, id).min[2] + box(mid, id).max[2]) / 2);
    expect(mids[1]).toBeCloseTo(mids[0]);
    expect(mids[2]).toBeCloseTo(mids[0]);
  });

  it("moves a group as one unit when aligning", () => {
    let { scene, ids } = sceneWith("2x4-leg", "2x4-leg", "rip-square");
    scene = place(scene, ids[0], 10, 0, 0);
    scene = place(scene, ids[1], 20, 0, 0);
    scene = place(scene, ids[2], 0, 0, 30);
    scene = groupPieces(scene, [ids[0], ids[1]]).scene;
    const aligned = alignPieces(scene, ids, "x", "min");
    expect(box(aligned, ids[0]).min[0]).toBeCloseTo(0);
    // The second member keeps its 10" lead on the first
    expect(box(aligned, ids[1]).min[0]).toBeCloseTo(10);
  });

  it("spaces pieces with equal gaps, outer ones staying put", () => {
    let { scene, ids } = sceneWith("rip-square", "rip-square", "rip-square", "rip-square");
    [0, 3, 11, 40].forEach((z, i) => {
      scene = place(scene, ids[i], 0, 0, z);
    });
    const spread = distributePieces(scene, ids, "z");
    const zs = ids.map((id) => box(spread, id).min[2]);
    expect(zs[0]).toBeCloseTo(0);
    expect(zs[3]).toBeCloseTo(40);
    const gaps = [0, 1, 2].map((i) => zs[i + 1] - (zs[i] + 1.5));
    expect(gaps[1]).toBeCloseTo(gaps[0]);
    expect(gaps[2]).toBeCloseTo(gaps[0]);
  });

  it("leaves two pieces alone when asked to distribute", () => {
    const { scene, ids } = sceneWith("rip-square", "rip-square");
    expect(distributePieces(scene, ids, "x")).toBe(scene);
  });
});

describe("mirror", () => {
  it("swaps left and right and keeps the footprint", () => {
    let { scene, ids } = sceneWith("2x4-leg", "ply12-shelf");
    scene = place(scene, ids[0], 0, 0, 0);
    scene = place(scene, ids[1], 50, 0, 0);
    const before = boundsOf(scene.pieces) as Bounds;
    const flipped = mirrorPieces(scene, ids, "x");
    const after = boundsOf(flipped.pieces) as Bounds;
    after.min.forEach((v, i) => expect(v).toBeCloseTo(before.min[i]));
    after.max.forEach((v, i) => expect(v).toBeCloseTo(before.max[i]));
    expect(box(flipped, ids[0]).max[0]).toBeCloseTo(before.max[0]);
    expect(box(flipped, ids[1]).min[0]).toBeCloseTo(before.min[0]);
  });

  it("mirrors an angled brace to the opposite angle, and twice is back to the start", () => {
    const { scene, ids } = sceneWith("2x4-leg");
    const angled = rotatePieces(scene, ids, "y", 30);
    const once = mirrorPieces(angled, ids, "x");
    expect(once.pieces[0].rotation[1]).toBeCloseTo(-30);
    const twice = mirrorPieces(once, ids, "x");
    twice.pieces[0].rotation.forEach((r, i) => expect(r).toBeCloseTo(angled.pieces[0].rotation[i]));
    twice.pieces[0].position.forEach((r, i) => expect(r).toBeCloseTo(angled.pieces[0].position[i]));
  });
});

describe("cutting in two", () => {
  it("crosscuts a board, taking the kerf out of the second part", () => {
    const { scene, ids } = sceneWith("2x4-8");
    const { scene: cut, ids: parts } = splitPiece(scene, ids[0], "length", 30);
    expect(parts).not.toBeNull();
    expect(cut.pieces.map((p) => p.length)).toEqual([30, 96 - 30 - SAW_KERF]);
    const original = pieceBounds(scene.pieces[0]);
    expect(box(cut, parts![0]).min[0]).toBeCloseTo(original.min[0]);
    expect(box(cut, parts![1]).max[0]).toBeCloseTo(original.max[0]);
    expect(findOverlaps(cut.pieces)).toEqual([]);
  });

  it("rips a panel along its width, wherever it's standing", () => {
    const { scene, ids } = sceneWith("ply34-sheet");
    const standing = setOrientation(scene, ids[0], "edge");
    const { scene: cut } = splitPiece(standing, ids[0], "width", 16);
    expect(cut.pieces.map((p) => p.width)).toEqual([16, 48 - 16 - SAW_KERF]);
    const whole = pieceBounds(standing.pieces[0]);
    const both = boundsOf(cut.pieces) as Bounds;
    both.min.forEach((v, i) => expect(v).toBeCloseTo(whole.min[i]));
    both.max.forEach((v, i) => expect(v).toBeCloseTo(whole.max[i]));
  });

  it("refuses a cut that leaves a sliver", () => {
    const { scene, ids } = sceneWith("2x4-8");
    expect(splitPiece(scene, ids[0], "length", 95.95).ids).toBeNull();
    expect(splitPiece(scene, ids[0], "length", 0).ids).toBeNull();
    expect(splitPiece(scene, ids[0], "width", 3.3).ids).toBeNull();
  });
});

describe("overlaps and gaps", () => {
  it("lets pieces touch but flags pieces sharing space", () => {
    let { scene, ids } = sceneWith("2x4-leg", "2x4-leg");
    scene = place(scene, ids[0], 0, 0, 0);
    scene = place(scene, ids[1], 0, 0, 3.5);
    expect(findOverlaps(scene.pieces)).toEqual([]);
    scene = place(scene, ids[1], 0, 0, 3);
    expect(findOverlaps(scene.pieces)).toEqual([[ids[0], ids[1]]]);
  });

  it("is exact for turned pieces whose bounding boxes cross", () => {
    let { scene, ids } = sceneWith("2x4-8", "rip-square");
    // A board at 45° has a big bounding box; a cleat tucked in its empty corner doesn't touch it.
    scene = rotatePieces(scene, [ids[0]], "y", 45);
    const b = box(scene, ids[0]);
    scene = place(scene, ids[1], b.min[0], 0, b.min[2]);
    expect(findOverlaps(scene.pieces)).toEqual([]);
    // Slid to the middle of the board, it does.
    const mid = scene.pieces[0].position;
    scene = place(scene, ids[1], mid[0] - 12, 0, mid[2]);
    expect(findOverlaps(scene.pieces)).toHaveLength(1);
  });

  it("measures the clear space between pieces", () => {
    let { scene, ids } = sceneWith("2x4-leg", "2x4-leg");
    scene = place(scene, ids[0], 0, 0, 0);
    scene = place(scene, ids[1], 50, 0, 0);
    const gap = gapBetween([scene.pieces[0]], [scene.pieces[1]])!;
    expect(gap[0]).toBeCloseTo(50 - 34.5);
    expect(gap[2]).toBeCloseTo(-3.5);
  });
});

describe("snapping while dragging", () => {
  const setup = () => {
    let { scene, ids } = sceneWith("2x4-leg", "2x4-leg");
    scene = place(scene, ids[0], 0, 0, 0); // x 0 → 34.5
    scene = place(scene, ids[1], 60.3, 0, 10.2);
    const dragged = scene.pieces.filter((p) => p.id === ids[1]);
    return { scene, ids, start: beginDrag(dragged, ids[1]), targets: snapTargets(scene.pieces, [ids[1]]) };
  };

  it("butts the dragged piece against another when it comes close", () => {
    const { ids, start, targets } = setup();
    // Bring its left edge to 34.9: within 1" of the other's right edge (34.5)
    const { positions, guides } = dragPositions(start, [34.9 - 60.3, 0, 0], { gridStep: 0.5, targets, tolerance: 1 });
    expect(positions[ids[1]][0] - 34.5 / 2).toBeCloseTo(34.5);
    expect(guides).toHaveLength(1);
    expect(guides[0].axis).toBe(0);
    expect(guides[0].from[0]).toBeCloseTo(34.5);
  });

  it("falls back to the grid away from other pieces, or when piece snapping is off", () => {
    const { ids, start, targets } = setup();
    const far = dragPositions(start, [20.1, 0, 0], { gridStep: 0.5, targets, tolerance: 1 });
    expect(far.positions[ids[1]][0] - 34.5 / 2).toBeCloseTo(80.5);
    expect(far.guides).toEqual([]);
    const off = dragPositions(start, [34.9 - 60.3, 0, 0], { gridStep: 0.5, targets: [], tolerance: 1 });
    expect(off.positions[ids[1]][0] - 34.5 / 2).toBeCloseTo(35);
  });

  it("doesn't touch an axis that isn't being moved", () => {
    const { ids, start, targets } = setup();
    const { positions } = dragPositions(start, [5, 0, 0], { gridStep: 1, targets, tolerance: 1 });
    expect(positions[ids[1]][2]).toBeCloseTo(start.positions[ids[1]][2]);
  });

  it("makes fronts flush on the other axis at the same time", () => {
    const { ids, start, targets } = setup();
    // z: its back edge at 10.2 → move to 0.4, within reach of the other's back edge at 0
    const { positions, guides } = dragPositions(start, [34.9 - 60.3, 0, 0.4 - 10.2], { gridStep: 0, targets, tolerance: 1 });
    expect(positions[ids[1]][2] - 1.75).toBeCloseTo(0);
    expect(guides.map((g) => g.axis).sort()).toEqual([0, 2]);
  });
});

describe("translate still works on groups", () => {
  it("moves every member", () => {
    const { scene, ids } = sceneWith("2x4-leg", "2x4-leg");
    const grouped = groupPieces(scene, ids).scene;
    const moved = translatePieces(grouped, expandToGroups(grouped, [ids[0]]), [3, 0, 0]);
    moved.pieces.forEach((p, i) => expect(p.position[0]).toBeCloseTo(scene.pieces[i].position[0] + 3));
  });
});
