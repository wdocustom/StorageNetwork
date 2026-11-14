import { describe, expect, it } from "vitest";
import { LIBRARY_ITEMS, type LibraryItem } from "@/lib/builder/catalog";
import { formatFeetInches, formatFraction, formatInches, parseLength, snapTo } from "@/lib/builder/units";
import {
  SCENE_LIMITS,
  addFromLibrary,
  boundsOf,
  dropToFloor,
  duplicatePieces,
  emptyScene,
  eulerFromMatrix,
  isRipped,
  orientationOf,
  parseScene,
  pieceBounds,
  pieceFootprint,
  pieceLabel,
  pieceWarnings,
  removePieces,
  resizePiece,
  rotatePieces,
  rotationMatrix,
  serializeScene,
  setOrientation,
  setPieceEdge,
  setPieceStock,
  setPositions,
  summarize,
  translatePieces,
  worldSize,
  type Scene,
  type Vec3,
} from "@/lib/builder/scene";

const item = (id: string): LibraryItem => LIBRARY_ITEMS.find((i) => i.id === id) as LibraryItem;

function sceneWith(...ids: string[]): { scene: Scene; pieceIds: string[] } {
  let scene = emptyScene();
  const pieceIds: string[] = [];
  for (const id of ids) {
    const added = addFromLibrary(scene, item(id));
    scene = added.scene;
    pieceIds.push(added.id as string);
  }
  return { scene, pieceIds };
}

const close = (a: Vec3, b: Vec3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

describe("units", () => {
  it("formats to the nearest sixteenth", () => {
    expect(formatFraction(34.5)).toBe("34-1/2");
    expect(formatFraction(0.75)).toBe("3/4");
    expect(formatFraction(1.5625)).toBe("1-9/16");
    expect(formatFraction(95.99)).toBe("96");
    expect(formatFraction(-2.25)).toBe("-2-1/4");
    expect(formatInches(3.5)).toBe('3-1/2"');
  });

  it("switches to feet at 4 ft", () => {
    expect(formatFeetInches(30)).toBe('30"');
    expect(formatFeetInches(96)).toBe("8'");
    expect(formatFeetInches(102.5)).toBe(`8' 6-1/2"`);
  });

  it("reads lengths the way builders type them", () => {
    expect(parseLength("34.5")).toBe(34.5);
    expect(parseLength("34 1/2")).toBe(34.5);
    expect(parseLength('34-1/2"')).toBe(34.5);
    expect(parseLength("3/4")).toBe(0.75);
    expect(parseLength("8'")).toBe(96);
    expect(parseLength(`2' 6"`)).toBe(30);
    expect(parseLength("2ft 6in")).toBe(30);
    expect(parseLength("2' 6 1/2")).toBe(30.5);
    expect(parseLength("30 in")).toBe(30);
    expect(parseLength("-4")).toBe(-4);
  });

  it("rejects what it can't read", () => {
    for (const bad of ["", "abc", "1/0", "3 4 5", "'"]) expect(parseLength(bad)).toBeNull();
  });

  it("snaps to a step, or not at all", () => {
    expect(snapTo(3.3, 0.5)).toBe(3.5);
    expect(snapTo(3.3, 0)).toBe(3.3);
  });
});

describe("rotation math", () => {
  it("round-trips Euler angles through a matrix", () => {
    for (const angles of [[0, 0, 0], [90, 0, 0], [0, 45, 0], [0, 0, 90], [30, -40, 120], [-90, 15, 0]] as Vec3[]) {
      close(rotationMatrix(eulerFromMatrix(rotationMatrix(angles))).flat() as unknown as Vec3, rotationMatrix(angles).flat() as unknown as Vec3);
    }
  });

  it("gives clean angles for quarter turns", () => {
    expect(eulerFromMatrix(rotationMatrix([0, 90, 0]))).toEqual([0, 90, 0]);
    expect(eulerFromMatrix(rotationMatrix([0, 0, 180]))).toEqual([0, 0, 180]);
  });
});

describe("adding pieces", () => {
  it("lays the first piece flat on the floor around the origin", () => {
    const { scene } = sceneWith("2x4-8");
    const [p] = scene.pieces;
    expect([p.length, p.thickness, p.width]).toEqual([96, 1.5, 3.5]);
    close(pieceBounds(p).min, [-48, 0, -1.75]);
  });

  it("puts the next piece in front of the build, left edges lined up", () => {
    const { scene } = sceneWith("2x4-8", "ply34-top");
    const [first, second] = scene.pieces.map(pieceBounds);
    expect(second.min[0]).toBeCloseTo(first.min[0]);
    expect(second.min[2]).toBeCloseTo(first.max[2] + 6);
    expect(second.min[1]).toBeCloseTo(0);
  });

  it("stops at the piece limit", () => {
    let scene = emptyScene();
    scene = { ...scene, pieces: Array.from({ length: SCENE_LIMITS.maxPieces }, () => addFromLibrary(emptyScene(), item("rip-square")).scene.pieces[0]) };
    const added = addFromLibrary(scene, item("2x4-8"));
    expect(added.id).toBeNull();
    expect(added.scene).toBe(scene);
  });
});

describe("geometry", () => {
  it("measures the room a rotated piece takes", () => {
    const { scene, pieceIds } = sceneWith("2x4-leg");
    close(worldSize(scene.pieces[0]), [34.5, 1.5, 3.5]);
    close(worldSize(setOrientation(scene, pieceIds[0], "upright").pieces[0]), [1.5, 34.5, 3.5]);
    close(worldSize(setOrientation(scene, pieceIds[0], "edge").pieces[0]), [34.5, 3.5, 1.5]);
  });

  it("outlines a square-on piece as its rectangle and a turned one as its turned rectangle", () => {
    const { scene, pieceIds } = sceneWith("ply34-top");
    expect(pieceFootprint(scene.pieces[0])).toHaveLength(4);
    const turned = rotatePieces(scene, pieceIds, "y", 30).pieces[0];
    const outline = pieceFootprint(turned);
    expect(outline).toHaveLength(4);
    // Area is unchanged by turning about the vertical axis
    const area = Math.abs(outline.reduce((s, [x, z], i) => {
      const [nx, nz] = outline[(i + 1) % outline.length];
      return s + (x * nz - nx * z);
    }, 0)) / 2;
    expect(area).toBeCloseTo(72 * 24);
  });
});

describe("moving and turning", () => {
  it("translates only the pieces asked for", () => {
    const { scene, pieceIds } = sceneWith("2x4-8", "2x4-8");
    const moved = translatePieces(scene, [pieceIds[1]], [10, 0, -4]);
    expect(moved.pieces[0]).toBe(scene.pieces[0]);
    close(moved.pieces[1].position, [scene.pieces[1].position[0] + 10, scene.pieces[1].position[1], scene.pieces[1].position[2] - 4]);
    expect(scene.pieces[1].position).not.toEqual(moved.pieces[1].position);
  });

  it("places an edge, not a center", () => {
    const { scene, pieceIds } = sceneWith("2x4-leg");
    const upright = setOrientation(scene, pieceIds[0], "upright");
    const placed = setPieceEdge(setPieceEdge(upright, pieceIds[0], "x", 12), pieceIds[0], "y", 3);
    close(pieceBounds(placed.pieces[0]).min, [12, 3, pieceBounds(upright.pieces[0]).min[2]]);
  });

  it("stands a board up without sinking it into the floor", () => {
    const { scene, pieceIds } = sceneWith("2x4-leg");
    const up = rotatePieces(scene, pieceIds, "z", 90).pieces[0];
    expect(pieceBounds(up).min[1]).toBeCloseTo(0);
    expect(pieceBounds(up).max[1]).toBeCloseTo(34.5);
    expect(orientationOf(up)).toBe("upright");
  });

  it("turns several pieces together about their shared middle", () => {
    const { scene, pieceIds } = sceneWith("2x4-8", "2x4-8");
    const before = boundsOf(scene.pieces) as NonNullable<ReturnType<typeof boundsOf>>;
    const after = boundsOf(rotatePieces(scene, pieceIds, "y", 90).pieces) as NonNullable<ReturnType<typeof boundsOf>>;
    const mid = (b: typeof before, i: number) => (b.min[i] + b.max[i]) / 2;
    expect(mid(after, 0)).toBeCloseTo(mid(before, 0));
    expect(mid(after, 2)).toBeCloseTo(mid(before, 2));
    // Width and depth swap
    expect(after.max[0] - after.min[0]).toBeCloseTo(before.max[2] - before.min[2]);
    expect(after.max[2] - after.min[2]).toBeCloseTo(before.max[0] - before.min[0]);
  });

  it("four quarter turns come back to the start", () => {
    const { scene, pieceIds } = sceneWith("ply12-shelf");
    let s = scene;
    for (let i = 0; i < 4; i++) s = rotatePieces(s, pieceIds, "y", 90);
    close(s.pieces[0].position, scene.pieces[0].position);
    close(s.pieces[0].rotation, scene.pieces[0].rotation);
  });

  it("drops a raised piece to the floor", () => {
    const { scene, pieceIds } = sceneWith("2x4-8");
    const raised = translatePieces(scene, pieceIds, [0, 20, 0]);
    expect(pieceBounds(dropToFloor(raised, pieceIds).pieces[0]).min[1]).toBeCloseTo(0);
  });

  it("drags from the positions a drag started at", () => {
    const { scene, pieceIds } = sceneWith("2x4-8");
    const moved = setPositions(scene, { [pieceIds[0]]: [5, 0.75, 9] });
    expect(moved.pieces[0].position).toEqual([5, 0.75, 9]);
  });
});

describe("resizing", () => {
  it("cuts a 2×4 shorter from its low end", () => {
    const { scene, pieceIds } = sceneWith("2x4-8");
    const cut = resizePiece(scene, pieceIds[0], { length: 30 }).pieces[0];
    expect(cut.length).toBe(30);
    close(pieceBounds(cut).min, pieceBounds(scene.pieces[0]).min);
  });

  it("rips a 2×4, never wider than the board or thinner than the minimum", () => {
    const { scene, pieceIds } = sceneWith("2x4-8");
    const ripped = resizePiece(scene, pieceIds[0], { width: 1.5 }).pieces[0];
    expect(ripped.width).toBe(1.5);
    expect(isRipped(ripped)).toBe(true);
    expect(pieceLabel(ripped)).toBe("Ripped 2×4");
    expect(resizePiece(scene, pieceIds[0], { width: 9 }).pieces[0].width).toBe(3.5);
    expect(resizePiece(scene, pieceIds[0], { width: 0 }).pieces[0].width).toBe(0.5);
    expect(ripped.thickness).toBe(1.5);
  });

  it("keeps a standing leg on the floor when its length changes", () => {
    const { scene, pieceIds } = sceneWith("2x4-leg");
    const up = setOrientation(scene, pieceIds[0], "upright");
    const taller = resizePiece(up, pieceIds[0], { length: 40 }).pieces[0];
    expect(pieceBounds(taller).min[1]).toBeCloseTo(0);
    expect(pieceBounds(taller).max[1]).toBeCloseTo(40);
  });

  it("swaps plywood thickness and keeps the panel's underside where it was", () => {
    const { scene, pieceIds } = sceneWith("ply34-top");
    const raised = translatePieces(scene, pieceIds, [0, 34.5, 0]);
    const thin = setPieceStock(raised, pieceIds[0], "ply-1/2").pieces[0];
    expect(thin.thickness).toBe(0.5);
    expect(pieceBounds(thin).min[1]).toBeCloseTo(34.5);
    // Plywood can't become lumber
    expect(setPieceStock(raised, pieceIds[0], "2x4").pieces[0]).toBe(raised.pieces[0]);
  });
});

describe("duplicating and deleting", () => {
  it("copies with new ids, offset so the copy shows", () => {
    const { scene, pieceIds } = sceneWith("2x4-8");
    const { scene: next, ids } = duplicatePieces(scene, pieceIds);
    expect(next.pieces).toHaveLength(2);
    expect(ids[0]).not.toBe(pieceIds[0]);
    expect(next.pieces[1].position[0]).toBe(scene.pieces[0].position[0] + 6);
  });

  it("removes pieces and any group left empty", () => {
    const { scene, pieceIds } = sceneWith("2x4-8", "2x4-8");
    const grouped: Scene = {
      ...scene,
      groups: [{ id: "g_abcdef", name: "Frame" }],
      pieces: scene.pieces.map((p, i) => (i === 0 ? { ...p, groupId: "g_abcdef" } : p)),
    };
    const after = removePieces(grouped, [pieceIds[0]]);
    expect(after.pieces).toHaveLength(1);
    expect(after.groups).toHaveLength(0);
  });
});

describe("advice", () => {
  it("says nothing about an ordinary stud", () => {
    expect(pieceWarnings(sceneWith("2x4-8").scene.pieces[0])).toEqual([]);
  });

  it("notes a board over 8 ft and warns past 12 ft", () => {
    const { scene, pieceIds } = sceneWith("2x4-8");
    const ten = pieceWarnings(resizePiece(scene, pieceIds[0], { length: 100 }).pieces[0]);
    expect(ten).toHaveLength(1);
    expect(ten[0].level).toBe("info");
    expect(ten[0].text).toContain("10'");
    const tooLong = pieceWarnings(resizePiece(scene, pieceIds[0], { length: 150 }).pieces[0]);
    expect(tooLong[0].level).toBe("warn");
  });

  it("warns when a panel is bigger than a sheet, whichever way it's turned", () => {
    const { scene, pieceIds } = sceneWith("ply34-sheet");
    expect(pieceWarnings(scene.pieces[0])).toEqual([]);
    expect(pieceWarnings(resizePiece(scene, pieceIds[0], { length: 40, width: 96 }).pieces[0])).toEqual([]);
    expect(pieceWarnings(resizePiece(scene, pieceIds[0], { width: 60 }).pieces[0])[0].level).toBe("warn");
    expect(pieceWarnings(resizePiece(scene, pieceIds[0], { length: 100 }).pieces[0])[0].level).toBe("warn");
  });

  it("warns about a piece below the floor", () => {
    const { scene, pieceIds } = sceneWith("2x4-8");
    const sunk = translatePieces(scene, pieceIds, [0, -1, 0]).pieces[0];
    expect(pieceWarnings(sunk).some((w) => /below the floor/.test(w.text))).toBe(true);
  });

  it("summarizes the build", () => {
    const { scene } = sceneWith("2x4-8", "2x4-leg", "ply34-top");
    const s = summarize(scene);
    expect(s.pieceCount).toBe(3);
    expect(s.lumberInches).toBe(96 + 34.5);
    expect(s.sheetSquareInches).toBe(72 * 24);
    expect(s.warningCount).toBe(0);
    expect(summarize(emptyScene()).size).toBeNull();
  });
});

describe("saved scenes", () => {
  it("round-trips through JSON", () => {
    const { scene, pieceIds } = sceneWith("2x4-8", "ply34-top");
    const edited = rotatePieces(scene, [pieceIds[0]], "y", 45);
    expect(parseScene(serializeScene(edited))).toEqual(edited);
  });

  it("rejects other versions, unknown stock and bad numbers", () => {
    const { scene } = sceneWith("2x4-8");
    expect(parseScene({ ...scene, version: 2 })).toBeNull();
    expect(parseScene({ ...scene, pieces: [{ ...scene.pieces[0], stock: "unobtainium" }] })).toBeNull();
    expect(parseScene({ ...scene, pieces: [{ ...scene.pieces[0], position: [0, "x", 0] }] })).toBeNull();
    expect(parseScene({ ...scene, pieces: [scene.pieces[0], scene.pieces[0]] })).toBeNull();
    expect(parseScene("not json")).toBeNull();
    expect(parseScene(null)).toBeNull();
  });

  it("clamps sizes to the catalog and drops unknown fields", () => {
    const { scene } = sceneWith("2x4-8");
    const parsed = parseScene({
      ...scene,
      pieces: [{ ...scene.pieces[0], width: 40, thickness: 9, length: 5000, extra: "<script>" }],
    }) as Scene;
    expect(parsed.pieces[0].width).toBe(3.5);
    expect(parsed.pieces[0].thickness).toBe(1.5);
    expect(parsed.pieces[0].length).toBe(192);
    expect("extra" in parsed.pieces[0]).toBe(false);
  });

  it("cleans names and forgets groups nothing uses", () => {
    const { scene } = sceneWith("2x4-8");
    const parsed = parseScene({
      ...scene,
      name: "  My <b>bench</b>  ",
      groups: [{ id: "g_unused1", name: "Nothing" }],
      pieces: [{ ...scene.pieces[0], groupId: "g_missing" }],
    }) as Scene;
    expect(parsed.name).toBe("My bbench/b");
    expect(parsed.groups).toEqual([]);
    expect(parsed.pieces[0].groupId).toBeNull();
  });
});
