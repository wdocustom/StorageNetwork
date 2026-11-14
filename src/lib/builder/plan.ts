// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — the plan engine
//
// Turns a scene (what the builder drew) into a build plan (what they take to
// the store and the garage):
//
//   PARTS       identical pieces become one lettered part: "A × 4".
//   CUT LIST    2×4 parts packed onto 8 / 10 / 12 ft boards, plywood parts
//               nested on 4 × 8 sheets, saw kerf included, offcuts listed.
//   JOINTS      every pair of pieces that touch, with the screws that hold
//               them: this is where fastener counts come from.
//   STEPS       an order to build in: from the floor up, never asking for a
//               piece before something it fastens to is in place.
//   SHOPPING    boards, sheets, screws by the box (10% spare), hardware.
//
// Assumptions, stated in the plan itself:
//   • Joinery is screwed butt joints. 2×4 to 2×4 takes #9 × 3" screws;
//     plywood takes a screw sized to its thickness. Where a screw can't go
//     straight through (the piece is more than 1-1/2" thick that way) the
//     step says to drive it at an angle.
//   • Ripped 2×4s are ripped full length first, then crosscut, the way the
//     tote-rack plans do it. A board holds as many rips as fit its width.
//   • Plywood parts may be turned on the sheet; grain direction is not
//     tracked.
//
// Pure and client-safe: no React, no three.js, no server imports. The same
// function can run in the browser for a live preview and on the server
// behind an access check.
// ═══════════════════════════════════════════════════════════════════════════

import { getStock, longestStock, type StockDef } from "@/lib/builder/catalog";
import {
  SAW_KERF,
  boundsOf,
  boxesOverlap,
  findOverlaps,
  isRipped,
  isSquareOn,
  orientationOf,
  pieceBounds,
  pieceLabel,
  type Bounds,
  type Scene,
  type ScenePiece,
} from "@/lib/builder/scene";
import { formatFeetInches, formatInches } from "@/lib/builder/units";

// ═══════════════════════════════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════════════════════════════

export interface PlanPart {
  /** "A", "B"… for parts you cut; "" for hardware */
  letter: string;
  /** "2×4", "Ripped 2×4", '3/4" Plywood', or the name the builder gave every piece of it */
  label: string;
  stock: string;
  kind: StockDef["kind"];
  length: number;
  width: number;
  thickness: number;
  ripped: boolean;
  qty: number;
  pieceIds: string[];
  /** `34-1/2"` for lumber, `24" × 60"` for panels */
  size: string;
}

export interface BoardCut {
  letter: string;
  length: number;
}

/** One lengthwise strip of a board: the whole board, or one rip of it. */
export interface BoardLane {
  width: number;
  cuts: BoardCut[];
  /** What's left at the end of the strip, inches */
  offcut: number;
}

export interface PlanBoard {
  stock: string;
  length: number;
  lanes: BoardLane[];
  /** Width left over beside the rips, inches (0 for an unripped board) */
  spareWidth: number;
  /** How many boards are cut exactly like this one */
  count: number;
}

export interface SheetPlacement {
  letter: string;
  /** Position on the sheet, inches from one corner: x along the 8 ft side */
  x: number;
  y: number;
  /** Size as placed (already turned if `turned`) */
  w: number;
  h: number;
  turned: boolean;
}

export interface PlanSheet {
  stock: string;
  label: string;
  placements: SheetPlacement[];
  /** Share of the sheet that becomes parts, 0–1 */
  used: number;
}

export interface PlanJoint {
  a: string;
  b: string;
  fastener: string;
  count: number;
  /** A screw can't pass straight through: drive it at an angle */
  angled: boolean;
}

export interface PlanStepPart {
  letter: string;
  label: string;
  qty: number;
  size: string;
}

export interface PlanStep {
  id: string;
  number: number;
  title: string;
  instruction: string;
  /** Pieces that go on in this step (empty for the cutting step) */
  pieceIds: string[];
  parts: PlanStepPart[];
  fasteners: { name: string; qty: number }[];
  tools: string[];
  tip?: string;
}

export interface PlanShoppingItem {
  name: string;
  detail: string;
  qty: number | string;
}

export interface PlanOffcut {
  description: string;
  qty: number;
}

export interface CustomPlan {
  name: string;
  summary: string;
  dimensions: { width: string; height: string; depth: string };
  pieceCount: number;
  parts: PlanPart[];
  /** Part letter for every piece id ("" for hardware) */
  letterOf: Record<string, string>;
  boards: PlanBoard[];
  sheets: PlanSheet[];
  /** Leftovers worth keeping */
  offcuts: PlanOffcut[];
  joints: PlanJoint[];
  steps: PlanStep[];
  shoppingList: PlanShoppingItem[];
  tools: string[];
  safetyNotes: string[];
  notes: string[];
  /** Things to fix before building: pieces that can't be bought, overlap or float */
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

/** Pieces closer than this are touching, inches */
const TOUCH = 1 / 16;
/** Two faces must share at least this much to be a joint, inches */
const MIN_CONTACT = 0.25;
/** A screw goes straight through anything up to this thick, inches (a 2×4's thin way) */
const MAX_THROUGH = 1.6;
/** Extra fasteners to buy */
const SPARE = 1.1;
/** Shortest board end / narrowest strip worth listing as a leftover, inches */
const KEEP_OFFCUT = 6;
const KEEP_STRIP = 1;

const SCREW_3 = '#9 × 3" Star-Drive Screws';
const SCREW_158 = '#9 × 1-5/8" Star-Drive Screws';
const SCREW_114 = '#8 × 1-1/4" Wood Screws';
const SCREW_34 = '#6 × 3/4" Wood Screws';

/** Screws per box, as sold (the first two match the tote-rack plans) */
const BOX_COUNT: Record<string, number> = {
  [SCREW_3]: 137,
  [SCREW_158]: 158,
  [SCREW_114]: 100,
  [SCREW_34]: 100,
  '1/4" × 1" Structural Screws': 95,
};

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

// ═══════════════════════════════════════════════════════════════════════════
// Parts
// ═══════════════════════════════════════════════════════════════════════════

const round16 = (n: number) => Math.round(n * 16) / 16;

function letterFor(index: number): string {
  // A…Z, then AA, AB…
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

function partSize(stock: StockDef, length: number, width: number): string {
  if (stock.kind === "lumber") return formatInches(length);
  if (stock.kind === "sheet") return `${formatInches(Math.min(length, width))} × ${formatInches(Math.max(length, width))}`;
  return "";
}

const KIND_ORDER: Record<StockDef["kind"], number> = { lumber: 0, sheet: 1, hardware: 2 };

/** Group identical pieces into lettered parts: long 2×4s first, then rips, panels, hardware. */
function buildParts(pieces: ScenePiece[]): PlanPart[] {
  const byKey = new Map<string, PlanPart>();
  const names = new Map<string, Set<string>>();
  for (const piece of pieces) {
    const stock = getStock(piece.stock);
    if (!stock) continue;
    const length = round16(piece.length);
    const width = round16(piece.width);
    const key = `${stock.id}|${length}|${width}`;
    let part = byKey.get(key);
    if (!part) {
      part = {
        letter: "",
        label: pieceLabel({ ...piece, name: undefined }),
        stock: stock.id,
        kind: stock.kind,
        length,
        width,
        thickness: stock.thickness,
        ripped: isRipped(piece),
        qty: 0,
        pieceIds: [],
        size: partSize(stock, length, width),
      };
      byKey.set(key, part);
      names.set(key, new Set());
    }
    part.qty += 1;
    part.pieceIds.push(piece.id);
    (names.get(key) as Set<string>).add(piece.name ?? "");
  }

  const parts = [...byKey.entries()].map(([key, part]) => {
    // When the builder gave every piece of a part the same name, use it.
    const given = [...(names.get(key) as Set<string>)];
    return given.length === 1 && given[0] ? { ...part, label: given[0] } : part;
  });
  parts.sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      Number(a.ripped) - Number(b.ripped) ||
      b.thickness - a.thickness ||
      b.length * b.width - a.length * a.width ||
      a.stock.localeCompare(b.stock),
  );
  let lettered = 0;
  for (const part of parts) if (part.kind !== "hardware") part.letter = letterFor(lettered++);
  return parts;
}

// ═══════════════════════════════════════════════════════════════════════════
// Lumber: boards, lanes and cuts
// ═══════════════════════════════════════════════════════════════════════════

interface OpenLane extends BoardLane {
  /** Length still free, allowing for the kerf of the next cut */
  free: number;
}
interface OpenBoard {
  stock: StockDef;
  length: number;
  lanes: OpenLane[];
  widthFree: number;
}

/**
 * Pack lumber parts onto boards. Widest and longest first; each piece goes
 * in the strip of its own width where it leaves the least waste, else in a
 * new strip beside the others on a board with width to spare, else on a new
 * board (the shortest length sold that fits it).
 */
function packLumber(parts: PlanPart[]): { boards: OpenBoard[]; tooLong: PlanPart[] } {
  const boards: OpenBoard[] = [];
  const tooLong: PlanPart[] = [];
  const pieces: { part: PlanPart; stock: StockDef }[] = [];
  for (const part of parts) {
    const stock = getStock(part.stock);
    if (!stock || stock.kind !== "lumber") continue;
    if (part.length > longestStock(stock)) {
      tooLong.push(part);
      continue;
    }
    for (let i = 0; i < part.qty; i++) pieces.push({ part, stock });
  }
  pieces.sort((a, b) => b.part.width - a.part.width || b.part.length - a.part.length);

  for (const { part, stock } of pieces) {
    const place = (lane: OpenLane) => {
      lane.cuts.push({ letter: part.letter, length: part.length });
      lane.free -= part.length + SAW_KERF;
      lane.offcut = Math.max(0, lane.free);
    };

    // 1. A strip of this width with room, tightest fit first
    let best: OpenLane | null = null;
    for (const board of boards) {
      if (board.stock.id !== stock.id) continue;
      for (const lane of board.lanes) {
        if (Math.abs(lane.width - part.width) > 1e-6 || lane.free < part.length - 1e-6) continue;
        if (!best || lane.free < best.free) best = lane;
      }
    }
    if (best) {
      place(best);
      continue;
    }

    // 2. A new strip on a board that has the width left (a rip beside a rip)
    let host: OpenBoard | null = null;
    for (const board of boards) {
      if (board.stock.id !== stock.id || board.length < part.length - 1e-6) continue;
      if (board.widthFree < part.width + SAW_KERF - 1e-6) continue;
      if (!host || board.widthFree < host.widthFree) host = board;
    }
    // 3. A new board
    if (!host) {
      const length = stock.stockLengths.find((l) => l >= part.length - 1e-6) as number;
      host = { stock, length, lanes: [], widthFree: stock.width };
      boards.push(host);
    }
    const lane: OpenLane = { width: part.width, cuts: [], offcut: host.length, free: host.length };
    host.widthFree -= part.width + (host.lanes.length > 0 ? SAW_KERF : 0);
    host.lanes.push(lane);
    place(lane);
  }
  return { boards, tooLong };
}

/** Collapse boards that are cut identically into one entry with a count. */
function groupBoards(open: OpenBoard[]): PlanBoard[] {
  const groups = new Map<string, PlanBoard>();
  for (const board of open) {
    const lanes: BoardLane[] = board.lanes.map((l) => ({ width: l.width, cuts: l.cuts, offcut: round16(l.offcut) }));
    const key = `${board.stock.id}|${board.length}|${lanes
      .map((l) => `${l.width}:${l.cuts.map((c) => `${c.letter}${c.length}`).join(",")}`)
      .join("/")}`;
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else {
      groups.set(key, {
        stock: board.stock.id,
        length: board.length,
        lanes,
        spareWidth: board.lanes.length > 1 || board.lanes[0].width < board.stock.width - 1e-6 ? round16(Math.max(0, board.widthFree)) : 0,
        count: 1,
      });
    }
  }
  return [...groups.values()].sort((a, b) => b.length - a.length || b.count - a.count);
}

// ═══════════════════════════════════════════════════════════════════════════
// Plywood: nesting parts on sheets
// ═══════════════════════════════════════════════════════════════════════════

interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface OpenSheet {
  stock: StockDef;
  free: FreeRect[];
  placements: SheetPlacement[];
}

/**
 * Nest panel parts on sheets with straight, edge-to-edge (guillotine) cuts,
 * which is how a sheet is actually broken down with a circular or table
 * saw. Biggest parts first; each goes in the free rectangle it fits most
 * snugly, turned if that fits better.
 */
function packSheets(parts: PlanPart[]): { sheets: OpenSheet[]; tooBig: PlanPart[] } {
  const sheets: OpenSheet[] = [];
  const tooBig: PlanPart[] = [];
  const pieces: { part: PlanPart; stock: StockDef }[] = [];
  for (const part of parts) {
    const stock = getStock(part.stock);
    if (!stock || stock.kind !== "sheet") continue;
    const sheetLong = longestStock(stock);
    if (Math.max(part.length, part.width) > sheetLong + 1e-6 || Math.min(part.length, part.width) > stock.width + 1e-6) {
      tooBig.push(part);
      continue;
    }
    for (let i = 0; i < part.qty; i++) pieces.push({ part, stock });
  }
  pieces.sort((a, b) => b.part.length * b.part.width - a.part.length * a.part.width);

  for (const { part, stock } of pieces) {
    let best: { sheet: OpenSheet; index: number; w: number; h: number; turned: boolean; score: number } | null = null;
    const consider = (sheet: OpenSheet) => {
      sheet.free.forEach((rect, index) => {
        for (const turned of [false, true]) {
          const w = turned ? part.width : part.length;
          const h = turned ? part.length : part.width;
          if (w > rect.w + 1e-6 || h > rect.h + 1e-6) continue;
          // Snuggest fit: least room left on the tighter side
          const score = Math.min(rect.w - w, rect.h - h);
          if (!best || score < best.score) best = { sheet, index, w, h, turned, score };
        }
      });
    };
    sheets.filter((s) => s.stock.id === stock.id).forEach(consider);
    if (!best) {
      const fresh: OpenSheet = { stock, free: [{ x: 0, y: 0, w: longestStock(stock), h: stock.width }], placements: [] };
      sheets.push(fresh);
      consider(fresh);
    }
    const spot = best as unknown as { sheet: OpenSheet; index: number; w: number; h: number; turned: boolean };
    const rect = spot.sheet.free[spot.index];
    spot.sheet.placements.push({ letter: part.letter, x: rect.x, y: rect.y, w: spot.w, h: spot.h, turned: spot.turned });

    // Cut the part off the rectangle: one cut the full way across, one
    // across what's left, each taking a kerf. Cut the longer way first so
    // the bigger leftover stays one piece.
    const right = rect.w - spot.w - SAW_KERF;
    const below = rect.h - spot.h - SAW_KERF;
    const leftovers: FreeRect[] = [];
    if (right > below) {
      if (right > 0) leftovers.push({ x: rect.x + spot.w + SAW_KERF, y: rect.y, w: right, h: rect.h });
      if (below > 0) leftovers.push({ x: rect.x, y: rect.y + spot.h + SAW_KERF, w: spot.w, h: below });
    } else {
      if (below > 0) leftovers.push({ x: rect.x, y: rect.y + spot.h + SAW_KERF, w: rect.w, h: below });
      if (right > 0) leftovers.push({ x: rect.x + spot.w + SAW_KERF, y: rect.y, w: right, h: spot.h });
    }
    spot.sheet.free.splice(spot.index, 1, ...leftovers);
  }
  return { sheets, tooBig };
}

// ═══════════════════════════════════════════════════════════════════════════
// Joints
// ═══════════════════════════════════════════════════════════════════════════

interface Contact {
  /** Longer side of the shared face, inches */
  run: number;
  /** Thinnest way through either piece, square to the shared face (Infinity when not square-on) */
  through: number;
}

/** How two pieces meet, or null if they don't touch. */
function contactBetween(a: ScenePiece, ba: Bounds, b: ScenePiece, bb: Bounds): Contact | null {
  // Quick reject, then the exact test (handles angled braces)
  for (let i = 0; i < 3; i++) if (ba.min[i] - bb.max[i] > TOUCH || bb.min[i] - ba.max[i] > TOUCH) return null;
  if (!boxesOverlap(a, b, -TOUCH)) return null;

  if (isSquareOn(a) && isSquareOn(b)) {
    // Square-on boxes meet face to face: find the axis they touch along.
    const shared = [0, 1, 2].map((i) => Math.min(ba.max[i], bb.max[i]) - Math.max(ba.min[i], bb.min[i]));
    const normals = [0, 1, 2].filter((i) => Math.abs(shared[i]) <= TOUCH * 2);
    if (normals.length !== 1) return null; // edge-to-edge or corner contact isn't a joint
    const n = normals[0];
    const face = [0, 1, 2].filter((i) => i !== n).map((i) => shared[i]);
    if (Math.min(...face) < MIN_CONTACT) return null;
    return {
      run: Math.max(...face),
      through: Math.min(ba.max[n] - ba.min[n], bb.max[n] - bb.min[n]),
    };
  }
  // An angled piece: it touches, so it's fastened where it lands.
  return { run: 0, through: Infinity };
}

function sheetScrew(stock: StockDef): string {
  if (stock.thickness >= 0.7) return SCREW_158;
  if (stock.thickness >= 0.45) return SCREW_114;
  return SCREW_34;
}

/** The screws for one joint, or null when the pair isn't fastened (two totes, a tote on a shelf). */
function fastenJoint(a: ScenePiece, b: ScenePiece, contact: Contact): Omit<PlanJoint, "a" | "b"> | null {
  const sa = getStock(a.stock) as StockDef;
  const sb = getStock(b.stock) as StockDef;
  if (sa.hardware?.placeholder || sb.hardware?.placeholder) return null;

  const hardware = sa.kind === "hardware" ? sa : sb.kind === "hardware" ? sb : null;
  if (hardware) {
    if (sa.kind === "hardware" && sb.kind === "hardware") return null;
    const screws = hardware.hardware?.screws;
    return screws ? { fastener: screws.name, count: screws.each, angled: false } : null;
  }

  const sheet = sa.kind === "sheet" ? sa : sb.kind === "sheet" ? sb : null;
  if (sheet) {
    // A row of screws along the joint, about every 8"
    return { fastener: sheetScrew(sheet), count: Math.max(2, Math.ceil(contact.run / 8) + 1), angled: false };
  }
  // 2×4 to 2×4: two screws for a butt joint, one about every 10" where they run together
  return {
    fastener: SCREW_3,
    count: contact.run <= 5.5 ? 2 : Math.ceil(contact.run / 10) + 1,
    angled: contact.through > MAX_THROUGH,
  };
}

function findJoints(pieces: ScenePiece[]): { joints: PlanJoint[]; touching: Map<string, Set<string>> } {
  const boxes = pieces.map(pieceBounds);
  const joints: PlanJoint[] = [];
  const touching = new Map<string, Set<string>>(pieces.map((p) => [p.id, new Set()]));
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const contact = contactBetween(pieces[i], boxes[i], pieces[j], boxes[j]);
      if (!contact) continue;
      (touching.get(pieces[i].id) as Set<string>).add(pieces[j].id);
      (touching.get(pieces[j].id) as Set<string>).add(pieces[i].id);
      const fastening = fastenJoint(pieces[i], pieces[j], contact);
      if (fastening) joints.push({ a: pieces[i].id, b: pieces[j].id, ...fastening });
    }
  }
  return { joints, touching };
}

// ═══════════════════════════════════════════════════════════════════════════
// Steps
// ═══════════════════════════════════════════════════════════════════════════

interface Cluster {
  part: PlanPart;
  pieces: ScenePiece[];
  groupId: string | null;
  low: number;
  placeholder: boolean;
}

const BASE_TOOLS = ["Tape Measure", "Pencil", "Speed Square", "Drill/Driver", "T-25 Star Bit"];

/** "They stand upright, with their underside 7-3/8" off the floor" */
function whereText(pieces: ScenePiece[], part: PlanPart, low: number): string {
  const one = pieces.length === 1;
  const ways = new Set(pieces.map(orientationOf));
  const way = part.kind === "lumber" && ways.size === 1 ? [...ways][0] : null;
  const verb =
    way === "upright" ? (one ? "stands upright" : "stand upright")
    : way === "edge" ? (one ? "sits on edge" : "sit on edge")
    : way === "flat" ? (one ? "lies flat" : "lie flat")
    : one ? "goes" : "go";
  const height = low <= TOUCH ? " on the floor" : `${way ? "," : ""} with ${one ? "its" : "their"} underside ${formatInches(low)} off the floor`;
  return `${one ? "It" : "They"} ${verb}${height}`;
}

/** "2×4s", "Front legs", '3/4" Plywood Panels' */
function partNoun(part: PlanPart, count: number): string {
  if (part.kind === "sheet" && /plywood$/i.test(part.label)) return `${part.label} ${plural(count, "Panel")}`;
  return plural(count, part.label);
}

/**
 * Put the pieces in an order that can actually be built: start on the
 * floor, and only add a piece once something it touches is in place.
 * Identical pieces at the same height go on together, a group is finished
 * before the next is started where possible, casters wait for the frame
 * they mount to, and totes go in last.
 */
function orderClusters(pieces: ScenePiece[], parts: PlanPart[], touching: Map<string, Set<string>>): Cluster[] {
  const partOf = new Map<string, PlanPart>();
  for (const part of parts) for (const id of part.pieceIds) partOf.set(id, part);

  const clusters = new Map<string, Cluster>();
  for (const piece of pieces) {
    const part = partOf.get(piece.id);
    if (!part) continue;
    const low = pieceBounds(piece).min[1];
    const key = `${piece.groupId ?? ""}|${part.stock}|${part.length}|${part.width}|${Math.round(low * 2) / 2}`;
    const cluster = clusters.get(key);
    if (cluster) cluster.pieces.push(piece);
    else {
      clusters.set(key, {
        part,
        pieces: [piece],
        groupId: piece.groupId,
        low,
        placeholder: !!getStock(piece.stock)?.hardware?.placeholder,
      });
    }
  }

  const waiting = [...clusters.values()];
  const placed = new Set<string>();
  const ordered: Cluster[] = [];
  let lastGroup: string | null | undefined;

  const rank = (c: Cluster) =>
    // totes last · stay in the group being built · lowest first · frame before panels before hardware
    [c.placeholder ? 1 : 0, lastGroup !== undefined && c.groupId === lastGroup ? 0 : 1, c.low, KIND_ORDER[c.part.kind]];
  const before = (a: Cluster, b: Cluster) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return 0;
  };
  const isReady = (c: Cluster) => {
    const touchesPlaced = c.pieces.some((p) => [...(touching.get(p.id) ?? [])].some((id) => placed.has(id)));
    // Hardware mounts to the frame, so the frame comes first even though a caster is on the floor.
    if (c.part.kind === "hardware") return touchesPlaced;
    return touchesPlaced || c.low <= TOUCH;
  };

  while (waiting.length > 0) {
    const ready = waiting.filter(isReady);
    // Nothing connects yet (a frame that will sit on casters, a floating
    // piece): take the lowest piece of the frame, hardware only if that's
    // all there is.
    const frame = waiting.filter((c) => c.part.kind !== "hardware");
    const next = (ready.length > 0 ? ready : frame.length > 0 ? frame : waiting).sort(before)[0];
    waiting.splice(waiting.indexOf(next), 1);
    ordered.push(next);
    for (const p of next.pieces) placed.add(p.id);
    lastGroup = next.groupId;
  }
  return ordered;
}

function buildSteps(scene: Scene, parts: PlanPart[], joints: PlanJoint[], touching: Map<string, Set<string>>, needs: { rips: boolean; sheets: boolean }): PlanStep[] {
  const steps: Omit<PlanStep, "number">[] = [];

  const cutParts = parts.filter((p) => p.kind !== "hardware");
  if (cutParts.length > 0) {
    steps.push({
      id: "cut",
      title: "Cut Every Part",
      instruction:
        "Cut all of your parts before you start assembling, following the cut list board by board. " +
        "Write each part's letter on it in pencil as it comes off the saw. " +
        (needs.rips ? "Rip the narrow parts first, full length, then crosscut them. " : "") +
        "Measure every cut from the same end of the board and let the blade take its kerf from the waste side of the line.",
      pieceIds: [],
      parts: cutParts.map((p) => ({ letter: p.letter, label: p.label, qty: p.qty, size: p.size })),
      fasteners: [],
      tools: [
        "Tape Measure",
        "Pencil",
        "Speed Square",
        "Miter Saw",
        ...(needs.rips ? ["Table Saw"] : []),
        ...(needs.sheets ? ["Circular Saw"] : []),
        "Safety Glasses",
      ],
      tip: "Cut the longest parts first. If a cut goes wrong, the board can still become a shorter part.",
    });
  }

  const placed = new Set<string>();
  const groupName = new Map(scene.groups.map((g) => [g.id, g.name]));
  const clusters = orderClusters(scene.pieces, parts, touching);
  clusters.forEach((cluster, index) => {
    const ids = new Set(cluster.pieces.map((p) => p.id));
    // Joints made now: between these pieces, or to anything already built
    const made = joints.filter((j) => (ids.has(j.a) && (ids.has(j.b) || placed.has(j.b))) || (ids.has(j.b) && placed.has(j.a)));
    const fasteners = new Map<string, number>();
    for (const j of made) fasteners.set(j.fastener, (fasteners.get(j.fastener) ?? 0) + j.count);
    const n = cluster.pieces.length;
    const { part } = cluster;
    const name = part.letter ? `${part.label} (${part.letter})` : part.label;
    const inGroup = cluster.groupId ? groupName.get(cluster.groupId) : undefined;
    const where = whereText(cluster.pieces, part, cluster.low);
    const screwText = [...fasteners.entries()].map(([fastener, qty]) => `${qty} ${fastener.replace(/ Star-Drive| Wood/, "")}`).join(" and ");

    let title: string;
    let instruction: string;
    let tools = [...BASE_TOOLS];
    let tip: string | undefined;

    if (cluster.placeholder) {
      title = n === 1 ? "Slide In the Tote" : `Slide In the ${n} Totes`;
      instruction = `With everything fastened, put ${n === 1 ? "the tote" : `the ${n} totes`} in place and check ${n === 1 ? "it slides" : "they slide"} in and out freely.`;
      tools = [];
    } else if (part.kind === "hardware") {
      title = n === 1 ? `Mount the ${part.label}` : `Mount the ${n} ${part.label}s`;
      instruction =
        `Tip the build onto its back or side on a blanket or cardboard. Set ${n === 1 ? "the caster" : "each caster"} where shown, square to the frame, ` +
        `and fasten its plate with ${screwText || "the screws it came with"}. Stand the build back up and lock the casters before you carry on.`;
      tools = ["Drill/Driver", "Tape Measure", "Moving Blanket"];
      tip = "Get a helper to tip and stand anything taller than you can comfortably hold.";
    } else {
      const first = index === 0;
      title = `${first ? "Start With" : "Add"} ${n === 1 ? "the" : `the ${n}`} ${partNoun(part, n)} (${part.letter})`;
      const what = `${n === 1 ? "the" : `the ${n}`} ${part.size} ${plural(n, "piece")} marked ${part.letter}`;
      instruction =
        `Take ${what}${inGroup ? ` for ${inGroup}` : ""} and set ${n === 1 ? "it" : "them"} where the drawing shows. ${where}. ` +
        (made.length > 0
          ? `Check for square, then fasten ${n === 1 ? "it" : "each one"} to what it touches: ${screwText} in all (${made.length} ${plural(made.length, "joint")}).`
          : first
            ? "Nothing is fastened yet; the next step joins them."
            : "It doesn't touch anything built so far, so check its position against the dimensions before fastening it later.") +
        (made.some((j) => j.angled)
          ? " Where a screw can't go straight through the first piece into the next, start it about 1\" back from the joint and drive it at an angle (a toe-screw)."
          : "");
      if (part.kind === "sheet") tip = "Keep panel screws at least 3/4\" in from the edge so the plywood doesn't split.";
      else if (made.length > 0) tip = "Clamp the joint before driving the first screw; it keeps the pieces from creeping.";
      if (made.length > 0) tools.push("Clamps");
      if (cluster.low > 48) tools.push("Step Ladder");
    }

    steps.push({
      id: `step-${index + 1}`,
      title,
      instruction,
      pieceIds: cluster.pieces.map((p) => p.id),
      parts: [{ letter: part.letter, label: name, qty: n, size: part.size }],
      fasteners: [...fasteners.entries()].map(([fastenerName, qty]) => ({ name: fastenerName, qty })),
      tools,
      tip,
    });
    for (const p of cluster.pieces) placed.add(p.id);
  });

  return steps.map((s, i) => ({ ...s, number: i + 1 }));
}

// ═══════════════════════════════════════════════════════════════════════════
// The plan
// ═══════════════════════════════════════════════════════════════════════════

export function generateCustomPlan(scene: Scene): CustomPlan {
  const parts = buildParts(scene.pieces);
  const letterOf: Record<string, string> = {};
  for (const part of parts) for (const id of part.pieceIds) letterOf[id] = part.letter;

  const lumber = packLumber(parts);
  const boards = groupBoards(lumber.boards);
  const nested = packSheets(parts);
  const sheets: PlanSheet[] = nested.sheets.map((s) => ({
    stock: s.stock.id,
    label: s.stock.label,
    placements: s.placements,
    used: s.placements.reduce((sum, p) => sum + p.w * p.h, 0) / (longestStock(s.stock) * s.stock.width),
  }));

  const { joints, touching } = findJoints(scene.pieces);
  const hasRips = parts.some((p) => p.ripped);
  const steps = buildSteps(scene, parts, joints, touching, { rips: hasRips, sheets: sheets.length > 0 });

  // ── Offcuts worth keeping ──────────────────────────────────────────────
  const offcutCounts = new Map<string, number>();
  const keep = (description: string, qty: number) => offcutCounts.set(description, (offcutCounts.get(description) ?? 0) + qty);
  for (const board of boards) {
    for (const lane of board.lanes) {
      if (lane.offcut >= KEEP_OFFCUT) {
        const what = lane.width < 3.5 - 1e-6 ? `${formatInches(lane.width)} rip` : "2×4";
        keep(`${what}, ${formatInches(lane.offcut)} long`, board.count);
      }
    }
    if (board.spareWidth >= KEEP_STRIP) keep(`${formatInches(board.spareWidth)} strip, ${formatFeetInches(board.length)} long`, board.count);
  }
  for (const sheet of nested.sheets) {
    for (const rect of sheet.free) {
      if (Math.min(rect.w, rect.h) >= KEEP_OFFCUT) {
        keep(`${sheet.stock.label}, ${formatInches(round16(Math.min(rect.w, rect.h)))} × ${formatInches(round16(Math.max(rect.w, rect.h)))}`, 1);
      }
    }
  }
  const offcuts = [...offcutCounts.entries()].map(([description, qty]) => ({ description, qty }));

  // ── Shopping list ──────────────────────────────────────────────────────
  const shoppingList: PlanShoppingItem[] = [];
  const boardsByLength = new Map<number, number>();
  for (const board of boards) boardsByLength.set(board.length, (boardsByLength.get(board.length) ?? 0) + board.count);
  for (const [length, qty] of [...boardsByLength.entries()].sort((a, b) => a[0] - b[0])) {
    shoppingList.push({
      name: `2×4 × ${length / 12} ft`,
      detail: length === 96 ? "Studs. Pick straight ones: sight down the edge." : "Framing lumber. Pick straight boards.",
      qty,
    });
  }
  const sheetCounts = new Map<string, number>();
  for (const sheet of sheets) sheetCounts.set(sheet.label, (sheetCounts.get(sheet.label) ?? 0) + 1);
  for (const [label, qty] of sheetCounts) {
    shoppingList.push({ name: `${label}, 4 × 8 sheet`, detail: "Most stores will make a few straight cuts so it fits your car.", qty });
  }
  const hardwareParts = parts.filter((p) => p.kind === "hardware");
  for (const part of hardwareParts) {
    const info = getStock(part.stock)?.hardware;
    if (!info) continue;
    const packs = Math.ceil(part.qty / info.perPack);
    const spare = packs * info.perPack - part.qty;
    shoppingList.push({
      name: info.buyAs,
      detail: `${info.packNote}: ${part.qty} needed${spare > 0 ? ` (${spare} spare)` : ""}`,
      qty: packs,
    });
  }
  const screwTotals = new Map<string, number>();
  for (const joint of joints) screwTotals.set(joint.fastener, (screwTotals.get(joint.fastener) ?? 0) + joint.count);
  for (const [name, count] of screwTotals) {
    const withSpare = Math.ceil(count * SPARE);
    const perBox = BOX_COUNT[name] ?? 100;
    shoppingList.push({
      name,
      detail: `${withSpare} incl. 10% spare (${perBox}ct box)`,
      qty: `${Math.ceil(withSpare / perBox)} Box`,
    });
  }

  // ── Tools ──────────────────────────────────────────────────────────────
  const toolSet = new Set<string>();
  for (const step of steps) for (const tool of step.tools) toolSet.add(tool);
  if (toolSet.size > 0) toolSet.add("Level");
  const tools = [...toolSet].sort();

  // ── Warnings ───────────────────────────────────────────────────────────
  const warnings: string[] = [];
  for (const part of lumber.tooLong) {
    warnings.push(`Part ${part.letter} (${part.size}) is longer than a 12 ft board, the longest sold. Split it in the design; it is left off the cut list.`);
  }
  for (const part of nested.tooBig) {
    warnings.push(`Part ${part.letter} (${part.size}) is bigger than a 4 × 8 sheet. Split it in the design; it is left off the cut list.`);
  }
  const overlaps = findOverlaps(scene.pieces).length;
  if (overlaps > 0) {
    warnings.push(`${overlaps} ${plural(overlaps, "pair")} of pieces share the same space. The cut list is still right for what is drawn, but they can't be built that way.`);
  }
  const fastened = new Set(joints.flatMap((j) => [j.a, j.b]));
  const loose = scene.pieces.filter((p) => {
    const stock = getStock(p.stock);
    if (!stock || stock.hardware?.placeholder) return false;
    return !fastened.has(p.id) && scene.pieces.length > 1;
  });
  if (loose.length > 0) {
    warnings.push(
      `${loose.length} ${plural(loose.length, "piece isn't", "pieces aren't")} touching anything, so no screws are counted for ${plural(loose.length, "it", "them")}. Butt ${plural(loose.length, "it", "them")} against the frame in the design, or plan your own fastening.`,
    );
  }

  // ── Notes ──────────────────────────────────────────────────────────────
  const b = boundsOf(scene.pieces);
  const size = b ? [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]] : [0, 0, 0];
  const boardCount = boards.reduce((sum, board) => sum + board.count, 0);
  const notes = [
    'Lumber sizes are actual: a "2×4" measures 1-1/2" × 3-1/2". Every length in this plan is the finished length of the part.',
    `The cut list allows ${formatInches(SAW_KERF)} for each saw cut. If your blade is thicker, cut the long parts first and check as you go.`,
    "Joints are screwed butt joints. #9 star-drive construction screws need no pilot hole in 2×4 or plywood; drill one within 2\" of a board's end to stop it splitting.",
    "Fastener counts come from where pieces touch in the design, plus 10% spare.",
  ];
  if (hasRips) {
    notes.push("Ripped parts are cut full length on a table saw first, then crosscut. Use a push stick and keep the board against the fence.");
  }
  if (sheets.length > 0) {
    notes.push("Panel layouts use straight edge-to-edge cuts and may turn a part on the sheet. If the grain direction matters to you, check each panel before cutting.");
  }

  const safetyNotes = [
    "Always wear safety glasses when operating power tools.",
    "Wear hearing protection when using a miter saw or table saw.",
    "Keep fingers at least 6\" from saw blades at all times.",
    "Work on a flat, stable surface to keep assemblies square.",
    ...(hasRips ? ["Use a push stick when ripping narrow strips on the table saw."] : []),
    ...(size[1] > 60 ? ["Get a helper to stand or lift anything taller than 5 feet."] : []),
    ...(size[1] > 84 ? ["Anything taller than 7 feet must be fastened to wall studs so it can't tip."] : []),
  ];

  const sheetCount = sheets.length;
  const summaryParts = [
    `${scene.pieces.length} ${plural(scene.pieces.length, "piece")}`,
    ...(boardCount > 0 ? [`${boardCount} ${plural(boardCount, "board")}`] : []),
    ...(sheetCount > 0 ? [`${sheetCount} ${plural(sheetCount, "sheet")} of plywood`] : []),
    ...hardwareParts.filter((p) => !getStock(p.stock)?.hardware?.placeholder).map((p) => `${p.qty} ${plural(p.qty, "caster")}`),
  ];

  return {
    name: scene.name,
    summary: summaryParts.join(" · "),
    dimensions: { width: formatInches(size[0]), height: formatInches(size[1]), depth: formatInches(size[2]) },
    pieceCount: scene.pieces.length,
    parts,
    letterOf,
    boards,
    sheets,
    offcuts,
    joints,
    steps,
    shoppingList,
    tools,
    safetyNotes,
    notes,
    warnings,
  };
}
