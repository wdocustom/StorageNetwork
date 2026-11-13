"use client";

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — the editor hook
//
// Wraps the pure editor reducer (@/lib/builder/editor) for React: the 2D
// view, the 3D view, the library and the inspector all read this one state
// and send actions back, which keeps selection and edits in step between
// views.
//
// The work in progress is kept on this device (localStorage) and restored
// on the next visit. Undo history is for the current visit only.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useReducer, useRef } from "react";
import type { LibraryItem } from "@/lib/builder/catalog";
import {
  INITIAL_STATE,
  builderReducer,
  describeSelection,
  type BuilderState,
  type BuilderView,
  type SelectionInfo,
} from "@/lib/builder/editor";
import {
  findOverlaps,
  parseScene,
  serializeScene,
  type AlignMode,
  type Axis,
  type Orientation,
  type ScenePiece,
  type Vec3,
} from "@/lib/builder/scene";

export type { BuilderState, BuilderView, SelectionInfo };

/** Snap steps offered in the toolbar, inches. 0 = free. */
export const GRID_STEPS = [
  { value: 1, label: '1"' },
  { value: 0.5, label: '1/2"' },
  { value: 0.25, label: '1/4"' },
  { value: 0.125, label: '1/8"' },
  { value: 0, label: "Off" },
] as const;

/** Where the work in progress is kept on this device. */
const DRAFT_KEY = "sn_builder_draft_v1";
const DRAFT_SAVE_DELAY_MS = 400;

export interface BuilderActions {
  undo(): void;
  redo(): void;
  add(item: LibraryItem): void;
  select(ids: string[]): void;
  setView(view: BuilderView): void;
  setGridStep(step: number): void;
  setSnapToPieces(on: boolean): void;
  setShowDimensions(on: boolean): void;
  setMultiSelect(on: boolean): void;
  renameScene(name: string): void;
  renamePiece(id: string, name: string): void;
  renameGroup(id: string, name: string): void;
  resize(id: string, size: { length?: number; width?: number }): void;
  setStock(id: string, stock: string): void;
  /** Put a piece's left edge (x), underside (y) or back edge (z) at `value` inches */
  setEdge(id: string, axis: Axis, value: number): void;
  setOrientation(id: string, orientation: Orientation): void;
  setRotation(id: string, rotation: Vec3): void;
  /** Exact centers. Updates sharing a `gesture` key are one undo step (a drag). */
  setPositions(positions: Record<string, Vec3>, gesture?: string): void;
  nudge(delta: Vec3): void;
  rotate(axis: Axis, degrees: number): void;
  align(axis: Axis, mode: AlignMode): void;
  distribute(axis: Axis): void;
  mirror(axis: Axis): void;
  /** Cut a piece in two, `at` inches from its low end */
  split(id: string, along: "length" | "width", at: number): void;
  group(): void;
  ungroup(): void;
  dropToFloor(): void;
  duplicate(): void;
  copy(): void;
  cut(): void;
  paste(): void;
  deleteSelection(): void;
  clear(): void;
}

export interface Builder {
  state: BuilderState;
  /** Selected pieces, in scene order */
  selectedPieces: ScenePiece[];
  selectionInfo: SelectionInfo;
  /** Ids of pieces that share space with another piece */
  overlapping: Set<string>;
  /** For each overlapping piece, the pieces it overlaps */
  overlapsOf: Map<string, string[]>;
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
  actions: BuilderActions;
  /** False until the saved draft (if any) has been read, so nothing flashes empty */
  ready: boolean;
}

export function useBuilder(): Builder {
  const [state, dispatch] = useReducer(builderReducer, INITIAL_STATE);
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
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),
      add: (item) => dispatch({ type: "add", item }),
      select: (ids) => dispatch({ type: "select", ids }),
      setView: (view) => dispatch({ type: "setView", view }),
      setGridStep: (step) => dispatch({ type: "setGridStep", step }),
      setSnapToPieces: (on) => dispatch({ type: "setSnapToPieces", on }),
      setShowDimensions: (on) => dispatch({ type: "setShowDimensions", on }),
      setMultiSelect: (on) => dispatch({ type: "setMultiSelect", on }),
      renameScene: (name) => dispatch({ type: "renameScene", name }),
      renamePiece: (id, name) => dispatch({ type: "renamePiece", id, name }),
      renameGroup: (id, name) => dispatch({ type: "renameGroup", id, name }),
      resize: (id, size) => dispatch({ type: "resize", id, size }),
      setStock: (id, stock) => dispatch({ type: "setStock", id, stock }),
      setEdge: (id, axis, value) => dispatch({ type: "setEdge", id, axis, value }),
      setOrientation: (id, orientation) => dispatch({ type: "setOrientation", id, orientation }),
      setRotation: (id, rotation) => dispatch({ type: "setRotation", id, rotation }),
      setPositions: (positions, gesture) => dispatch({ type: "setPositions", positions, coalesce: gesture }),
      nudge: (delta) => dispatch({ type: "nudge", delta }),
      rotate: (axis, degrees) => dispatch({ type: "rotate", axis, degrees }),
      align: (axis, mode) => dispatch({ type: "align", axis, mode }),
      distribute: (axis) => dispatch({ type: "distribute", axis }),
      mirror: (axis) => dispatch({ type: "mirror", axis }),
      split: (id, along, at) => dispatch({ type: "split", id, along, at }),
      group: () => dispatch({ type: "group" }),
      ungroup: () => dispatch({ type: "ungroup" }),
      dropToFloor: () => dispatch({ type: "dropToFloor" }),
      duplicate: () => dispatch({ type: "duplicate" }),
      copy: () => dispatch({ type: "copy" }),
      cut: () => dispatch({ type: "cut" }),
      paste: () => dispatch({ type: "paste" }),
      deleteSelection: () => dispatch({ type: "delete" }),
      clear: () => dispatch({ type: "clear" }),
    }),
    [],
  );

  const selectedPieces = useMemo(() => {
    const wanted = new Set(state.selection);
    return state.scene.pieces.filter((p) => wanted.has(p.id));
  }, [state.scene, state.selection]);

  const selectionInfo = useMemo(() => describeSelection(state.scene, state.selection), [state.scene, state.selection]);

  const { overlapping, overlapsOf } = useMemo(() => {
    const of = new Map<string, string[]>();
    for (const [a, b] of findOverlaps(state.scene.pieces)) {
      of.set(a, [...(of.get(a) ?? []), b]);
      of.set(b, [...(of.get(b) ?? []), a]);
    }
    return { overlapping: new Set(of.keys()), overlapsOf: of };
  }, [state.scene.pieces]);

  return {
    state,
    selectedPieces,
    selectionInfo,
    overlapping,
    overlapsOf,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    canPaste: state.clipboard !== null,
    actions,
    ready,
  };
}
