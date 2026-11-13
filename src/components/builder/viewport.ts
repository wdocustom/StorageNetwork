// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — what the 2D and 3D views have in common
//
// Both views get the same props and follow the same rules for picking and
// dragging, so a click or a drag means the same thing in either.
// ═══════════════════════════════════════════════════════════════════════════

import type { MutableRefObject } from "react";
import { boundsOf, pickSelection, type Bounds, type Scene, type ScenePiece, type Vec3 } from "@/lib/builder/scene";

export interface ViewportProps {
  scene: Scene;
  selection: string[];
  /** Grid step, inches; 0 = off */
  gridStep: number;
  snapToPieces: boolean;
  showDimensions: boolean;
  /** Clicks add to the selection without Shift */
  multiSelect: boolean;
  /** Pieces that share space with another piece */
  overlapping: Set<string>;
  onSelect: (ids: string[]) => void;
  /** Updates sharing a `gesture` key are one undo step */
  onMove: (positions: Record<string, Vec3>, gesture: string) => void;
  /** Change this number to re-frame the view on the whole build */
  frameRequest: number;
  /** Floor point (inches) both views look at, so switching views keeps your place */
  focus: MutableRefObject<{ x: number; z: number } | null>;
}

export const COLORS = {
  select: "#facc15",
  overlap: "#ef4444",
  guide: "#ec4899",
  dimension: "#0f172a",
} as const;

/** Pointer travel (px) before a press becomes a drag */
export const DRAG_THRESHOLD_PX = 4;
/** How near (px on screen) an edge must come to another piece's to snap */
export const SNAP_REACH_PX = 9;

let gestureCount = 0;
/** A key for one drag, so all of its moves undo together. */
export function newGesture(): string {
  gestureCount += 1;
  return `drag-${gestureCount}`;
}

export interface Press {
  /** The selection after this press */
  selection: string[];
  /** Pieces to drag if the pointer moves; empty when the press only changes the selection */
  drag: ScenePiece[];
}

/**
 * What pressing on a piece does.
 *   plain press        select the piece (with its group); drag moves it, or
 *                      the whole selection if the piece was already in it
 *   Shift / multi      add it to, or take it out of, the selection; no drag
 *   Ctrl / ⌘           reach one piece inside a group
 */
export function pressPiece(
  scene: Scene,
  selection: string[],
  id: string,
  keys: { additive: boolean; deep: boolean },
): Press {
  if (keys.additive) return { selection: pickSelection(scene, selection, id, keys), drag: [] };
  const keep = !keys.deep && selection.includes(id);
  const next = keep ? selection : pickSelection(scene, selection, id, keys);
  const wanted = new Set(next);
  return { selection: next, drag: scene.pieces.filter((p) => wanted.has(p.id)) };
}

/** The box dimension lines are drawn around: the selection, or the whole build. */
export function dimensionBox(scene: Scene, selection: string[]): Bounds | null {
  if (selection.length === 0) return boundsOf(scene.pieces);
  const wanted = new Set(selection);
  return boundsOf(scene.pieces.filter((p) => wanted.has(p.id)));
}
