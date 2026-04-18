"use client";

import { Loader2, Plus, Check, Package, Star } from "lucide-react";
import BottomDrawer from "./BottomDrawer";
import { BESTSELLER_PRESETS } from "@/lib/presets";
import type { CompoundBuildResult } from "@/app/actions/calculator";
import type { InstallerPricing } from "@/types/viewModels";

interface BestsellerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  installerPricing?: InstallerPricing;
  selectedPreset: string;
  onSelectedPresetChange: (id: string) => void;
  presetHasTotes: boolean;
  onPresetHasTotesChange: (v: boolean) => void;
  presetLoading: boolean;
  presetResult: CompoundBuildResult | null;
  presetAdded: boolean;
  onAddPreset: () => void;
}

export default function BestsellerDrawer({
  isOpen,
  onClose,
  installerPricing,
  selectedPreset,
  onSelectedPresetChange,
  presetHasTotes,
  onPresetHasTotesChange,
  presetLoading,
  presetResult,
  presetAdded,
  onAddPreset,
}: BestsellerDrawerProps) {
  const activePresetObj = BESTSELLER_PRESETS.find((p) => p.id === selectedPreset);

  return (
    <BottomDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Bestsellers"
      subtitle="Proven presets — fastest to quote"
      icon={<Star className="h-4 w-4 text-yellow-400" />}
    >
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-600">
        Quick Select — Bestsellers
      </label>
      <select
        value={selectedPreset}
        onChange={(e) => {
          onSelectedPresetChange(e.target.value);
          onPresetHasTotesChange(true);
        }}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-yellow-400 focus:outline-none"
      >
        <option value="">Choose a bestseller…</option>
        {BESTSELLER_PRESETS.filter((p) => {
          const key = `bestseller_${p.id.replace(/-/g, "_")}_disabled` as keyof InstallerPricing;
          return installerPricing?.[key] !== true;
        }).map((p) => {
          const subDesc = p.units.map((u) => `${u.cols}×${u.rows}`).join(" + ");
          return (
            <option key={p.id} value={p.id}>
              {p.name} — {subDesc} ({p.units.reduce((s, u) => s + u.cols * u.rows, 0)} slots)
            </option>
          );
        })}
      </select>

      {selectedPreset && (
        <div className="mt-3 space-y-3">
          {/* Totes toggle — hidden for mandatory-tote or totes-disabled presets */}
          {activePresetObj?.totesAreMandatory ? (
            <div className="flex items-center gap-3 rounded-lg bg-slate-800 px-3 py-2.5 text-sm text-stone-400">
              <Package className="h-4 w-4 text-yellow-400" />
              Totes included — drawer slide system
            </div>
          ) : activePresetObj?.totesDisabled ? (
            <div className="flex items-center gap-3 rounded-lg bg-slate-800 px-3 py-2.5 text-sm text-stone-400">
              <Package className="h-4 w-4 text-stone-500" />
              Frame only — no totes
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-slate-800 px-3 py-2.5">
              <input
                type="checkbox"
                checked={presetHasTotes}
                onChange={(e) => onPresetHasTotesChange(e.target.checked)}
                className="h-4 w-4 accent-yellow-400"
              />
              <span className="text-sm text-stone-300">Include Totes</span>
            </label>
          )}

          {presetLoading && (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculating…
            </div>
          )}

          {presetResult && !presetLoading && (
            <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 p-3">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg bg-slate-800 p-2">
                  <p className="text-lg font-black text-white">
                    {presetResult.totalSlots} slots
                  </p>
                  <p className="text-[10px] font-bold uppercase text-stone-500">
                    {presetResult.subUnits.map((u) => `${u.cols}×${u.rows}`).join(" + ")}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-800 p-2">
                  <p className="text-lg font-black text-yellow-400">
                    ${presetResult.totalPrice.toLocaleString()}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-stone-500">
                    {presetResult.presetName}
                  </p>
                </div>
              </div>
              <button
                onClick={onAddPreset}
                className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold uppercase tracking-wider transition-all ${
                  presetAdded
                    ? "bg-emerald-500 text-white"
                    : "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
                }`}
              >
                {presetAdded ? (
                  <>
                    <Check className="h-4 w-4" />
                    Added to Cart
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add to Cart
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
