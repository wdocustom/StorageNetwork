"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ArrowUpFromLine, Loader2, Plus } from "lucide-react";
import {
  OVERHEAD_SIZE_PRESETS,
  OVERHEAD_DROP_HEIGHTS,
  OVERHEAD_JOIST_SPACINGS,
  type OverheadStorageConfig,
  type OverheadStorageResult,
  type OverheadDeckType,
} from "@/lib/overhead-storage";
import { calculateOverheadStorageUnit } from "@/app/actions/calculator";
import { SelectionCard, RollingPrice } from "./configurator-primitives";
import type { InstallerPricing } from "@/types/viewModels";

interface OverheadStorageDropdownProps {
  onAddOverheadUnit: (result: OverheadStorageResult, config: OverheadStorageConfig) => void;
  onConfigPreview?: (preview: { widthIn: number; depthIn: number; dropHeightIn: number } | null) => void;
  installerPricing?: InstallerPricing;
}

export default function OverheadStorageDropdown({
  onAddOverheadUnit,
  onConfigPreview,
  installerPricing,
}: OverheadStorageDropdownProps) {
  const [expanded, setExpanded] = useState(false);

  // Configuration state
  const [sizePresetId, setSizePresetId] = useState<string | null>(null);
  const [dropHeightId, setDropHeightId] = useState("24");
  const [joistSpacingId, setJoistSpacingId] = useState("16");
  const [deckType, setDeckType] = useState<OverheadDeckType>("plywood");

  // Calculation state
  const [result, setResult] = useState<OverheadStorageResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Calculate when config changes
  const calculate = useCallback(async () => {
    if (!sizePresetId) {
      setResult(null);
      return;
    }
    setLoading(true);
    const config: OverheadStorageConfig = {
      sizePresetId,
      customWidthIn: null,
      customDepthIn: null,
      dropHeightId,
      joistSpacingId,
      deckType,
    };
    const res = await calculateOverheadStorageUnit({ config, installerPricing });
    if (res.success) {
      setResult(res.result);
    }
    setLoading(false);
  }, [sizePresetId, dropHeightId, joistSpacingId, deckType, installerPricing]);

  useEffect(() => {
    calculate();
  }, [calculate]);

  // Notify parent of live config for 3D preview
  useEffect(() => {
    if (!sizePresetId || !expanded) {
      onConfigPreview?.(null);
      return;
    }
    const preset = OVERHEAD_SIZE_PRESETS.find((p) => p.id === sizePresetId);
    if (!preset) { onConfigPreview?.(null); return; }
    const dh = OVERHEAD_DROP_HEIGHTS.find((d) => d.id === dropHeightId);
    onConfigPreview?.({
      widthIn: preset.widthIn,
      depthIn: preset.depthIn,
      dropHeightIn: dh?.inches ?? 24,
    });
  }, [sizePresetId, dropHeightId, expanded, onConfigPreview]);

  function handleAdd() {
    if (!result || !sizePresetId) return;
    const config: OverheadStorageConfig = {
      sizePresetId,
      customWidthIn: null,
      customDepthIn: null,
      dropHeightId,
      joistSpacingId,
      deckType,
    };
    onAddOverheadUnit(result, config);
    // Reset
    setSizePresetId(null);
    setResult(null);
  }

  const selectedPreset = sizePresetId
    ? OVERHEAD_SIZE_PRESETS.find((p) => p.id === sizePresetId)
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
          Overhead Ceiling Storage
        </span>
        {selectedPreset && !expanded && (
          <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
            {selectedPreset.label}
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
                Ceiling-mounted storage platform. Select a size, drop height, and deck type.
              </p>

              {/* Size Presets */}
              <div>
                <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                  Platform Size
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {OVERHEAD_SIZE_PRESETS.map((preset) => (
                    <SelectionCard
                      key={preset.id}
                      selected={sizePresetId === preset.id}
                      onSelect={() =>
                        setSizePresetId(sizePresetId === preset.id ? null : preset.id)
                      }
                      className="w-full"
                    >
                      <div className="text-center">
                        <div className="text-xs font-bold text-zinc-300">
                          {preset.label}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {Math.round((preset.widthIn * preset.depthIn) / 144)} sq ft
                        </div>
                      </div>
                    </SelectionCard>
                  ))}
                </div>
              </div>

              {/* Drop Height */}
              {sizePresetId && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                    Drop Height
                  </label>
                  <div className="flex gap-1.5">
                    {OVERHEAD_DROP_HEIGHTS.map((dh) => (
                      <button
                        key={dh.id}
                        type="button"
                        onClick={() => setDropHeightId(dh.id)}
                        className={`flex-1 rounded-lg border px-2 py-2 text-center text-xs font-bold transition-all ${
                          dropHeightId === dh.id
                            ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                            : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-600"
                        }`}
                      >
                        {dh.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-600">
                    Distance from ceiling to bottom of platform
                  </p>
                </motion.div>
              )}

              {/* Joist Spacing */}
              {sizePresetId && (
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
              {sizePresetId && result && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.25 }}
                  className="mt-1"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 text-center">
                      <div className="text-2xl font-black text-white">
                        <RollingPrice value={result.price} />
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400/60">
                        {result.sqft} sq ft
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

              {sizePresetId && loading && (
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
