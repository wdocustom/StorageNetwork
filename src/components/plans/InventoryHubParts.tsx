"use client";

// Pieces of the Smart Inventory hub (/plans/inventory): the tote-grid
// thumbnail of a rack and the "Add a rack you built" sheet.

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

import type { DiyRackSuggestion } from "@/app/actions/diy-inventory";
import { Segmented, Stepper } from "@/components/designer/controls";
import { DIY_RACK_LIMITS } from "@/lib/diy-inventory";

/** A rack drawn as its tote grid; the first `filled` totes shaded. */
export function MiniRack({ cols, rows, filled }: { cols: number; rows: number; filled: number }) {
  const c = Math.min(cols, 8);
  const r = Math.min(rows, 6);
  const shown = c * r;
  const shade = Math.round((filled / Math.max(1, cols * rows)) * shown);
  return (
    <div
      className="grid shrink-0 gap-0.5 rounded-md border-x-2 border-y border-amber-700/80 bg-amber-900/20 p-1"
      style={{ gridTemplateColumns: `repeat(${c}, 9px)` }}
      aria-hidden
    >
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className={`h-[7px] rounded-[2px] ${i < shade ? "bg-yellow-400" : "bg-slate-700"}`} />
      ))}
    </div>
  );
}

export function AddRackSheet({
  suggestions,
  onAdd,
  onClose,
}: {
  suggestions: DiyRackSuggestion[];
  onAdd: (rack: { label: string; cols: number; rows: number; hasWheels: boolean; hasTop: boolean; sideways: boolean }) => Promise<string | null>;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [cols, setCols] = useState(suggestions[0]?.cols ?? 4);
  const [rows, setRows] = useState(suggestions[0]?.rows ?? 4);
  const [hasWheels, setHasWheels] = useState(suggestions[0]?.hasWheels ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (rack: Parameters<typeof onAdd>[0]) => {
    setBusy(true);
    setError("");
    const err = await onAdd(rack);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add a rack"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-white">Add a rack you built</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-stone-500 hover:bg-slate-800 hover:text-stone-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-stone-500">From your plans · one tap</p>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <button
                  key={`${s.cols}x${s.rows}`}
                  type="button"
                  disabled={busy}
                  onClick={() => submit({ label: s.label.replace(/ rack$/, "") + " rack", cols: s.cols, rows: s.rows, hasWheels: s.hasWheels, hasTop: s.hasTop, sideways: s.sideways })}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3 text-left transition hover:border-yellow-400/60 disabled:opacity-60"
                >
                  <MiniRack cols={s.cols} rows={s.rows} filled={0} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-white">{s.label}</span>
                    <span className="block text-xs text-stone-500">
                      {s.cols * s.rows} totes{s.hasWheels ? " · on casters" : ""}{s.hasTop ? " · worktop" : ""}
                    </span>
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-yellow-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-stone-500">
          {suggestions.length ? "Or any size" : "Its size"}
        </p>
        <div className="space-y-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={40}
            placeholder="Name it (e.g. Garage wall)"
            aria-label="Rack name"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none placeholder:text-stone-600 focus:border-yellow-400"
          />
          <div className="grid grid-cols-2 gap-3">
            <Stepper label="Totes wide" value={cols} min={DIY_RACK_LIMITS.minCols} max={DIY_RACK_LIMITS.maxCols} onChange={setCols} />
            <Stepper label="Totes tall" value={rows} min={DIY_RACK_LIMITS.minRows} max={DIY_RACK_LIMITS.maxRows} onChange={setRows} />
          </div>
          <Segmented
            label="Casters"
            value={hasWheels}
            onChange={setHasWheels}
            options={[
              { value: true, label: "Rolling" },
              { value: false, label: "Stationary" },
            ]}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => submit({ label, cols, rows, hasWheels, hasTop: false, sideways: false })}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-sm font-black text-gray-950 transition hover:bg-yellow-300 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add {cols}×{rows} rack ({cols * rows} totes)
          </button>
          {error && <p className="text-center text-xs text-amber-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}

