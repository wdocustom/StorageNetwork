// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — dragging pieces (shared by the 2D and 3D views)
//
// A drag remembers where every dragged piece started and, on each pointer
// move, places them all at start + movement. Working from the start (not
// from the last frame) means rounding never accumulates and a drag can be
// cancelled by putting everything back.
//
// Snapping lands the grabbed piece's low corner (left / underside / back) on
// the grid, and the rest of the selection moves by the same amount so an
// assembly keeps its shape.
//
// Client-safe: no three.js.
// ═══════════════════════════════════════════════════════════════════════════

import { pieceBounds, type ScenePiece, type Vec3 } from "@/lib/builder/scene";
import { snapTo } from "@/lib/builder/units";

export interface DragStart {
  /** Center of every dragged piece when the drag began */
  positions: Record<string, Vec3>;
  /** Low corner of the piece under the pointer, which is what snaps */
  anchor: Vec3;
}

export function beginDrag(pieces: ScenePiece[], grabbedId: string): DragStart {
  const grabbed = pieces.find((p) => p.id === grabbedId) ?? pieces[0];
  return {
    positions: Object.fromEntries(pieces.map((p) => [p.id, [...p.position] as Vec3])),
    anchor: pieceBounds(grabbed).min,
  };
}

/** Where every dragged piece goes after the pointer has moved `delta` inches. */
export function dragPositions(start: DragStart, delta: Vec3, gridStep: number): Record<string, Vec3> {
  const snapped = delta.map((d, i) => (d === 0 ? 0 : snapTo(start.anchor[i] + d, gridStep) - start.anchor[i])) as Vec3;
  return Object.fromEntries(
    Object.entries(start.positions).map(([id, p]) => [id, [p[0] + snapped[0], p[1] + snapped[1], p[2] + snapped[2]] as Vec3]),
  );
}
