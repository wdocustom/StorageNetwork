"use client";

import { Loader2, Plus, Check, Grid3X3 } from "lucide-react";
import BottomDrawer from "./BottomDrawer";
import { SHELVING_CONFIGS } from "@/lib/shelving";

interface ShelvingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedShelving: string;
  onSelectedShelvingChange: (id: string) => void;
  shelvingPrice: number | null;
  shelvingLoading: boolean;
  shelvingAdded: boolean;
  onAddShelving: () => void;
}

export default function ShelvingDrawer({
  isOpen,
  onClose,
  selectedShelving,
  onSelectedShelvingChange,
  shelvingPrice,
  shelvingLoading,
  shelvingAdded,
  onAddShelving,
}: ShelvingDrawerProps) {
  const cfg = SHELVING_CONFIGS.find((c) => c.id === selectedShelving);

  return (
    <BottomDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Open Shelving"
      subtitle="Tall or short shelving units"
      icon={<Grid3X3 className="h-4 w-4 text-emerald-400" />}
    >
      <select
        value={selectedShelving}
        onChange={(e) => onSelectedShelvingChange(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-yellow-400 focus:outline-none"
      >
        <option value="">Choose a shelving unit…</option>
        {SHELVING_CONFIGS.map((c) => {
          const heightLabel =
            c.height === "tall" ? `Tall (${c.frameH}"H)` : `Short (${c.frameH}"H)`;
          const shelfText =
            c.shelves === 1 ? "1 shelf + top" : `${c.shelves} shelves + top`;
          return (
            <option key={c.id} value={c.id}>
              {c.widthFt}&apos; Wide × {heightLabel} — {shelfText}
            </option>
          );
        })}
      </select>

      {selectedShelving && (
        <div className="mt-3 space-y-3">
          {shelvingLoading && (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculating…
            </div>
          )}

          {shelvingPrice != null && !shelvingLoading && cfg && (
            <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 p-3">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg bg-slate-800 p-2">
                  <p className="text-lg font-black text-white">
                    {cfg.widthFt}&apos; × {cfg.height === "tall" ? "Tall" : "Short"}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-stone-500">
                    {cfg.widthIn}&quot; × {cfg.frameH}&quot; × 30&quot;
                  </p>
                </div>
                <div className="rounded-lg bg-slate-800 p-2">
                  <p className="text-lg font-black text-yellow-400">
                    ${shelvingPrice.toLocaleString()}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-stone-500">
                    Open Shelving
                  </p>
                </div>
              </div>
              <button
                onClick={onAddShelving}
                className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold uppercase tracking-wider transition-all ${
                  shelvingAdded
                    ? "bg-emerald-500 text-white"
                    : "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
                }`}
              >
                {shelvingAdded ? (
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
        </div>
      )}
    </BottomDrawer>
  );
}
