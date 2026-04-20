"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Layers, Loader2, Plus } from "lucide-react";
import { SHELVING_CONFIGS } from "@/lib/shelving";
import { SelectionCard, RollingPrice } from "./configurator-primitives";

export default function ShelvingDropdown({
  shelvingConfigId,
  onShelvingConfigChange,
  shelvingPrice,
  shelvingLoading,
  onAddShelvingUnit,
}: {
  shelvingConfigId: string | null;
  onShelvingConfigChange: (id: string | null) => void;
  shelvingPrice: number | null;
  shelvingLoading: boolean;
  onAddShelvingUnit: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (shelvingConfigId) setExpanded(true);
  }, [shelvingConfigId]);

  const selectedConfig = shelvingConfigId
    ? SHELVING_CONFIGS.find((c) => c.id === shelvingConfigId)
    : null;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-3 transition-colors hover:bg-zinc-800/40"
      >
        <Layers className="h-4 w-4 text-yellow-400" />
        <span className="flex-1 text-left text-sm font-medium text-zinc-300">
          Open Shelving
        </span>
        {selectedConfig && !expanded && (
          <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
            {selectedConfig.label}
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
              <p className="text-[10px] text-zinc-500">
                Same 30&quot; depth as tote organizers. Plywood top + shelves included.
              </p>

              {SHELVING_CONFIGS.map((cfg) => {
                const heightLabel = cfg.height === "tall" ? `Tall (${cfg.frameH}"H)` : `Short (${cfg.frameH}"H)`;
                const shelfText = cfg.shelves === 1 ? "1 shelf + top" : `${cfg.shelves} shelves + top`;
                return (
                  <SelectionCard
                    key={cfg.id}
                    selected={shelvingConfigId === cfg.id}
                    onSelect={() => onShelvingConfigChange(shelvingConfigId === cfg.id ? null : cfg.id)}
                    className="w-full"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-zinc-300">{cfg.widthFt}&apos; Wide × {heightLabel}</div>
                        <div className="mt-0.5 text-[10px] text-zinc-500">
                          {cfg.widthIn}&quot; × {cfg.frameH}&quot; — {shelfText}
                        </div>
                      </div>
                    </div>
                  </SelectionCard>
                );
              })}

              {shelvingConfigId && shelvingPrice != null && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.25 }}
                  className="mt-1"
                >
                  <div className="flex items-center gap-3 border-t border-zinc-800 pt-3">
                    <div className="flex-1 text-center">
                      <div className="text-2xl font-black text-white">
                        {shelvingLoading ? "..." : <RollingPrice value={shelvingPrice} />}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400/60">
                        Open Shelving
                      </div>
                    </div>
                    <motion.button
                      onClick={onAddShelvingUnit}
                      disabled={shelvingLoading}
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
              {shelvingConfigId && shelvingPrice == null && shelvingLoading && (
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
