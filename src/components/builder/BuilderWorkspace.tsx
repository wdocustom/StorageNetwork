"use client";

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — the workspace
//
// Desktop / tablet landscape:
//   ┌ toolbar: name · 2D/3D · snap · frame ──────────────────────────────┐
//   │ library │              2D or 3D view              │   inspector   │
//   └─────────┴─────────────────────────────────────────┴───────────────┘
// Phone / tablet portrait: the view fills the screen; the library and the
// inspector open as bottom sheets from a two-button bar, and a selected
// piece gets a quick turn / copy / delete strip above it.
//
// All state lives in useBuilder; both views get the same scene and
// selection, so picking or moving a piece in one shows in the other.
//
// Keyboard (when not typing in a field):
//   Del / Backspace  delete          R / Shift+R   quarter turn
//   Ctrl/⌘ D         duplicate       Ctrl/⌘ A      select all
//   Arrows           nudge one snap step (Shift = 10×)
//   PgUp / PgDn      raise / lower   Esc           clear selection
//   2 / 3            plan / 3D view  F             frame the build
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { Box, Copy, Eraser, Loader2, Maximize, PencilRuler, Plus, RotateCw, SlidersHorizontal, Trash2, X } from "lucide-react";
import BuilderInspector from "@/components/builder/BuilderInspector";
import BuilderLibrary from "@/components/builder/BuilderLibrary";
import BuilderViewport2D, { type PlanCamera } from "@/components/builder/BuilderViewport2D";
import type { CameraMemory } from "@/components/builder/BuilderViewport3D";
import { GRID_STEPS, useBuilder, type BuilderView } from "@/hooks/builder/useBuilder";
import type { LibraryItem } from "@/lib/builder/catalog";
import { SCENE_LIMITS, pieceLabel } from "@/lib/builder/scene";

const ViewLoading = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
    <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
  </div>
);

const BuilderViewport3D = dynamic(() => import("@/components/builder/BuilderViewport3D"), {
  ssr: false,
  loading: ViewLoading,
});

type Sheet = "library" | "inspector" | null;

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function ViewToggle({ view, onChange }: { view: BuilderView; onChange: (v: BuilderView) => void }) {
  const options: { id: BuilderView; label: string; icon: React.ReactNode }[] = [
    { id: "2d", label: "Plan", icon: <PencilRuler className="h-3.5 w-3.5" /> },
    { id: "3d", label: "3D", icon: <Box className="h-3.5 w-3.5" /> },
  ];
  return (
    <div role="tablist" aria-label="View" className="flex rounded-lg bg-slate-800 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={view === o.id}
          onClick={() => onChange(o.id)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
            view === o.id ? "bg-yellow-400 text-gray-950" : "text-stone-300 hover:text-white"
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function BuilderWorkspace() {
  const { state, selectedPieces, actions, ready } = useBuilder();
  const { scene, selection, view, gridStep } = state;

  const [sheet, setSheet] = useState<Sheet>(null);
  const [frameRequest, setFrameRequest] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const [name, setName] = useState(scene.name);
  useEffect(() => setName(scene.name), [scene.name]);

  // Each view's camera, remembered while the other one is showing.
  const camera3D = useRef<CameraMemory | null>(null);
  const camera2D = useRef<PlanCamera | null>(null);

  const full = scene.pieces.length >= SCENE_LIMITS.maxPieces;

  const add = useCallback(
    (item: LibraryItem) => {
      actions.add(item);
      setSheet(null);
    },
    [actions],
  );

  // "Clear" asks once; the question goes away by itself.
  useEffect(() => {
    if (!confirmClear) return;
    const timer = setTimeout(() => setConfirmClear(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmClear]);

  // Keyboard shortcuts (see the header comment)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const step = (gridStep || 1) * (e.shiftKey ? 10 : 1);
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if (mod && key === "d") {
        e.preventDefault();
        actions.duplicate();
      } else if (mod && key === "a") {
        e.preventDefault();
        actions.select(scene.pieces.map((p) => p.id));
      } else if (mod || e.altKey) {
        return;
      } else if (key === "Delete" || key === "Backspace") {
        e.preventDefault();
        actions.deleteSelection();
      } else if (key === "Escape") {
        actions.select([]);
        setSheet(null);
      } else if (key === "r") {
        actions.rotate("y", e.shiftKey ? -90 : 90);
      } else if (key === "f") {
        setFrameRequest((n) => n + 1);
      } else if (key === "2") {
        actions.setView("2d");
      } else if (key === "3") {
        actions.setView("3d");
      } else if (key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown") {
        if (selection.length === 0) return;
        e.preventDefault();
        const dx = key === "ArrowLeft" ? -step : key === "ArrowRight" ? step : 0;
        // Up = toward the back of the build in both views
        const dz = key === "ArrowUp" ? -step : key === "ArrowDown" ? step : 0;
        actions.nudge([dx, 0, dz]);
      } else if (key === "PageUp" || key === "PageDown") {
        if (selection.length === 0) return;
        e.preventDefault();
        actions.nudge([0, key === "PageUp" ? step : -step, 0]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, gridStep, scene.pieces, selection.length]);

  const viewProps = {
    scene,
    selection,
    gridStep,
    onSelect: actions.select,
    onToggleSelect: actions.toggleSelect,
    onMove: actions.setPositions,
    frameRequest,
  };

  const selectionLabel =
    selectedPieces.length === 1 ? pieceLabel(selectedPieces[0]) : `${selectedPieces.length} pieces`;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-950 text-white">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2 sm:gap-3">
        <Link href="/plans" aria-label="Back to plans" className="shrink-0">
          <Image src="/landing_page_logo.png" alt="Storage Network" width={32} height={32} className="rounded" />
        </Link>
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={name}
            aria-label="Design name"
            maxLength={SCENE_LIMITS.maxNameLength}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => actions.renameScene(name)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="w-full max-w-xs truncate rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-bold text-white outline-none transition hover:border-slate-700 focus:border-yellow-400"
          />
          <p className="px-1.5 text-[10px] text-stone-500">
            Custom Builder <span className="ml-1 rounded bg-yellow-400/15 px-1 py-px font-bold text-yellow-300">Preview</span>
          </p>
        </div>

        <ViewToggle view={view} onChange={actions.setView} />

        <label className="hidden items-center gap-1.5 text-[11px] font-semibold text-stone-400 sm:flex">
          Snap
          <select
            value={gridStep}
            onChange={(e) => actions.setGridStep(Number(e.target.value))}
            className="rounded-md border border-slate-700 bg-slate-950 px-1.5 py-1.5 text-xs font-bold text-white outline-none focus:border-yellow-400"
          >
            {GRID_STEPS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setFrameRequest((n) => n + 1)}
          title="Frame the whole build (F)"
          aria-label="Frame the whole build"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-stone-300 transition hover:border-yellow-400/50 hover:text-yellow-300"
        >
          <Maximize className="h-4 w-4" />
        </button>

        {scene.pieces.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (confirmClear) {
                actions.clear();
                setConfirmClear(false);
              } else {
                setConfirmClear(true);
              }
            }}
            title="Remove every piece"
            className={`hidden h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-bold transition sm:flex ${
              confirmClear
                ? "border-red-400 bg-red-500/15 text-red-200"
                : "border-slate-700 text-stone-300 hover:border-red-400/60 hover:text-red-300"
            }`}
          >
            <Eraser className="h-3.5 w-3.5" />
            {confirmClear ? "Remove all pieces?" : "Clear"}
          </button>
        )}
      </header>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-900/60 p-4 lg:block">
          <BuilderLibrary onAdd={add} disabled={full} />
        </aside>

        <main className="relative min-w-0 flex-1">
          {!ready ? (
            <ViewLoading />
          ) : view === "3d" ? (
            <BuilderViewport3D {...viewProps} cameraMemory={camera3D} />
          ) : (
            <BuilderViewport2D {...viewProps} cameraMemory={camera2D} />
          )}

          {ready && scene.pieces.length === 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center px-6">
              <div className="rounded-2xl bg-white/90 px-5 py-4 text-center shadow-lg">
                <p className="text-sm font-black text-slate-900">Your design is empty</p>
                <p className="mt-1 text-xs text-slate-600">
                  <span className="lg:hidden">Tap Add to bring in your first board.</span>
                  <span className="hidden lg:inline">Pick a board or a panel from the library on the left.</span>
                </p>
              </div>
            </div>
          )}

          {full && (
            <p className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-bold text-gray-950 shadow">
              {SCENE_LIMITS.maxPieces} pieces is the most one design can hold.
            </p>
          )}

          {/* Phone / portrait: quick actions for the selection */}
          {selectedPieces.length > 0 && sheet === null && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center px-3 lg:hidden">
              <div className="flex items-center gap-1 rounded-2xl border border-slate-700 bg-slate-900/95 p-1.5 shadow-xl backdrop-blur">
                <span className="max-w-[7rem] truncate px-2 text-[11px] font-bold text-stone-200">{selectionLabel}</span>
                {[
                  { label: "Turn", icon: <RotateCw className="h-4 w-4" />, run: () => actions.rotate("y", 90) },
                  { label: "Copy", icon: <Copy className="h-4 w-4" />, run: actions.duplicate },
                  { label: "Edit", icon: <SlidersHorizontal className="h-4 w-4" />, run: () => setSheet("inspector") },
                  { label: "Delete", icon: <Trash2 className="h-4 w-4 text-red-300" />, run: actions.deleteSelection },
                ].map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={b.run}
                    aria-label={b.label}
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-stone-200 transition active:bg-slate-700"
                  >
                    {b.icon}
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>

        <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-slate-800 bg-slate-900/60 p-4 lg:block">
          <BuilderInspector scene={scene} selected={selectedPieces} actions={actions} />
        </aside>
      </div>

      {/* ── Phone / portrait: bottom bar and sheets ─────────────────── */}
      <nav className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-800 bg-slate-900 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
        <button
          type="button"
          onClick={() => setSheet("library")}
          disabled={full}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-yellow-400 text-sm font-black uppercase tracking-wider text-gray-950 transition active:bg-yellow-300 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
        <button
          type="button"
          onClick={() => setSheet("inspector")}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 text-sm font-bold text-stone-200 transition active:bg-slate-800"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {selectedPieces.length > 0 ? "Edit" : "Design"}
        </button>
      </nav>

      {sheet && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => setSheet(null)} />
          <div
            role="dialog"
            aria-label={sheet === "library" ? "Add a piece" : "Edit"}
            className="absolute inset-x-0 bottom-0 flex max-h-[62dvh] flex-col rounded-t-2xl border-t border-slate-700 bg-slate-900"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
              <h2 className="text-sm font-black text-white">
                {sheet === "library" ? "Add a piece" : selectedPieces.length > 0 ? selectionLabel : "This design"}
              </h2>
              <button
                type="button"
                onClick={() => setSheet(null)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-stone-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {sheet === "library" ? (
                <BuilderLibrary onAdd={add} disabled={full} />
              ) : (
                <>
                  <BuilderInspector scene={scene} selected={selectedPieces} actions={actions} />
                  <label className="mt-5 flex items-center justify-between gap-3 border-t border-slate-800 pt-4 text-xs font-semibold text-stone-400 sm:hidden">
                    Snap moves to
                    <select
                      value={gridStep}
                      onChange={(e) => actions.setGridStep(Number(e.target.value))}
                      className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm font-bold text-white"
                    >
                      {GRID_STEPS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
