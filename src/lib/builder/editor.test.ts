import { describe, expect, it } from "vitest";
import { LIBRARY_ITEMS, type LibraryItem } from "@/lib/builder/catalog";
import {
  HISTORY_LIMIT,
  INITIAL_STATE,
  builderReducer,
  describeSelection,
  type BuilderAction,
  type BuilderState,
} from "@/lib/builder/editor";

const item = (id: string): LibraryItem => LIBRARY_ITEMS.find((i) => i.id === id) as LibraryItem;
const run = (state: BuilderState, ...actions: BuilderAction[]) => actions.reduce(builderReducer, state);
const leg: BuilderAction = { type: "add", item: item("2x4-leg") };

describe("undo and redo", () => {
  it("steps back and forward through scene changes", () => {
    const two = run(INITIAL_STATE, leg, leg);
    expect(two.scene.pieces).toHaveLength(2);
    const one = run(two, { type: "undo" });
    expect(one.scene.pieces).toHaveLength(1);
    expect(one.selection).toEqual([]); // the selected piece no longer exists
    const none = run(one, { type: "undo" });
    expect(none.scene.pieces).toHaveLength(0);
    expect(run(none, { type: "undo" })).toBe(none);
    const again = run(none, { type: "redo" }, { type: "redo" });
    expect(again.scene).toBe(two.scene);
    expect(run(again, { type: "redo" })).toBe(again);
  });

  it("drops the redo stack when something new is done", () => {
    const state = run(INITIAL_STATE, leg, leg, { type: "undo" }, { type: "add", item: item("ply12-shelf") });
    expect(state.future).toEqual([]);
    expect(state.scene.pieces.map((p) => p.stock)).toEqual(["2x4", "ply-1/2"]);
  });

  it("treats a whole drag as one step", () => {
    const start = run(INITIAL_STATE, leg);
    const id = start.scene.pieces[0].id;
    const dragged = run(
      start,
      { type: "setPositions", positions: { [id]: [1, 0.75, 0] }, coalesce: "drag-1" },
      { type: "setPositions", positions: { [id]: [2, 0.75, 0] }, coalesce: "drag-1" },
      { type: "setPositions", positions: { [id]: [3, 0.75, 0] }, coalesce: "drag-1" },
    );
    expect(dragged.past).toHaveLength(start.past.length + 1);
    expect(run(dragged, { type: "undo" }).scene).toBe(start.scene);
    // A second drag is its own step
    const second = run(dragged, { type: "setPositions", positions: { [id]: [9, 0.75, 0] }, coalesce: "drag-2" });
    expect(second.past).toHaveLength(dragged.past.length + 1);
  });

  it("doesn't record selection, view or no-op changes", () => {
    const start = run(INITIAL_STATE, leg);
    const same = run(
      start,
      { type: "select", ids: [] },
      { type: "setView", view: "2d" },
      { type: "setGridStep", step: 1 },
      { type: "dropToFloor" },
      { type: "distribute", axis: "x" },
      { type: "delete" },
    );
    expect(same.past).toHaveLength(start.past.length);
    expect(same.scene).toBe(start.scene);
  });

  it(`keeps the last ${HISTORY_LIMIT} steps`, () => {
    let state = run(INITIAL_STATE, leg);
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) state = run(state, { type: "nudge", delta: [1, 0, 0] });
    expect(state.past).toHaveLength(HISTORY_LIMIT);
  });

  it("forgets history when a design is loaded", () => {
    const state = run(INITIAL_STATE, leg, leg);
    const loaded = run(state, { type: "load", scene: state.scene });
    expect(loaded.past).toEqual([]);
    expect(loaded.selection).toEqual([]);
  });
});

describe("clipboard", () => {
  it("pastes copies further away each time", () => {
    const start = run(INITIAL_STATE, leg, { type: "copy" });
    const once = run(start, { type: "paste" });
    const twice = run(once, { type: "paste" });
    const xs = twice.scene.pieces.map((p) => p.position[0]);
    expect(xs[1] - xs[0]).toBe(6);
    expect(xs[2] - xs[0]).toBe(12);
    expect(twice.selection).toEqual([twice.scene.pieces[2].id]);
  });

  it("cut then paste puts the piece back where it was", () => {
    const start = run(INITIAL_STATE, leg);
    const cut = run(start, { type: "cut" });
    expect(cut.scene.pieces).toHaveLength(0);
    const back = run(cut, { type: "paste" });
    expect(back.scene.pieces[0].position).toEqual(start.scene.pieces[0].position);
    expect(back.scene.pieces[0].id).not.toBe(start.scene.pieces[0].id);
  });

  it("does nothing with an empty clipboard or selection", () => {
    expect(run(INITIAL_STATE, { type: "paste" })).toBe(INITIAL_STATE);
    expect(run(INITIAL_STATE, { type: "copy" })).toBe(INITIAL_STATE);
  });
});

describe("selection", () => {
  it("knows when the selection is exactly one group", () => {
    let state = run(INITIAL_STATE, leg, leg, leg);
    const ids = state.scene.pieces.map((p) => p.id);
    state = run(state, { type: "select", ids: [ids[0], ids[1]] }, { type: "group" });
    const info = describeSelection(state.scene, [ids[0], ids[1]]);
    expect(info.group?.name).toBe("Group 1");
    expect(info.unitCount).toBe(1);
    expect(describeSelection(state.scene, [ids[0]]).group).toBeNull();
    expect(describeSelection(state.scene, ids).group).toBeNull();
    expect(describeSelection(state.scene, ids).unitCount).toBe(2);
    expect(run(state, { type: "ungroup" }).scene.groups).toEqual([]);
  });

  it("selects the first part after a cut in two", () => {
    const start = run(INITIAL_STATE, { type: "add", item: item("2x4-8") });
    const cut = run(start, { type: "split", id: start.scene.pieces[0].id, along: "length", at: 30 });
    expect(cut.scene.pieces).toHaveLength(2);
    expect(cut.selection).toEqual([cut.scene.pieces[0].id]);
    expect(run(cut, { type: "undo" }).scene).toBe(start.scene);
  });
});
