"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ChevronDown, Loader2, Package, Plus, Star } from "lucide-react";
import { BESTSELLER_PRESETS } from "@/lib/presets";
import type { ConfiguratorSidebarProps } from "./configurator-types";
import { SelectionCard, StudioToggle, RollingPrice } from "./configurator-primitives";

export default function BestsellerDropdown({
  presetOptions,
  activePreset,
  onPresetChange,
  compoundBuild,
  presetLoading,
  presetTotes,
  onPresetTotesChange,
  onAddPresetUnit,
  wallW,
  wallH,
  hasWallDimensions,
}: {
  presetOptions: ConfiguratorSidebarProps["presetOptions"];
  activePreset: string | null;
  onPresetChange: (v: string | null) => void;
  compoundBuild: ConfiguratorSidebarProps["compoundBuild"];
  presetLoading: boolean;
  presetTotes: boolean;
  onPresetTotesChange: (v: boolean) => void;
  onAddPresetUnit: () => void;
  wallW: number;
  wallH: number;
  hasWallDimensions: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasSelection = !!activePreset;

  useEffect(() => {
    if (activePreset) setExpanded(true);
  }, [activePreset]);

  const selectedPresetName = activePreset
    ? presetOptions.find((p) => p.id === activePreset)?.name ?? "Bestseller"
    : null;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-3 transition-colors hover:bg-zinc-800/40"
      >
        <Star className="h-4 w-4 text-yellow-400" />
        <span className="flex-1 text-left text-sm font-medium text-zinc-300">
          Bestsellers
        </span>
        {hasSelection && !expanded && (
          <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
            {selectedPresetName}
          </span>
        )}
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
        >
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-2 px-4 pb-4">
              <SelectionCard
                selected={!activePreset}
                onSelect={() => onPresetChange(null)}
                className="w-full"
              >
                <div className="text-xs font-bold text-zinc-300">Custom Build</div>
                <div className="mt-0.5 text-[10px] text-zinc-500">Configure your own layout</div>
              </SelectionCard>

              {presetOptions.map((p) => {
                const presetCombinedW = compoundBuild && activePreset === p.id
                  ? compoundBuild.subUnits.reduce((sum, su) => sum + su.totalW, 0)
                  : null;
                const presetMaxH = compoundBuild && activePreset === p.id
                  ? Math.max(...compoundBuild.subUnits.map((su) => su.totalH))
                  : null;
                const estimatedW = p.units.reduce((sum, u) => sum + u.cols * 18, 0);
                const estimatedH = Math.max(...p.units.map((u) => u.rows * 16));
                const checkW = presetCombinedW ?? estimatedW;
                const checkH = presetMaxH ?? estimatedH;
                const doesntFit = hasWallDimensions && (checkW > wallW || checkH > wallH);

                return (
                  <SelectionCard
                    key={p.id}
                    selected={activePreset === p.id}
                    onSelect={() => !doesntFit && onPresetChange(p.id)}
                    className={`w-full ${doesntFit ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-zinc-300">{p.name}</div>
                        <div className="mt-0.5 text-[10px] text-zinc-500">
                          {p.units.map((u) => `${u.cols}x${u.rows}`).join(" + ")}
                        </div>
                      </div>
                      {doesntFit && (
                        <span className="flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[9px] font-bold text-red-400">
                          <AlertTriangle className="h-3 w-3" />
                          Won&apos;t Fit
                        </span>
                      )}
                    </div>
                  </SelectionCard>
                );
              })}

              {activePreset && compoundBuild && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.25 }}
                  className="mt-1 space-y-3"
                >
                  <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/60 p-3">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-yellow-400/60">
                      Preset Includes
                    </div>
                    <ul className="space-y-1">
                      {compoundBuild.subUnits.map((su, i) => (
                        <li key={i} className="flex items-center justify-between text-xs text-zinc-400">
                          <span className="font-medium text-zinc-300">
                            {su.cols}W &times; {su.rows}H ({su.slots} slots)
                          </span>
                          <span>{su.totalW.toFixed(1)}&quot; &times; {su.totalH.toFixed(1)}&quot;</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {(() => {
                    const presetDef = BESTSELLER_PRESETS.find((p) => p.id === activePreset);
                    return presetDef?.totesAreMandatory ? (
                      <div className="flex items-center gap-2 rounded-lg bg-zinc-800/60 px-3 py-2 text-[11px] text-zinc-400">
                        <Package className="h-3.5 w-3.5 text-yellow-400" />
                        Totes included — drawer slide system
                      </div>
                    ) : (
                      <StudioToggle
                        checked={presetTotes}
                        onChange={onPresetTotesChange}
                        label="Include Totes"
                      />
                    );
                  })()}
                  <div className="flex items-center gap-3 border-t border-zinc-800 pt-3">
                    <div className="flex-1 text-center">
                      <div className="text-2xl font-black text-white">
                        {presetLoading ? "..." : <RollingPrice value={compoundBuild.totalPrice} />}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400/60">
                        {compoundBuild.presetName}
                      </div>
                    </div>
                    <motion.button
                      onClick={onAddPresetUnit}
                      disabled={presetLoading}
                      className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-zinc-900 transition-colors hover:bg-yellow-300 disabled:opacity-40"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Plus className="h-4 w-4" />
                      Add to Quote
                    </motion.button>
                  </div>
                </motion.div>
              )}
              {activePreset && !compoundBuild && presetLoading && (
                <div className="flex items-center justify-center gap-2 py-4 text-xs font-semibold text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Calculating preset...
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
