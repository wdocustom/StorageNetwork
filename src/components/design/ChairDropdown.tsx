"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Plus, Minus } from "lucide-react";
import {
  type ChairConfig,
  type ChairFinish,
  CHAIR_FINISHES,
  getChairDescription,
} from "@/lib/chairs";
import {
  calculateChairPriceServer,
  getChairOptionPrices,
} from "@/app/actions/platform-defaults";
import { RollingPrice } from "./configurator-primitives";

// ═══════════════════════════════════════════════════════════════════════════
// Low Boy Adirondack Chair Dropdown — Design Configurator
//
// Collapsible section for adding handmade Adirondack chairs to an order.
// Supports: finish selection (natural/white/black), quantity (1-4).
// ═══════════════════════════════════════════════════════════════════════════

interface ChairDropdownProps {
  onAddChair: (config: ChairConfig, price: number, desc: string) => void;
  onConfigPreview?: (preview: { finish: string } | null) => void;
  onPriceChange?: (price: number | null) => void;
  installerPricing?: Record<string, unknown>;
  defaultExpanded?: boolean;
}

export default function ChairDropdown({
  onAddChair,
  onConfigPreview,
  onPriceChange,
  installerPricing,
  defaultExpanded = false,
}: ChairDropdownProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Config state
  const [finish, setFinish] = useState<ChairFinish>("natural");
  const [quantity, setQuantity] = useState(1);

  // Fetch option prices from server on mount
  const [optionPrices, setOptionPrices] = useState<Awaited<
    ReturnType<typeof getChairOptionPrices>
  > | null>(null);
  useEffect(() => {
    getChairOptionPrices(installerPricing).then(setOptionPrices);
  }, [installerPricing]);

  // Calculate price via server action
  const [calculation, setCalculation] = useState<{
    total: number;
    breakdown: { label: string; amount: number }[];
  } | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  useEffect(() => {
    if (!expanded) {
      setCalculation(null);
      onPriceChange?.(null);
      return;
    }
    let cancelled = false;
    setPriceLoading(true);
    calculateChairPriceServer({ finish, quantity, installerPricing })
      .then((result) => {
        if (!cancelled) {
          setCalculation(result);
          setPriceLoading(false);
          onPriceChange?.(result.total);
        }
      })
      .catch(() => {
        if (!cancelled) setPriceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [finish, quantity, installerPricing, expanded]);

  // Notify parent of live config for 3D preview
  useEffect(() => {
    if (!expanded) {
      onConfigPreview?.(null);
      return;
    }
    onConfigPreview?.({ finish });
  }, [finish, expanded, onConfigPreview]);

  const handleAdd = useCallback(() => {
    if (!calculation) return;
    const config: ChairConfig = { finish, quantity };
    const desc = getChairDescription(config);
    onAddChair(config, calculation.total, desc);
    // Reset to defaults
    onPriceChange?.(null);
    setFinish("natural");
    setQuantity(1);
  }, [calculation, finish, quantity, onAddChair, onPriceChange]);

  return (
    <section className="rounded-2xl border border-slate-700/50 bg-slate-900/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-3 transition-colors hover:bg-slate-800/40"
      >
        <span className="flex-1 text-left text-sm font-medium text-slate-300">
          Low Boy Adirondack Chair
        </span>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
        >
          <ChevronDown className="h-4 w-4 text-slate-500" />
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
              {/* ── Finish ─────────────────────────────────────────── */}
              <div>
                <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  Finish
                </label>
                <div className="flex gap-1.5">
                  {CHAIR_FINISHES.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFinish(f.id)}
                      className={`flex flex-1 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all ${
                        finish === f.id
                          ? "ring-2 ring-yellow-400 border-yellow-400 bg-yellow-400/10"
                          : "border-slate-700 bg-slate-800/60 hover:border-slate-600"
                      }`}
                    >
                      <div
                        className="h-8 w-8 shrink-0 rounded-full"
                        style={{ backgroundColor: f.hex }}
                      />
                      <div>
                        <p
                          className={`text-xs font-bold ${
                            finish === f.id
                              ? "text-yellow-400"
                              : "text-slate-300"
                          }`}
                        >
                          {f.label}
                        </p>
                        {f.id !== "natural" && optionPrices && (
                          <p className="text-[10px] text-slate-500">
                            +${optionPrices.paintAddon}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Quantity ────────────────────────────────────────── */}
              <div>
                <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  Quantity
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300 transition-colors hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[2rem] text-center text-sm font-bold text-slate-200">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(4, q + 1))}
                    disabled={quantity >= 4}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300 transition-colors hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* ── Price Breakdown + Add Button ────────────────────── */}
              {calculation && (
                <div className="space-y-2 pt-1">
                  <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 space-y-1">
                    {calculation.breakdown.map((b, i) => (
                      <div key={i} className="flex justify-between text-[11px]">
                        <span className="text-slate-400">{b.label}</span>
                        <span className="text-slate-300 font-semibold">
                          ${b.amount}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-700 mt-1">
                      <span className="text-white">Total</span>
                      <RollingPrice value={calculation.total} />
                    </div>
                  </div>

                  <motion.button
                    type="button"
                    onClick={handleAdd}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-950 transition-colors hover:bg-yellow-300"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Plus className="h-4 w-4" />
                    Add to Order
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
