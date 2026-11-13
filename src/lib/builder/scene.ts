// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — the scene graph
//
// A design is a SCENE: a flat list of PIECES (each a rectangular board or
// panel cut from a catalog stock) plus optional GROUPS that pieces point at.
// It is plain JSON, versioned, and is the only thing saved, shared, forked
// or turned into a plan: the 2D view, the 3D view, the cut list and the
// build guide are all derived from it.
//
// Conventions (all in inches and degrees):
//   • World axes: X to the right, Y up from the floor (Y = 0), Z toward
//     the viewer. Same handedness as three.js, so the 3D view uses a
//     piece's numbers directly.
//   • A piece's own axes: length along X, thickness along Y, width along Z.
//     Unrotated, a 2×4 lies flat on its wide face, running left to right.
//   • `position` is the piece's CENTER. `rotation` is XYZ Euler angles in
//     degrees, identical to three.js' default Euler order.
//
// Every edit is a pure function: scene in, new scene out. That keeps the
// editor's state a single immutable value (which undo/redo snapshots) and
// lets the plan engine and tests run without a browser.
//
// Client-safe: no server imports, no three.js.
// ═══════════════════════════════════════════════════════════════════════════

import { SIZE_LIMITS, getStock, longestStock, type LibraryItem, type StockDef } from "@/lib/builder/catalog";
import { formatFeetInches } from "@/lib/builder/units";

export const SCENE_VERSION = 1;

export type Vec3 = [number, number, number];
export type Axis = "x" | "y" | "z";

const AXIS_INDEX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

export interface ScenePiece {
  id: string;
  /** Catalog stock id (see catalog.ts) */
  stock: string;
  /** Optional name the builder gave it ("Front leg") */
  name?: string;
  /** Along the piece's own X, inches */
  length: number;
  /** Along the piece's own Z, inches. Narrower than the stock = ripped. */
  width: number;
  /** Along the piece's own Y, inches. Always the stock's thickness. */
  thickness: number;
  /** Center, inches */
  position: Vec3;
  /** XYZ Euler angles, degrees */
  rotation: Vec3;
  /** Group this piece belongs to, if any */
  groupId: string | null;
}

export interface SceneGroup {
  id: string;
  name: string;
}

export interface Scene {
  version: typeof SCENE_VERSION;
  name: string;
  pieces: ScenePiece[];
  groups: SceneGroup[];
}

export const SCENE_LIMITS = {
  maxPieces: 400,
  maxGroups: 100,
  maxNameLength: 60,
  /** Pieces stay within this many inches of the origin on every axis */
  maxCoordinate: 1200,
} as const;

export const DEFAULT_SCENE_NAME = "Untitled design";

export function emptyScene(name: string = DEFAULT_SCENE_NAME): Scene {
  return { version: SCENE_VERSION, name, pieces: [], groups: [] };
}

// ═══════════════════════════════════════════════════════════════════════════
// Rotation math (3×3 matrices, row-major)
// ═══════════════════════════════════════════════════════════════════════════

type Mat3 = [Vec3, Vec3, Vec3];

const RAD = Math.PI / 180;

/** Rotation matrix for XYZ Euler angles in degrees (three.js order). */
export function rotationMatrix([rx, ry, rz]: Vec3): Mat3 {
  const a = Math.cos(rx * RAD);
  const b = Math.sin(rx * RAD);
  const c = Math.cos(ry * RAD);
  const d = Math.sin(ry * RAD);
  const e = Math.cos(rz * RAD);
  const f = Math.sin(rz * RAD);
  return [
    [c * e, -c * f, d],
    [a * f + b * e * d, a * e - b * f * d, -b * c],
    [b * f - a * e * d, b * e + a * f * d, a * c],
  ];
}

function axisMatrix(axis: Axis, degrees: number): Mat3 {
  const angles: Vec3 = [0, 0, 0];
  angles[AXIS_INDEX[axis]] = degrees;
  return rotationMatrix(angles);
}

function multiply(m: Mat3, n: Mat3): Mat3 {
  const out: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let r = 0; r < 3; r++) {
    for (let col = 0; col < 3; col++) {
      out[r][col] = m[r][0] * n[0][col] + m[r][1] * n[1][col] + m[r][2] * n[2][col];
    }
  }
  return out;
}

function apply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

/** Tidy an angle: (-180, 180], and no 89.99999 left over from the trig. */
function cleanAngle(degrees: number): number {
  let a = Math.round(degrees * 1e4) / 1e4;
  a = ((a % 360) + 360) % 360;
  if (a > 180) a -= 360;
  return a === 0 ? 0 : a;
}

/** XYZ Euler angles (degrees) for a rotation matrix. Inverse of rotationMatrix. */
export function eulerFromMatrix(m: Mat3): Vec3 {
  const m13 = Math.max(-1, Math.min(1, m[0][2]));
  const y = Math.asin(m13);
  let x: number;
  let z: number;
  if (Math.abs(m13) < 0.9999999) {
    x = Math.atan2(-m[1][2], m[2][2]);
    z = Math.atan2(-m[0][1], m[0][0]);
  } else {
    // Looking straight down the Y rotation: X and Z turn about the same
    // line, so all of it goes to X.
    x = Math.atan2(m[2][1], m[1][1]);
    z = 0;
  }
  return [cleanAngle(x / RAD), cleanAngle(y / RAD), cleanAngle(z / RAD)];
}

// ═══════════════════════════════════════════════════════════════════════════
// Geometry
// ═══════════════════════════════════════════════════════════════════════════

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

/** Half sizes along the piece's own X, Y, Z. */
function halfSize(piece: ScenePiece): Vec3 {
  return [piece.length / 2, piece.thickness / 2, piece.width / 2];
}

/** Size of the piece's world-aligned bounding box (how much room it takes as rotated). */
export function worldSize(piece: ScenePiece): Vec3 {
  const m = rotationMatrix(piece.rotation);
  const h = halfSize(piece);
  return [0, 1, 2].map(
    (i) => 2 * (Math.abs(m[i][0]) * h[0] + Math.abs(m[i][1]) * h[1] + Math.abs(m[i][2]) * h[2]),
  ) as Vec3;
}

export function pieceBounds(piece: ScenePiece): Bounds {
  const size = worldSize(piece);
  return {
    min: [piece.position[0] - size[0] / 2, piece.position[1] - size[1] / 2, piece.position[2] - size[2] / 2],
    max: [piece.position[0] + size[0] / 2, piece.position[1] + size[1] / 2, piece.position[2] + size[2] / 2],
  };
}

/** Bounding box of several pieces; null for none. */
export function boundsOf(pieces: ScenePiece[]): Bounds | null {
  if (pieces.length === 0) return null;
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const piece of pieces) {
    const b = pieceBounds(piece);
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], b.min[i]);
      max[i] = Math.max(max[i], b.max[i]);
    }
  }
  return { min, max };
}

/** The piece's 8 corners in world space. */
export function pieceCorners(piece: ScenePiece): Vec3[] {
  const m = rotationMatrix(piece.rotation);
  const h = halfSize(piece);
  const corners: Vec3[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const local = apply(m, [sx * h[0], sy * h[1], sz * h[2]]);
        corners.push([piece.position[0] + local[0], piece.position[1] + local[1], piece.position[2] + local[2]]);
      }
    }
  }
  return corners;
}

/**
 * Outline of the piece seen from straight above, as [x, z] points in order
 * around the shape. A square-on piece gives its rectangle; a tilted one
 * gives the six-sided shadow of the box.
 */
export function pieceFootprint(piece: ScenePiece): [number, number][] {
  const points = pieceCorners(piece)
    .map(([x, , z]) => [x, z] as [number, number])
    .sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  // Convex hull (monotone chain). The tolerance drops corners that sit on an edge.
  const EPS = 1e-9;
  const build = (source: [number, number][]) => {
    const chain: [number, number][] = [];
    for (const p of source) {
      while (chain.length >= 2 && cross(chain[chain.length - 2], chain[chain.length - 1], p) <= EPS) chain.pop();
      chain.push(p);
    }
    chain.pop();
    return chain;
  };
  return [...build(points), ...build([...points].reverse())];
}

// ═══════════════════════════════════════════════════════════════════════════
// Pieces
// ═══════════════════════════════════════════════════════════════════════════

/** Short random id. `prefix` keeps piece and group ids apart when reading a scene. */
export function newId(prefix: "p" | "g"): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Keep sizes inside what the stock can be cut to. Thickness always follows the stock. */
function clampSizes(stock: StockDef, length: number, width: number): { length: number; width: number; thickness: number } {
  if (stock.kind === "lumber") {
    return {
      length: clamp(length, SIZE_LIMITS.minLength, SIZE_LIMITS.maxLumberLength),
      width: clamp(width, stock.minWidth, stock.width),
      thickness: stock.thickness,
    };
  }
  return {
    length: clamp(length, SIZE_LIMITS.minLength, SIZE_LIMITS.maxSheetLength),
    width: clamp(width, stock.minWidth, SIZE_LIMITS.maxSheetWidth),
    thickness: stock.thickness,
  };
}

function clampPosition(position: Vec3): Vec3 {
  const m = SCENE_LIMITS.maxCoordinate;
  return [clamp(position[0], -m, m), clamp(position[1], -m, m), clamp(position[2], -m, m)];
}

/** True when a lumber piece is narrower than its stock (ripped on the table saw). */
export function isRipped(piece: ScenePiece): boolean {
  const stock = getStock(piece.stock);
  return !!stock && stock.kind === "lumber" && piece.width < stock.width - 1e-6;
}

/** What to call a piece: its own name, else what it's made of. */
export function pieceLabel(piece: ScenePiece): string {
  if (piece.name) return piece.name;
  const stock = getStock(piece.stock);
  if (!stock) return "Piece";
  if (stock.kind === "lumber") return isRipped(piece) ? "Ripped 2×4" : "2×4";
  return stock.label;
}

// ═══════════════════════════════════════════════════════════════════════════
// Edits — each returns a new scene and never changes the one passed in
// ═══════════════════════════════════════════════════════════════════════════

function mapPieces(scene: Scene, ids: Iterable<string>, fn: (piece: ScenePiece) => ScenePiece): Scene {
  const wanted = new Set(ids);
  if (wanted.size === 0) return scene;
  return { ...scene, pieces: scene.pieces.map((p) => (wanted.has(p.id) ? fn(p) : p)) };
}

function selected(scene: Scene, ids: Iterable<string>): ScenePiece[] {
  const wanted = new Set(ids);
  return scene.pieces.filter((p) => wanted.has(p.id));
}

/** Gap left between the build and a newly added piece, inches. */
const NEW_PIECE_GAP = 6;

/**
 * Add a library item. It lands flat on the floor just in front of whatever
 * is already built, lined up with its left edge, so new parts never drop on
 * top of finished work.
 */
export function addFromLibrary(scene: Scene, item: LibraryItem): { scene: Scene; id: string | null } {
  const stock = getStock(item.stock);
  if (!stock || scene.pieces.length >= SCENE_LIMITS.maxPieces) return { scene, id: null };
  const sizes = clampSizes(stock, item.length, item.width);
  const existing = boundsOf(scene.pieces);
  const left = existing ? existing.min[0] : -sizes.length / 2;
  const back = existing ? existing.max[2] + NEW_PIECE_GAP : -sizes.width / 2;
  const piece: ScenePiece = {
    id: newId("p"),
    stock: stock.id,
    ...sizes,
    position: clampPosition([left + sizes.length / 2, sizes.thickness / 2, back + sizes.width / 2]),
    rotation: [0, 0, 0],
    groupId: null,
  };
  return { scene: { ...scene, pieces: [...scene.pieces, piece] }, id: piece.id };
}

export function removePieces(scene: Scene, ids: Iterable<string>): Scene {
  const gone = new Set(ids);
  if (gone.size === 0) return scene;
  const pieces = scene.pieces.filter((p) => !gone.has(p.id));
  const used = new Set(pieces.map((p) => p.groupId));
  return { ...scene, pieces, groups: scene.groups.filter((g) => used.has(g.id)) };
}

/** Copy pieces, set off diagonally so the copies are visible. Returns the copies' ids. */
export function duplicatePieces(scene: Scene, ids: Iterable<string>, offset = NEW_PIECE_GAP): { scene: Scene; ids: string[] } {
  const room = SCENE_LIMITS.maxPieces - scene.pieces.length;
  const copies = selected(scene, ids)
    .slice(0, Math.max(0, room))
    .map((p) => ({
      ...p,
      id: newId("p"),
      position: clampPosition([p.position[0] + offset, p.position[1], p.position[2] + offset]),
    }));
  if (copies.length === 0) return { scene, ids: [] };
  return { scene: { ...scene, pieces: [...scene.pieces, ...copies] }, ids: copies.map((c) => c.id) };
}

export function translatePieces(scene: Scene, ids: Iterable<string>, delta: Vec3): Scene {
  return mapPieces(scene, ids, (p) => ({
    ...p,
    position: clampPosition([p.position[0] + delta[0], p.position[1] + delta[1], p.position[2] + delta[2]]),
  }));
}

/** Put pieces at exact centers (used while dragging, from the positions the drag started at). */
export function setPositions(scene: Scene, positions: Record<string, Vec3>): Scene {
  return mapPieces(scene, Object.keys(positions), (p) => ({ ...p, position: clampPosition(positions[p.id]) }));
}

/**
 * Move a piece so its low side on one axis sits at `value`: its left edge
 * (x), its underside (y) or its back edge (z). This is how the inspector's
 * position fields work, because builders measure to an edge, not a center.
 */
export function setPieceEdge(scene: Scene, id: string, axis: Axis, value: number): Scene {
  const i = AXIS_INDEX[axis];
  return mapPieces(scene, [id], (p) => {
    const position: Vec3 = [...p.position];
    position[i] = value + worldSize(p)[i] / 2;
    return { ...p, position: clampPosition(position) };
  });
}

/** Re-seat a changed piece so its low corner stays where the original's was. */
function keepLowCorner(before: ScenePiece, after: ScenePiece): ScenePiece {
  const was = pieceBounds(before).min;
  const size = worldSize(after);
  return {
    ...after,
    position: clampPosition([was[0] + size[0] / 2, was[1] + size[1] / 2, was[2] + size[2] / 2]),
  };
}

/**
 * Change a piece's length and/or width (a narrower 2×4 is a rip). The piece
 * grows or shrinks from its low corner, so a leg stays on the floor and a
 * rail stays against the post it was butted to.
 */
export function resizePiece(scene: Scene, id: string, size: { length?: number; width?: number }): Scene {
  return mapPieces(scene, [id], (p) => {
    const stock = getStock(p.stock);
    if (!stock) return p;
    const sizes = clampSizes(stock, size.length ?? p.length, size.width ?? p.width);
    return keepLowCorner(p, { ...p, ...sizes });
  });
}

/** Switch a piece to another stock of the same kind (plywood thickness). */
export function setPieceStock(scene: Scene, id: string, stockId: string): Scene {
  return mapPieces(scene, [id], (p) => {
    const from = getStock(p.stock);
    const to = getStock(stockId);
    if (!from || !to || from.kind !== to.kind) return p;
    return keepLowCorner(p, { ...p, stock: to.id, ...clampSizes(to, p.length, p.width) });
  });
}

export function renamePiece(scene: Scene, id: string, name: string): Scene {
  const clean = cleanName(name);
  return mapPieces(scene, [id], (p) => {
    const { name: _old, ...rest } = p;
    return clean ? { ...rest, name: clean } : rest;
  });
}

export function renameScene(scene: Scene, name: string): Scene {
  return { ...scene, name: cleanName(name) || DEFAULT_SCENE_NAME };
}

/**
 * Turn pieces about a world axis. Several pieces turn together about the
 * middle of the selection, like one assembly. Whatever is turned keeps its
 * lowest point at the same height, so standing a board up doesn't bury half
 * of it in the floor.
 */
export function rotatePieces(scene: Scene, ids: Iterable<string>, axis: Axis, degrees: number): Scene {
  const targets = selected(scene, ids);
  const before = boundsOf(targets);
  if (!before || degrees === 0) return scene;
  const pivot: Vec3 = [
    (before.min[0] + before.max[0]) / 2,
    (before.min[1] + before.max[1]) / 2,
    (before.min[2] + before.max[2]) / 2,
  ];
  const turn = axisMatrix(axis, degrees);
  const turned = targets.map((p) => {
    const arm = apply(turn, [p.position[0] - pivot[0], p.position[1] - pivot[1], p.position[2] - pivot[2]]);
    return {
      ...p,
      position: [pivot[0] + arm[0], pivot[1] + arm[1], pivot[2] + arm[2]] as Vec3,
      rotation: eulerFromMatrix(multiply(turn, rotationMatrix(p.rotation))),
    };
  });
  const lift = before.min[1] - (boundsOf(turned) as Bounds).min[1];
  const byId = new Map(turned.map((p) => [p.id, p]));
  return mapPieces(scene, byId.keys(), (p) => {
    const t = byId.get(p.id) as ScenePiece;
    return { ...t, position: clampPosition([t.position[0], t.position[1] + lift, t.position[2]]) };
  });
}

/** Named ways a board can sit. */
export type Orientation = "flat" | "edge" | "upright";

export const ORIENTATION_ROTATIONS: Record<Orientation, Vec3> = {
  /** Lying on its wide face */
  flat: [0, 0, 0],
  /** Lying on its narrow edge, wide face to the front */
  edge: [90, 0, 0],
  /** Standing on end */
  upright: [0, 0, 90],
};

/** Which named orientation a piece is in, if it is exactly one of them. */
export function orientationOf(piece: ScenePiece): Orientation | null {
  for (const key of Object.keys(ORIENTATION_ROTATIONS) as Orientation[]) {
    const r = ORIENTATION_ROTATIONS[key];
    if (r.every((angle, i) => Math.abs(cleanAngle(piece.rotation[i] - angle)) < 1e-3)) return key;
  }
  return null;
}

/** Lay a piece flat, on edge, or stand it up, keeping its low corner where it is. */
export function setOrientation(scene: Scene, id: string, orientation: Orientation): Scene {
  return mapPieces(scene, [id], (p) => keepLowCorner(p, { ...p, rotation: [...ORIENTATION_ROTATIONS[orientation]] }));
}

/** Set a piece's rotation angles directly, keeping its lowest point at the same height. */
export function setRotation(scene: Scene, id: string, rotation: Vec3): Scene {
  return mapPieces(scene, [id], (p) => {
    const next = { ...p, rotation: rotation.map(cleanAngle) as Vec3 };
    const lift = pieceBounds(p).min[1] - pieceBounds(next).min[1];
    return { ...next, position: clampPosition([p.position[0], p.position[1] + lift, p.position[2]]) };
  });
}

/** Lower (or raise) pieces together until the lowest one rests on the floor. */
export function dropToFloor(scene: Scene, ids: Iterable<string>): Scene {
  const targets = selected(scene, ids);
  const b = boundsOf(targets);
  if (!b || Math.abs(b.min[1]) < 1e-9) return scene;
  return translatePieces(
    scene,
    targets.map((p) => p.id),
    [0, -b.min[1], 0],
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Advice — things a builder should know, never a hard stop
// ═══════════════════════════════════════════════════════════════════════════

export interface PieceWarning {
  /** "warn": can't be bought or cut as drawn. "info": worth knowing. */
  level: "warn" | "info";
  text: string;
}

const FLOOR_TOLERANCE = 0.01;

export function pieceWarnings(piece: ScenePiece): PieceWarning[] {
  const stock = getStock(piece.stock);
  if (!stock) return [];
  const out: PieceWarning[] = [];

  if (stock.kind === "lumber") {
    const longest = longestStock(stock);
    if (piece.length > longest) {
      out.push({
        level: "warn",
        text: `Longer than a ${formatFeetInches(longest)} board, the longest sold. Split it into two pieces.`,
      });
    } else if (piece.length > stock.stockLengths[0]) {
      const needs = stock.stockLengths.find((l) => l >= piece.length) as number;
      out.push({
        level: "info",
        text: `Longer than 8 ft, so it needs a ${formatFeetInches(needs)} board. Splitting it would let you buy 8 ft studs.`,
      });
    }
  } else {
    const long = Math.max(piece.length, piece.width);
    const short = Math.min(piece.length, piece.width);
    if (long > longestStock(stock) || short > stock.width) {
      out.push({
        level: "warn",
        text: "Bigger than one 4 × 8 sheet. Split it into two panels that meet over a support.",
      });
    }
  }

  if (pieceBounds(piece).min[1] < -FLOOR_TOLERANCE) {
    out.push({ level: "warn", text: "Part of this piece is below the floor." });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════

export interface SceneSummary {
  pieceCount: number;
  /** Overall width (X), height (Y), depth (Z) in inches; null when empty */
  size: Vec3 | null;
  /** Total length of 2×4 pieces, inches */
  lumberInches: number;
  /** Total plywood area, square inches */
  sheetSquareInches: number;
  /** Pieces with at least one "warn" */
  warningCount: number;
}

export function summarize(scene: Scene): SceneSummary {
  const b = boundsOf(scene.pieces);
  let lumberInches = 0;
  let sheetSquareInches = 0;
  let warningCount = 0;
  for (const piece of scene.pieces) {
    const stock = getStock(piece.stock);
    if (stock?.kind === "lumber") lumberInches += piece.length;
    else if (stock?.kind === "sheet") sheetSquareInches += piece.length * piece.width;
    if (pieceWarnings(piece).some((w) => w.level === "warn")) warningCount++;
  }
  return {
    pieceCount: scene.pieces.length,
    size: b ? [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]] : null,
    lumberInches,
    sheetSquareInches,
    warningCount,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Reading untrusted scenes (saved drafts, shared links, the database)
// ═══════════════════════════════════════════════════════════════════════════

const ID_RE = /^[pg]_[a-z0-9]{6,24}$/;

function cleanName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[^\p{L}\p{N} '&.,×x/"()#\-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SCENE_LIMITS.maxNameLength);
}

function readVec3(raw: unknown): Vec3 | null {
  if (!Array.isArray(raw) || raw.length !== 3) return null;
  const v = raw.map(Number);
  return v.every(Number.isFinite) ? (v as Vec3) : null;
}

function readPiece(raw: unknown, groupIds: Set<string>, seen: Set<string>): ScenePiece | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const stock = typeof r.stock === "string" ? getStock(r.stock) : undefined;
  const position = readVec3(r.position);
  const rotation = readVec3(r.rotation);
  const length = Number(r.length);
  const width = Number(r.width);
  if (!stock || !position || !rotation || !(length > 0) || !(width > 0)) return null;
  if (typeof r.id !== "string" || !ID_RE.test(r.id) || seen.has(r.id)) return null;
  seen.add(r.id);
  const name = cleanName(r.name);
  return {
    id: r.id,
    stock: stock.id,
    ...(name ? { name } : {}),
    ...clampSizes(stock, length, width),
    position: clampPosition(position),
    rotation: rotation.map(cleanAngle) as Vec3,
    groupId: typeof r.groupId === "string" && groupIds.has(r.groupId) ? r.groupId : null,
  };
}

/**
 * Validate an untrusted scene. Sizes are clamped to what the catalog allows
 * and unknown fields are dropped; a piece that can't be read (unknown stock,
 * bad numbers, duplicate id) makes the whole scene invalid rather than
 * quietly producing a plan for a different build. Returns null if invalid.
 */
export function parseScene(raw: unknown): Scene | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (r.version !== SCENE_VERSION) return null;
  if (!Array.isArray(r.pieces) || r.pieces.length > SCENE_LIMITS.maxPieces) return null;
  const rawGroups = Array.isArray(r.groups) ? r.groups : [];
  if (rawGroups.length > SCENE_LIMITS.maxGroups) return null;

  const groups: SceneGroup[] = [];
  const groupIds = new Set<string>();
  for (const g of rawGroups) {
    if (!g || typeof g !== "object") return null;
    const id = (g as Record<string, unknown>).id;
    if (typeof id !== "string" || !ID_RE.test(id) || groupIds.has(id)) return null;
    groupIds.add(id);
    groups.push({ id, name: cleanName((g as Record<string, unknown>).name) || "Group" });
  }

  const pieces: ScenePiece[] = [];
  const seen = new Set<string>();
  for (const p of r.pieces) {
    const piece = readPiece(p, groupIds, seen);
    if (!piece) return null;
    pieces.push(piece);
  }

  const used = new Set(pieces.map((p) => p.groupId));
  return {
    version: SCENE_VERSION,
    name: cleanName(r.name) || DEFAULT_SCENE_NAME,
    pieces,
    groups: groups.filter((g) => used.has(g.id)),
  };
}

export function serializeScene(scene: Scene): string {
  return JSON.stringify(scene);
}
