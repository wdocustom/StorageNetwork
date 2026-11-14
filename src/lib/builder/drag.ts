// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — dragging and snapping (shared by the 2D and 3D views)
//
// A drag remembers where every dragged piece started and, on each pointer
// move, places them all at start + movement. Working from the start (not
// from the last frame) means rounding never accumulates.
//
// On each axis being moved, the movement snaps to the first of these that
// applies:
//   1. ANOTHER PIECE — when an edge or the middle of what's being dragged
//      comes within `tolerance` of an edge or the middle of a piece that
//      isn't. Edge to opposite edge butts two pieces together; edge to same
//      edge makes them flush; middle to middle centers one on the other.
//      Each such snap comes with a GUIDE line the view draws, so it is
//      clear what lined up with what.
//   2. THE GRID — the grabbed piece's low corner lands on the grid step.
// Everything dragged moves by the same amount, so an assembly keeps its
// shape.
//
// Client-safe: no three.js.
// ═══════════════════════════════════════════════════════════════════════════

import { boundsOf, pieceBounds, type Bounds, type ScenePiece, type Vec3 } from "@/lib/builder/scene";
import { snapTo } from "@/lib/builder/units";

export interface DragStart {
  /** Center of every dragged piece when the drag began */
  positions: Record<string, Vec3>;
  /** Low corner of the piece under the pointer, which is what snaps to the grid */
  anchor: Vec3;
  /** Box around everything dragged, which is what snaps to other pieces */
  bounds: Bounds;
}

export interface SnapOptions {
  /** Grid step in inches; 0 = no grid */
  gridStep: number;
  /** Boxes of the pieces NOT being dragged; empty = don't snap to pieces */
  targets: Bounds[];
  /** How close (inches) an edge must come to another to snap */
  tolerance: number;
}

/** A line showing what a piece snap lined up: endpoints in scene inches. */
export interface SnapGuide {
  axis: 0 | 1 | 2;
  from: Vec3;
  to: Vec3;
}

export interface DragResult {
  positions: Record<string, Vec3>;
  guides: SnapGuide[];
}

export function beginDrag(pieces: ScenePiece[], grabbedId: string): DragStart {
  const grabbed = pieces.find((p) => p.id === grabbedId) ?? pieces[0];
  return {
    positions: Object.fromEntries(pieces.map((p) => [p.id, [...p.position] as Vec3])),
    anchor: pieceBounds(grabbed).min,
    bounds: boundsOf(pieces) as Bounds,
  };
}

/** Boxes of every piece that isn't part of the drag. */
export function snapTargets(pieces: ScenePiece[], draggedIds: Iterable<string>): Bounds[] {
  const dragged = new Set(draggedIds);
  return pieces.filter((p) => !dragged.has(p.id)).map(pieceBounds);
}

interface PieceSnap {
  /** How far to move further along the axis to land the snap */
  correction: number;
  target: Bounds;
}

/** The closest edge/middle alignment on axis `i` for a box that has moved by `delta`. */
function nearestPieceSnap(start: Bounds, delta: number, i: number, options: SnapOptions): PieceSnap | null {
  const min = start.min[i] + delta;
  const max = start.max[i] + delta;
  const mid = (min + max) / 2;
  let best: PieceSnap | null = null;
  const offer = (from: number, to: number, target: Bounds) => {
    const correction = to - from;
    if (Math.abs(correction) <= options.tolerance && (!best || Math.abs(correction) < Math.abs(best.correction))) {
      best = { correction, target };
    }
  };
  for (const t of options.targets) {
    offer(min, t.max[i], t); // butt against its far side
    offer(min, t.min[i], t); // flush
    offer(max, t.min[i], t); // butt against its near side
    offer(max, t.max[i], t); // flush
    offer(mid, (t.min[i] + t.max[i]) / 2, t); // centered
  }
  return best;
}

/** Where every dragged piece goes after the pointer has moved `delta` inches, and what it snapped to. */
export function dragPositions(start: DragStart, delta: Vec3, options: SnapOptions): DragResult {
  const moved: Vec3 = [0, 0, 0];
  const snaps: (PieceSnap | null)[] = [null, null, null];
  for (let i = 0; i < 3; i++) {
    if (delta[i] === 0) continue;
    const snap = nearestPieceSnap(start.bounds, delta[i], i, options);
    snaps[i] = snap;
    moved[i] = snap ? delta[i] + snap.correction : snapTo(start.anchor[i] + delta[i], options.gridStep) - start.anchor[i];
  }

  const positions = Object.fromEntries(
    Object.entries(start.positions).map(([id, p]) => [id, [p[0] + moved[0], p[1] + moved[1], p[2] + moved[2]] as Vec3]),
  );

  // Guides are drawn across both boxes, at the dragged box's final place.
  const box: Bounds = {
    min: [start.bounds.min[0] + moved[0], start.bounds.min[1] + moved[1], start.bounds.min[2] + moved[2]],
    max: [start.bounds.max[0] + moved[0], start.bounds.max[1] + moved[1], start.bounds.max[2] + moved[2]],
  };
  const guides: SnapGuide[] = [];
  snaps.forEach((snap, index) => {
    if (!snap) return;
    const i = index as 0 | 1 | 2;
    // The coordinate that lined up: whichever dragged edge/middle now equals one of the target's
    const mine = [box.min[i], box.max[i], (box.min[i] + box.max[i]) / 2];
    const theirs = [snap.target.min[i], snap.target.max[i], (snap.target.min[i] + snap.target.max[i]) / 2];
    const value = mine.find((m) => theirs.some((t) => Math.abs(m - t) < 1e-6)) ?? mine[0];
    // Run the line along the other level axis (x ↔ z); a height snap runs along x.
    const run = i === 0 ? 2 : 0;
    const from: Vec3 = [(box.min[0] + box.max[0]) / 2, box.min[1], (box.min[2] + box.max[2]) / 2];
    const to: Vec3 = [...from];
    from[i] = value;
    to[i] = value;
    from[run] = Math.min(box.min[run], snap.target.min[run]);
    to[run] = Math.max(box.max[run], snap.target.max[run]);
    guides.push({ axis: i, from, to });
  });

  return { positions, guides };
}
