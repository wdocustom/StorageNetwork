"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ArrowUpFromLine, Loader2, Plus } from "lucide-react";
import {
  OVERHEAD_GRID_PRESETS,
  OVERHEAD_JOIST_SPACINGS,
  type OverheadStorageConfig,
  type OverheadStorageResult,
  type OverheadToteType,
} from "@/lib/overhead-storage";
import { calculateOverheadStorageUnit } from "@/app/actions/calculator";
import { SelectionCard, RollingPrice } from "./configurator-primitives";
import type { InstallerPricing } from "@/types/viewModels";

interface OverheadStorageDropdownProps {
  onAddOverheadUnit: (result: OverheadStorageResult, config: OverheadStorageConfig) => void;
  onConfigPreview?: (preview: { slotsWide: number; slotsDeep: number; toteType: OverheadToteType } | null) => void;
  installerPricing?: InstallerPricing;
}

export default function OverheadStorageDropdown({
  onAddOverheadUnit,
  onConfigPreview,
  installerPricing,
}: OverheadStorageDropdownProps) {
  const [expanded, setExpanded] = useState(false);

  // Configuration state
  const [gridPresetId, setGridPresetId] = useState<string | null>(null);
  const [toteType, setToteType] = useState<OverheadToteType>("HDX");
  const [joistSpacingId, setJoistSpacingId] = useState("16");

  // Calculation state
  const [result, setResult] = useState<OverheadStorageResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Calculate when config changes
  const calculate = useCallback(async () => {
    if (!gridPresetId) {
      setResult(null);
      return;
    }
    setLoading(true);
    const config: OverheadStorageConfig = {
      gridPresetId,
      toteType,
      joistSpacingId,
    };
    const res = await calculateOverheadStorageUnit({ config, installerPricing });
    if (res.success) {
      setResult(res.result);
    }
    setLoading(false);
  }, [gridPresetId, toteType, joistSpacingId, installerPricing]);

  useEffect(() => {
    calculate();
  }, [calculate]);

  // Notify parent of live config for 3D preview
  useEffect(() => {
    if (!gridPresetId || !expanded) {
      onConfigPreview?.(null);
      return;
    }
    const preset = OVERHEAD_GRID_PRESETS.find((p) => p.id === gridPresetId);
    if (!preset) { onConfigPreview?.(null); return; }
    onConfigPreview?.({
      slotsWide: preset.slotsWide,
      slotsDeep: preset.slotsDeep,
      toteType,
    });
  }, [gridPresetId, toteType, expanded, onConfigPreview]);

  function handleAdd() {
    if (!result || !gridPresetId) return;
    const config: OverheadStorageConfig = {
      gridPresetId,
      toteType,
      joistSpacingId,
    };
    onAddOverheadUnit(result, config);
    // Reset
    setGridPresetId(null);
    setResult(null);
  }

  const selectedPreset = gridPresetId
    ? OVERHEAD_GRID_PRESETS.find((p) => p.id === gridPresetId)
    : null;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-3 transition-colors hover:bg-zinc-800/40"
      >
        <ArrowUpFromLine className="h-4 w-4 text-yellow-400" />
        <span className="flex-1 text-left text-sm font-medium text-zinc-300">
          Ceiling Tote Rail System
        </span>
        {selectedPreset && !expanded && (
          <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
            {selectedPreset.label} · {toteType}
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
            <div className="space-y-3 px-4 pb-4">
              <p className="text-[10px] text-zinc-500">
                Ceiling-mounted tote rails. Totes hang by their rim. 3-layer system: nailer → padding → plywood rail.
              </p>

              {/* Tote Type */}
              <div>
                <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                  Tote Type
                </label>
                <div className="flex gap-1.5">
                  {(["HDX", "GM"] as const).map((tt) => (
                    <button
                      key={tt}
                      type="button"
                      onClick={() => setToteType(tt)}
                      className={`flex-1 rounded-lg border px-2 py-2 text-center text-xs font-bold transition-all ${
                        toteType === tt
                          ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                          : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-600"
                      }`}
                    >
                      {tt === "HDX" ? "HDX 27-Gal" : "Greenmade 27-Gal"}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-zinc-600">
                  {toteType === "HDX" ? "19-3/4\" slot spacing" : "20-3/4\" slot spacing"}
                </p>
              </div>

              {/* Grid Presets */}
              <div>
                <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                  Tote Grid
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {OVERHEAD_GRID_PRESETS.map((preset) => (
                    <SelectionCard
                      key={preset.id}
                      selected={gridPresetId === preset.id}
                      onSelect={() =>
                        setGridPresetId(gridPresetId === preset.id ? null : preset.id)
                      }
                      className="w-full"
                    >
                      <div className="text-center">
                        <div className="text-xs font-bold text-zinc-300">
                          {preset.label}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {preset.toteCount} totes
                        </div>
                      </div>
                    </SelectionCard>
                  ))}
                </div>
              </div>

              {/* Joist Spacing */}
              {gridPresetId && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.05 }}
                >
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                    Joist Spacing
                  </label>
                  <div className="flex gap-1.5">
                    {OVERHEAD_JOIST_SPACINGS.map((js) => (
                      <button
                        key={js.id}
                        type="button"
                        onClick={() => setJoistSpacingId(js.id)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-center text-xs font-bold transition-all ${
                          joistSpacingId === js.id
                            ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                            : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-600"
                        }`}
                      >
                        {js.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-600">
                    Standard residential is 16&quot; on center
                  </p>
                </motion.div>
              )}

              {/* Price & Add Button */}
              {gridPresetId && result && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.25 }}
                  className="mt-1"
                >
                  <div className="mb-2 rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 text-center text-[10px] text-zinc-500">
                    {Math.round(result.systemWidthIn)}&quot; W × {Math.round(result.systemDepthIn)}&quot; D · {result.toteCount} totes
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 text-center">
                      <div className="text-2xl font-black text-white">
                        <RollingPrice value={result.price} />
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400/60">
                        {result.toteCount} slots
                      </div>
                    </div>
                    <motion.button
                      onClick={handleAdd}
                      className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-zinc-900 transition-colors hover:bg-yellow-300"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Plus className="h-4 w-4" />
                      Add to Quote
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {gridPresetId && loading && (
                <div className="flex items-center justify-center gap-2 py-4 text-xs font-semibold text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Calculating...
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
