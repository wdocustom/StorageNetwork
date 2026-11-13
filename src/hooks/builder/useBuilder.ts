"use client";

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — editor state
//
// One reducer holds everything the workspace shows: the scene (see
// @/lib/builder/scene), which pieces are selected, which view is up and the
// snap step. The 2D view, the 3D view, the library and the inspector all
// read this one value and send actions back, which is what keeps selection
// and edits in step between views.
//
// Every scene change goes through a pure edit from scene.ts, so the scene in
// state is always a complete, valid, serializable design.
//
// The work in progress is kept on this device (localStorage) and restored on
// the next visit.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useReducer, useRef } from "react";
import type { LibraryItem } from "@/lib/builder/catalog";
import {
  addFromLibrary,
  dropToFloor,
  duplicatePieces,
  emptyScene,
  parseScene,
  removePieces,
  renamePiece,
  renameScene,
  resizePiece,
  rotatePieces,
  serializeScene,
  setOrientation,
  setPieceEdge,
  setPieceStock,
  setPositions,
  setRotation,
  translatePieces,
  type Axis,
  type Orientation,
  type Scene,
  type ScenePiece,
  type Vec3,
} from "@/lib/builder/scene";

export type BuilderView = "2d" | "3d";

/** Snap steps offered in the toolbar, inches. 0 = free. */
export const GRID_STEPS = [
  { value: 1, label: '1"' },
  { value: 0.5, label: '1/2"' },
  { value: 0.25, label: '1/4"' },
  { value: 0.125, label: '1/8"' },
  { value: 0, label: "Free" },
] as const;

export interface BuilderState {
  scene: Scene;
  /** Selected piece ids, in the order they were picked */
  selection: string[];
  view: BuilderView;
  /** Moves snap to this many inches; 0 = no snapping */
  gridStep: number;
}

type Action =
  | { type: "load"; scene: Scene }
  | { type: "add"; item: LibraryItem }
  | { type: "select"; ids: string[] }
  | { type: "toggleSelect"; id: string }
  | { type: "setView"; view: BuilderView }
  | { type: "setGridStep"; step: number }
  | { type: "renameScene"; name: string }
  | { type: "renamePiece"; id: string; name: string }
  | { type: "resize"; id: string; size: { length?: number; width?: number } }
  | { type: "setStock"; id: string; stock: string }
  | { type: "setEdge"; id: string; axis: Axis; value: number }
  | { type: "setOrientation"; id: string; orientation: Orientation }
  | { type: "setRotation"; id: string; rotation: Vec3 }
  | { type: "setPositions"; positions: Record<string, Vec3> }
  | { type: "nudge"; delta: Vec3 }
  | { type: "rotate"; axis: Axis; degrees: number }
  | { type: "dropToFloor" }
  | { type: "duplicate" }
  | { type: "delete" }
  | { type: "clear" };

const INITIAL: BuilderState = { scene: emptyScene(), selection: [], view: "3d", gridStep: 0.5 };

function withScene(state: BuilderState, scene: Scene): BuilderState {
  return scene === state.scene ? state : { ...state, scene };
}

function reducer(state: BuilderState, action: Action): BuilderState {
  const { scene, selection } = state;
  switch (action.type) {
    case "load":
      return { ...state, scene: action.scene, selection: [] };
    case "add": {
      const added = addFromLibrary(scene, action.item);
      return added.id ? { ...state, scene: added.scene, selection: [added.id] } : state;
    }
    case "select": {
      const known = new Set(scene.pieces.map((p) => p.id));
      return { ...state, selection: action.ids.filter((id) => known.has(id)) };
    }
    case "toggleSelect":
      return {
        ...state,
        selection: selection.includes(action.id) ? selection.filter((id) => id !== action.id) : [...selection, action.id],
      };
    case "setView":
      return { ...state, view: action.view };
    case "setGridStep":
      return { ...state, gridStep: action.step };
    case "renameScene":
      return withScene(state, renameScene(scene, action.name));
    case "renamePiece":
      return withScene(state, renamePiece(scene, action.id, action.name));
    case "resize":
      return withScene(state, resizePiece(scene, action.id, action.size));
    case "setStock":
      return withScene(state, setPieceStock(scene, action.id, action.stock));
    case "setEdge":
      return withScene(state, setPieceEdge(scene, action.id, action.axis, action.value));
    case "setOrientation":
      return withScene(state, setOrientation(scene, action.id, action.orientation));
    case "setRotation":
      return withScene(state, setRotation(scene, action.id, action.rotation));
    case "setPositions":
      return withScene(state, setPositions(scene, action.positions));
    case "nudge":
      return withScene(state, translatePieces(scene, selection, action.delta));
    case "rotate":
      return withScene(state, rotatePieces(scene, selection, action.axis, action.degrees));
    case "dropToFloor":
      return withScene(state, dropToFloor(scene, selection));
    case "duplicate": {
      const copied = duplicatePieces(scene, selection);
      return copied.ids.length ? { ...state, scene: copied.scene, selection: copied.ids } : state;
    }
    case "delete":
      return selection.length ? { ...state, scene: removePieces(scene, selection), selection: [] } : state;
    case "clear":
      return { ...state, scene: emptyScene(scene.name), selection: [] };
  }
}

/** Where the work in progress is kept on this device. */
const DRAFT_KEY = "sn_builder_draft_v1";
const DRAFT_SAVE_DELAY_MS = 400;

export interface BuilderActions {
  add(item: LibraryItem): void;
  select(ids: string[]): void;
  toggleSelect(id: string): void;
  setView(view: BuilderView): void;
  setGridStep(step: number): void;
  renameScene(name: string): void;
  renamePiece(id: string, name: string): void;
  resize(id: string, size: { length?: number; width?: number }): void;
  setStock(id: string, stock: string): void;
  /** Put a piece's left edge (x), underside (y) or back edge (z) at `value` inches */
  setEdge(id: string, axis: Axis, value: number): void;
  setOrientation(id: string, orientation: Orientation): void;
  setRotation(id: string, rotation: Vec3): void;
  /** Exact centers, while dragging */
  setPositions(positions: Record<string, Vec3>): void;
  nudge(delta: Vec3): void;
  rotate(axis: Axis, degrees: number): void;
  dropToFloor(): void;
  duplicate(): void;
  deleteSelection(): void;
  clear(): void;
}

export interface Builder {
  state: BuilderState;
  /** Selected pieces, in scene order */
  selectedPieces: ScenePiece[];
  actions: BuilderActions;
  /** False until the saved draft (if any) has been read, so nothing flashes empty */
  ready: boolean;
}

export function useBuilder(): Builder {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const restored = useRef(false);
  const [ready, markReady] = useReducer(() => true, false);

  // Restore the draft once, on the client.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const draft = parseScene(localStorage.getItem(DRAFT_KEY));
      if (draft) dispatch({ type: "load", scene: draft });
    } catch {
      /* storage unavailable: start empty */
    }
    markReady();
  }, []);

  // Save shortly after the last change (a drag sends many).
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, serializeScene(state.scene));
      } catch {
        /* storage full or unavailable: the design still works for this visit */
      }
    }, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state.scene, ready]);

  const actions = useMemo<BuilderActions>(
    () => ({
      add: (item) => dispatch({ type: "add", item }),
      select: (ids) => dispatch({ type: "select", ids }),
      toggleSelect: (id) => dispatch({ type: "toggleSelect", id }),
      setView: (view) => dispatch({ type: "setView", view }),
      setGridStep: (step) => dispatch({ type: "setGridStep", step }),
      renameScene: (name) => dispatch({ type: "renameScene", name }),
      renamePiece: (id, name) => dispatch({ type: "renamePiece", id, name }),
      resize: (id, size) => dispatch({ type: "resize", id, size }),
      setStock: (id, stock) => dispatch({ type: "setStock", id, stock }),
      setEdge: (id, axis, value) => dispatch({ type: "setEdge", id, axis, value }),
      setOrientation: (id, orientation) => dispatch({ type: "setOrientation", id, orientation }),
      setRotation: (id, rotation) => dispatch({ type: "setRotation", id, rotation }),
      setPositions: (positions) => dispatch({ type: "setPositions", positions }),
      nudge: (delta) => dispatch({ type: "nudge", delta }),
      rotate: (axis, degrees) => dispatch({ type: "rotate", axis, degrees }),
      dropToFloor: () => dispatch({ type: "dropToFloor" }),
      duplicate: () => dispatch({ type: "duplicate" }),
      deleteSelection: () => dispatch({ type: "delete" }),
      clear: () => dispatch({ type: "clear" }),
    }),
    [],
  );

  const selectedPieces = useMemo(() => {
    const wanted = new Set(state.selection);
    return state.scene.pieces.filter((p) => wanted.has(p.id));
  }, [state.scene, state.selection]);

  return { state, selectedPieces, actions, ready };
}
