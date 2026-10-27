"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Studio "+" sheet — add a custom tote unit or one of the installer's
// bestsellers (priced with the installer's own rates) to the order.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { Loader2, Plus, SlidersHorizontal, Star, X } from "lucide-react";
import { calculateCompoundBuild } from "@/app/actions/calculator";
import type { BestsellerPreset } from "@/lib/presets";
import { presetTotesChoice } from "@/lib/studio";
import type { DesignPageViewModel } from "@/types/viewModels";

export default function StudioAddSheet({
  open,
  presets,
  pricing,
  totesDisabled,
  addingPreset,
  onClose,
  onAddCustom,
  onAddBestseller,
}: {
  open: boolean;
  presets: BestsellerPreset[];
  pricing: DesignPageViewModel["pricing"] | undefined;
  totesDisabled: boolean;
  addingPreset: string | null;
  onClose: () => void;
  onAddCustom: () => void;
  onAddBestseller: (presetId: string) => Promise<boolean>;
}) {
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    let live = true;
    for (const p of presets) {
      const choice = presetTotesChoice(p, totesDisabled);
      calculateCompoundBuild({ presetId: p.id, hasTotes: choice !== "never", installerPricing: pricing })
        .then((res) => {
          if (live && res.success) setPrices((prev) => ({ ...prev, [p.id]: res.totalPrice }));
        })
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [open, presets, pricing, totesDisabled]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add to your design"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-800 bg-zinc-950 p-4 sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Add to your design</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onAddCustom();
            onClose();
          }}
          className="mb-4 flex w-full items-center gap-3 rounded-xl border border-yellow-400/40 bg-yellow-400/10 p-3 text-left transition hover:border-yellow-400"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-yellow-400 text-zinc-900">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-bold text-white">Custom unit</span>
            <span className="block text-[11px] text-zinc-400">Any size — set totes wide and tall</span>
          </span>
        </button>

        {presets.length > 0 && (
          <>
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              <Star className="h-3 w-3 text-yellow-400" />
              Bestsellers
            </p>
            <ul className="space-y-2">
              {presets.map((p) => {
                const busy = addingPreset === p.id;
                const price = prices[p.id];
                return (
                  <li key={p.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white">{p.name}</p>
                      <p className="text-[11px] text-zinc-500">{p.units.map((u) => `${u.cols}×${u.rows}`).join(" + ")}</p>
                    </div>
                    <span className="shrink-0 text-sm font-black text-white">
                      {price != null ? `$${Math.round(price).toLocaleString()}` : <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />}
                    </span>
                    <button
                      type="button"
                      disabled={!!addingPreset}
                      onClick={async () => {
                        if (await onAddBestseller(p.id)) onClose();
                      }}
                      className="flex shrink-0 items-center gap-1 rounded-lg bg-yellow-400 px-3 py-2 text-xs font-bold text-zinc-900 transition hover:bg-yellow-300 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Add
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
