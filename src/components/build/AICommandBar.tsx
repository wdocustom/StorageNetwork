"use client";

import { Loader2, Sparkles, Plus, Check } from "lucide-react";
import { RAISED_BED_SIZES } from "@/lib/raised-beds";

export type AiResultUnit = {
  cols: number;
  rows: number;
  toteColor: string;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  presetId?: string;
  overheadGridPresetId?: string;
  raisedBedConfig?: {
    sizeId: string;
    finish: string;
    hasLiner: boolean;
    depthIncrease: boolean;
    bottomShelf: boolean;
    pestCover: string;
    postHeight: number | null;
    hasHook: boolean;
    highWindWeighted?: boolean;
    quantity: number;
  } | null;
  customPrice?: number | null;
  description: string;
  indoorDelivery?: boolean;
};

interface AICommandBarProps {
  aiInput: string;
  onAiInputChange: (val: string) => void;
  onBuild: () => void;
  aiLoading: boolean;
  aiError: string;
  aiResult: AiResultUnit[] | null;
  aiNotes: string;
  aiAdded: boolean;
  onAddAiUnits: () => void;
  onClearResult: () => void;
}

export default function AICommandBar({
  aiInput,
  onAiInputChange,
  onBuild,
  aiLoading,
  aiError,
  aiResult,
  aiNotes,
  aiAdded,
  onAddAiUnits,
  onClearResult,
}: AICommandBarProps) {
  return (
    <section className="rounded-xl border border-yellow-400/20 bg-slate-900 p-4">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
        <Sparkles className="h-4 w-4 text-yellow-400" />
        AI Command Center
      </h2>

      <textarea
        value={aiInput}
        onChange={(e) => onAiInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onBuild();
          }
        }}
        placeholder='Describe what to build — e.g. "Indiana Joe with clear totes", "4x4 on wheels with a top", "36x24 planter box $350", "garage cleanout $349", "120x96 wall fit"'
        rows={3}
        className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-stone-600 focus:border-yellow-400 focus:outline-none"
        disabled={aiLoading}
      />

      {aiError && <p className="mt-1 text-xs font-medium text-red-400">{aiError}</p>}

      {!aiResult && (
        <button
          onClick={onBuild}
          disabled={!aiInput.trim() || aiLoading}
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold uppercase tracking-wider transition-all ${
            aiInput.trim() && !aiLoading
              ? "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
              : "cursor-not-allowed bg-slate-700 text-stone-500"
          }`}
        >
          {aiLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Parsing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Build
            </>
          )}
        </button>
      )}

      {aiResult && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
            Preview — confirm before adding
          </p>
          {aiResult.map((unit, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-700 bg-slate-800/50 p-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white">{unit.description}</p>
                <div className="flex items-center gap-2">
                  {unit.customPrice && (
                    <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                      ${unit.customPrice}
                    </span>
                  )}
                  {unit.presetId && (
                    <span className="rounded-full bg-yellow-400/15 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
                      Preset
                    </span>
                  )}
                  {unit.overheadGridPresetId && (
                    <span className="rounded-full bg-blue-400/15 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                      Ceiling
                    </span>
                  )}
                  {unit.raisedBedConfig && (
                    <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                      Raised Bed
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-stone-400">
                {unit.raisedBedConfig ? (
                  <span>
                    {(() => {
                      const bed = RAISED_BED_SIZES.find(
                        (s) => s.id === unit.raisedBedConfig!.sizeId
                      );
                      return bed
                        ? `${bed.widthIn}"×${bed.lengthIn}"×${bed.heightIn}" ${
                            bed.style === "with_legs" ? "(with legs)" : "(ground)"
                          }`
                        : unit.raisedBedConfig!.sizeId;
                    })()}
                    {unit.raisedBedConfig.finish !== "natural" &&
                      ` • ${
                        unit.raisedBedConfig.finish === "stain"
                          ? "Stain"
                          : "Painted White"
                      }`}
                    {unit.raisedBedConfig.hasLiner && " • Liner"}
                    {unit.raisedBedConfig.depthIncrease && ' • 12" Depth'}
                    {unit.raisedBedConfig.postHeight &&
                      ` • ${
                        unit.raisedBedConfig.postHeight === 72
                          ? "6'"
                          : unit.raisedBedConfig.postHeight === 84
                            ? "7'"
                            : "8'"
                      } Post`}
                    {unit.raisedBedConfig.hasHook && " • Hook"}
                    {unit.raisedBedConfig.highWindWeighted && " • High-Wind Weighted"}
                    {unit.raisedBedConfig.quantity > 1 &&
                      ` • Qty: ${unit.raisedBedConfig.quantity}`}
                  </span>
                ) : unit.overheadGridPresetId ? (
                  <span>
                    Overhead {unit.overheadGridPresetId} grid
                    {unit.hasTotes ? ` • Totes (${unit.toteColor})` : ""}
                  </span>
                ) : unit.cols === 0 && unit.rows === 0 && unit.customPrice ? (
                  <span>Custom item</span>
                ) : (
                  <>
                    {!unit.presetId && (
                      <span>
                        {unit.cols}×{unit.rows}
                      </span>
                    )}
                    {unit.hasTotes && <span>Totes ({unit.toteColor})</span>}
                    {!unit.hasTotes && <span>No totes</span>}
                    {unit.hasWheels && <span>Wheels</span>}
                    {unit.hasTop && <span>Top</span>}
                  </>
                )}
              </div>
            </div>
          ))}
          {aiNotes && <p className="text-xs italic text-stone-500">{aiNotes}</p>}
          <div className="flex gap-2">
            <button
              onClick={onClearResult}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-stone-400 transition-colors hover:text-white"
            >
              Edit
            </button>
            <button
              onClick={onAddAiUnits}
              className={`flex flex-[2] items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold uppercase tracking-wider transition-all ${
                aiAdded
                  ? "bg-emerald-500 text-white"
                  : "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
              }`}
            >
              {aiAdded ? (
                <>
                  <Check className="h-4 w-4" /> Added to Cart
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Add to Cart
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
