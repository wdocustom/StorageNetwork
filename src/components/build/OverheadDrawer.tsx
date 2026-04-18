"use client";

import { Loader2, Plus, Check, ArrowUpFromLine } from "lucide-react";
import BottomDrawer from "./BottomDrawer";
import { OVERHEAD_GRID_PRESETS } from "@/lib/overhead-storage";

type ToteType = "HDX" | "GM";

interface OverheadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  overheadPresetId: string;
  onOverheadPresetIdChange: (id: string) => void;
  overheadToteType: ToteType;
  onOverheadToteTypeChange: (t: ToteType) => void;
  overheadHasTotes: boolean;
  onOverheadHasTotesChange: (v: boolean) => void;
  overheadPrice: number | null;
  overheadLoading: boolean;
  overheadAdded: boolean;
  onAddOverhead: () => void;
}

export default function OverheadDrawer({
  isOpen,
  onClose,
  overheadPresetId,
  onOverheadPresetIdChange,
  overheadToteType,
  onOverheadToteTypeChange,
  overheadHasTotes,
  onOverheadHasTotesChange,
  overheadPrice,
  overheadLoading,
  overheadAdded,
  onAddOverhead,
}: OverheadDrawerProps) {
  const preset = OVERHEAD_GRID_PRESETS.find((p) => p.id === overheadPresetId);

  return (
    <BottomDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Overhead Storage"
      subtitle="Ceiling-mounted tote grids"
      icon={<ArrowUpFromLine className="h-4 w-4 text-yellow-400" />}
    >
      <div className="space-y-3">
        {/* Grid preset buttons */}
        <div>
          <label className="mb-2 block text-[10px] font-bold uppercase text-stone-500">
            Grid Size
          </label>
          <div className="grid grid-cols-3 gap-2">
            {OVERHEAD_GRID_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() =>
                  onOverheadPresetIdChange(overheadPresetId === p.id ? "" : p.id)
                }
                className={`rounded-lg border px-3 py-2.5 text-center transition-colors ${
                  overheadPresetId === p.id
                    ? "border-yellow-400 bg-yellow-400/10"
                    : "border-slate-700 hover:border-stone-600"
                }`}
              >
                <div className="text-sm font-bold text-white">{p.label}</div>
                <div className="text-[10px] text-stone-500">{p.toteCount} totes</div>
              </button>
            ))}
          </div>
        </div>

        {overheadPresetId && (
          <>
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase text-stone-500">
                Tote Size
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onOverheadToteTypeChange("HDX")}
                  className={`rounded-lg border px-3 py-2 text-center transition-colors ${
                    overheadToteType === "HDX"
                      ? "border-yellow-400 bg-yellow-400/10"
                      : "border-slate-700 hover:border-stone-600"
                  }`}
                >
                  <div className="text-xs font-bold text-stone-200">Standard (HDX)</div>
                  <div className="text-[9px] text-stone-500">19-3/4&quot; slot</div>
                </button>
                <button
                  onClick={() => onOverheadToteTypeChange("GM")}
                  className={`rounded-lg border px-3 py-2 text-center transition-colors ${
                    overheadToteType === "GM"
                      ? "border-yellow-400 bg-yellow-400/10"
                      : "border-slate-700 hover:border-stone-600"
                  }`}
                >
                  <div className="text-xs font-bold text-stone-200">Wide (GM)</div>
                  <div className="text-[9px] text-stone-500">20-3/4&quot; slot</div>
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-slate-800 px-3 py-2.5">
              <input
                type="checkbox"
                checked={overheadHasTotes}
                onChange={(e) => onOverheadHasTotesChange(e.target.checked)}
                className="h-4 w-4 accent-yellow-400"
              />
              <span className="text-sm text-stone-300">Include Totes</span>
            </label>

            {overheadLoading && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-stone-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculating…
              </div>
            )}

            {overheadPrice != null && !overheadLoading && preset && (
              <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 p-3">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg bg-slate-800 p-2">
                    <p className="text-lg font-black text-white">{preset.label}</p>
                    <p className="text-[10px] font-bold uppercase text-stone-500">
                      {preset.toteCount} totes • {overheadToteType}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-800 p-2">
                    <p className="text-lg font-black text-yellow-400">
                      ${overheadPrice.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold uppercase text-stone-500">
                      Overhead Storage
                    </p>
                  </div>
                </div>
                <button
                  onClick={onAddOverhead}
                  className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold uppercase tracking-wider transition-all ${
                    overheadAdded
                      ? "bg-emerald-500 text-white"
                      : "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
                  }`}
                >
                  {overheadAdded ? (
                    <>
                      <Check className="h-4 w-4" />
                      Added to Quote
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Add to Quote
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </BottomDrawer>
  );
}
