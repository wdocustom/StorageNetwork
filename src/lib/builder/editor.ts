// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — editor state and its reducer
//
// Everything the workspace shows is one value: the scene, the selection,
// the undo history, the clipboard and the view settings. This file is the
// only place that value changes. It is pure (no React, no browser), so the
// rules below are unit-tested.
//
// UNDO / REDO
//   • Every change to the scene pushes the scene before it onto `past`
//     (the last HISTORY_LIMIT are kept) and clears `future`.
//   • A change may carry a `coalesce` key. Consecutive changes with the
//     same key are one undo step: a drag sends dozens of position updates
//     under one key and undoes in one go.
//   • Selection, view and snap settings are not undoable. After an undo or
//     redo the selection keeps only pieces that still exist.
//
// Scenes are immutable, so a history entry is a reference to an old scene,
// not a copy.
//
// Client-safe: no server imports.
// ═══════════════════════════════════════════════════════════════════════════

import type { LibraryItem } from "@/lib/builder/catalog";
import {
  addFromLibrary,
  alignPieces,
  boundsOf,
  distributePieces,
  dropToFloor,
  duplicatePieces,
  emptyScene,
  groupPieces,
  insertCopies,
  mirrorPieces,
  removePieces,
  renameGroup,
  renamePiece,
  renameScene,
  replacePieces,
  resizePiece,
  rotatePieces,
  setOrientation,
  setPieceEdge,
  setPieceStock,
  setPositions,
  setRotation,
  splitPiece,
  translatePieces,
  ungroupPieces,
  type AlignMode,
  type Axis,
  type Orientation,
  type Scene,
  type SceneGroup,
  type ScenePiece,
  type Vec3,
} from "@/lib/builder/scene";

export type BuilderView = "2d" | "3d";

export const HISTORY_LIMIT = 100;

/** How far each paste lands from the one before, inches. */
const PASTE_STEP = 6;

export interface Clipboard {
  pieces: ScenePiece[];
  groups: SceneGroup[];
  /** How many times this clipboard has been pasted (each paste steps further away) */
  pastes: number;
}

export interface BuilderState {
  scene: Scene;
  /** Selected piece ids, in the order they were picked */
  selection: string[];
  past: Scene[];
  future: Scene[];
  /** Key of the last change, if it can absorb further changes with the same key */
  coalesce: string | null;
  clipboard: Clipboard | null;
  view: BuilderView;
  /** Moves snap to this many inches; 0 = no grid */
  gridStep: number;
  /** Dragged pieces snap to the edges and middles of other pieces */
  snapToPieces: boolean;
  /** Show dimension lines and size labels */
  showDimensions: boolean;
  /** Clicks add to the selection without Shift (for touch) */
  multiSelect: boolean;
}

export type BuilderAction =
  | { type: "load"; scene: Scene }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "add"; item: LibraryItem }
  | { type: "select"; ids: string[] }
  | { type: "setView"; view: BuilderView }
  | { type: "setGridStep"; step: number }
  | { type: "setSnapToPieces"; on: boolean }
  | { type: "setShowDimensions"; on: boolean }
  | { type: "setMultiSelect"; on: boolean }
  | { type: "renameScene"; name: string }
  | { type: "renamePiece"; id: string; name: string }
  | { type: "renameGroup"; id: string; name: string }
  | { type: "resize"; id: string; size: { length?: number; width?: number } }
  | { type: "setStock"; id: string; stock: string }
  | { type: "setEdge"; id: string; axis: Axis; value: number }
  | { type: "setOrientation"; id: string; orientation: Orientation }
  | { type: "setRotation"; id: string; rotation: Vec3 }
  | { type: "setPositions"; positions: Record<string, Vec3>; coalesce?: string }
  | { type: "replacePieces"; pieces: ScenePiece[]; coalesce?: string }
  | { type: "nudge"; delta: Vec3 }
  | { type: "rotate"; axis: Axis; degrees: number }
  | { type: "align"; axis: Axis; mode: AlignMode }
  | { type: "distribute"; axis: Axis }
  | { type: "mirror"; axis: Axis }
  | { type: "split"; id: string; along: "length" | "width"; at: number }
  | { type: "group" }
  | { type: "ungroup" }
  | { type: "dropToFloor" }
  | { type: "duplicate" }
  | { type: "copy" }
  | { type: "cut" }
  | { type: "paste" }
  | { type: "delete" }
  | { type: "clear" };

export const INITIAL_STATE: BuilderState = {
  scene: emptyScene(),
  selection: [],
  past: [],
  future: [],
  coalesce: null,
  clipboard: null,
  view: "3d",
  gridStep: 0.5,
  snapToPieces: true,
  showDimensions: true,
  multiSelect: false,
};

/** Record a scene change as an undo step (or fold it into the previous one). */
function commit(state: BuilderState, scene: Scene, extra: Partial<BuilderState> = {}, coalesce: string | null = null): BuilderState {
  if (scene === state.scene) return Object.keys(extra).length ? { ...state, ...extra } : state;
  const folds = coalesce !== null && coalesce === state.coalesce;
  return {
    ...state,
    ...extra,
    scene,
    past: folds ? state.past : [...state.past, state.scene].slice(-HISTORY_LIMIT),
    future: [],
    coalesce,
  };
}

function existing(scene: Scene, ids: string[]): string[] {
  const known = new Set(scene.pieces.map((p) => p.id));
  return ids.filter((id) => known.has(id));
}

function copySelection(state: BuilderState): Clipboard | null {
  const wanted = new Set(state.selection);
  const pieces = state.scene.pieces.filter((p) => wanted.has(p.id));
  if (pieces.length === 0) return null;
  const used = new Set(pieces.map((p) => p.groupId));
  return { pieces, groups: state.scene.groups.filter((g) => used.has(g.id)), pastes: 0 };
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  const { scene, selection } = state;
  switch (action.type) {
    case "load":
      return { ...state, scene: action.scene, selection: [], past: [], future: [], coalesce: null };

    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        scene: previous,
        past: state.past.slice(0, -1),
        future: [scene, ...state.future],
        selection: existing(previous, selection),
        coalesce: null,
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const [next, ...future] = state.future;
      return {
        ...state,
        scene: next,
        past: [...state.past, scene],
        future,
        selection: existing(next, selection),
        coalesce: null,
      };
    }

    case "add": {
      const added = addFromLibrary(scene, action.item);
      return added.id ? commit(state, added.scene, { selection: [added.id] }) : state;
    }
    case "select":
      return { ...state, selection: existing(scene, action.ids) };
    case "setView":
      return { ...state, view: action.view };
    case "setGridStep":
      return { ...state, gridStep: action.step };
    case "setSnapToPieces":
      return { ...state, snapToPieces: action.on };
    case "setShowDimensions":
      return { ...state, showDimensions: action.on };
    case "setMultiSelect":
      return { ...state, multiSelect: action.on };

    case "renameScene":
      return commit(state, renameScene(scene, action.name));
    case "renamePiece":
      return commit(state, renamePiece(scene, action.id, action.name));
    case "renameGroup":
      return commit(state, renameGroup(scene, action.id, action.name));
    case "resize":
      return commit(state, resizePiece(scene, action.id, action.size));
    case "setStock":
      return commit(state, setPieceStock(scene, action.id, action.stock));
    case "setEdge":
      return commit(state, setPieceEdge(scene, action.id, action.axis, action.value));
    case "setOrientation":
      return commit(state, setOrientation(scene, action.id, action.orientation));
    case "setRotation":
      return commit(state, setRotation(scene, action.id, action.rotation));
    case "setPositions":
      return commit(state, setPositions(scene, action.positions), {}, action.coalesce ?? null);
    case "replacePieces":
      return commit(state, replacePieces(scene, action.pieces), {}, action.coalesce ?? null);
    case "nudge":
      return commit(state, translatePieces(scene, selection, action.delta));
    case "rotate":
      return commit(state, rotatePieces(scene, selection, action.axis, action.degrees));
    case "align":
      return commit(state, alignPieces(scene, selection, action.axis, action.mode));
    case "distribute":
      return commit(state, distributePieces(scene, selection, action.axis));
    case "mirror":
      return commit(state, mirrorPieces(scene, selection, action.axis));
    case "dropToFloor":
      return commit(state, dropToFloor(scene, selection));

    case "split": {
      const cut = splitPiece(scene, action.id, action.along, action.at);
      return cut.ids ? commit(state, cut.scene, { selection: [cut.ids[0]] }) : state;
    }
    case "group":
      return commit(state, groupPieces(scene, selection).scene);
    case "ungroup":
      return commit(state, ungroupPieces(scene, selection));

    case "duplicate": {
      const copied = duplicatePieces(scene, selection);
      return copied.ids.length ? commit(state, copied.scene, { selection: copied.ids }) : state;
    }
    case "copy": {
      const clipboard = copySelection(state);
      return clipboard ? { ...state, clipboard } : state;
    }
    case "cut": {
      const clipboard = copySelection(state);
      if (!clipboard) return state;
      // A cut piece pastes back exactly where it was the first time.
      return commit(state, removePieces(scene, selection), { selection: [], clipboard: { ...clipboard, pastes: -1 } });
    }
    case "paste": {
      const clip = state.clipboard;
      if (!clip) return state;
      const step = (clip.pastes + 1) * PASTE_STEP;
      const pasted = insertCopies(scene, clip.pieces, clip.groups, [step, 0, step]);
      if (pasted.ids.length === 0) return state;
      return commit(state, pasted.scene, { selection: pasted.ids, clipboard: { ...clip, pastes: clip.pastes + 1 } });
    }
    case "delete":
      return selection.length ? commit(state, removePieces(scene, selection), { selection: [] }) : state;
    case "clear":
      return scene.pieces.length ? commit(state, emptyScene(scene.name), { selection: [] }) : state;
  }
}

// ── Things the workspace asks about the state ────────────────────────────

/** What the selection is, for deciding which tools to offer. */
export interface SelectionInfo {
  count: number;
  /** Units that move on their own: groups count once */
  unitCount: number;
  /** The one group that is exactly the selection, if it is one */
  group: SceneGroup | null;
  /** Any selected piece is in a group */
  hasGroup: boolean;
  /** Overall size of the selection (x, y, z), inches */
  size: Vec3 | null;
}

export function describeSelection(scene: Scene, selection: string[]): SelectionInfo {
  const wanted = new Set(selection);
  const pieces = scene.pieces.filter((p) => wanted.has(p.id));
  const units = new Set(pieces.map((p) => p.groupId ?? p.id));
  const groupIds = new Set(pieces.map((p) => p.groupId));
  let group: SceneGroup | null = null;
  if (pieces.length > 1 && groupIds.size === 1) {
    const [only] = [...groupIds];
    const members = only ? scene.pieces.filter((p) => p.groupId === only).length : 0;
    if (only && members === pieces.length) group = scene.groups.find((g) => g.id === only) ?? null;
  }
  const b = boundsOf(pieces);
  return {
    count: pieces.length,
    unitCount: units.size,
    group,
    hasGroup: pieces.some((p) => p.groupId !== null),
    size: b ? [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]] : null,
  };
}
