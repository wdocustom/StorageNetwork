"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Sprout, Plus, Loader2, Star } from "lucide-react";
import {
  RAISED_BED_SIZES,
  PEST_COVER_OPTIONS,
  calculateRaisedBedPrice,
  getRaisedBedDescription,
  type RaisedBedConfig,
  type RaisedBedFinish,
  type PestCoverType,
  type RaisedBedSize,
} from "@/lib/raised-beds";
import { RollingPrice } from "./configurator-primitives";

// ═══════════════════════════════════════════════════════════════════════════
// Raised Bed Planter Dropdown — Design Configurator Step 1
//
// Collapsible section for configuring handmade cedar raised bed planters.
// Supports: size selection, finish, depth increase, bottom shelf,
// pest protection covers. Calculates total price and adds to order.
// ═══════════════════════════════════════════════════════════════════════════

interface RaisedBedDropdownProps {
  onAddRaisedBed: (config: RaisedBedConfig, price: number, desc: string) => void;
  onConfigPreview?: (bed: RaisedBedSize | null) => void;
}

export default function RaisedBedDropdown({
  onAddRaisedBed,
  onConfigPreview,
}: RaisedBedDropdownProps) {
  const [expanded, setExpanded] = useState(false);

  // Config state
  const [style, setStyle] = useState<"with_legs" | "without_legs">("without_legs");
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [finish, setFinish] = useState<RaisedBedFinish>("natural");
  const [depthIncrease, setDepthIncrease] = useState(false);
  const [bottomShelf, setBottomShelf] = useState(false);
  const [pestCover, setPestCover] = useState<PestCoverType>("none");

  const selectedBed = sizeId ? RAISED_BED_SIZES.find((s) => s.id === sizeId) : null;
  const filteredSizes = RAISED_BED_SIZES.filter((s) => s.style === style);

  // Calculate price
  const calculation = useMemo(() => {
    if (!sizeId) return null;
    return calculateRaisedBedPrice({ sizeId, finish, depthIncrease, bottomShelf, pestCover });
  }, [sizeId, finish, depthIncrease, bottomShelf, pestCover]);

  // Notify parent for 3D preview
  const handleSizeChange = (id: string | null) => {
    setSizeId(id);
    setDepthIncrease(false);
    setBottomShelf(false);
    setPestCover("none");
    setFinish("natural");
    const bed = id ? RAISED_BED_SIZES.find((s) => s.id === id) : null;
    onConfigPreview?.(bed || null);
  };

  const handleStyleChange = (s: "with_legs" | "without_legs") => {
    setStyle(s);
    setSizeId(null);
    setDepthIncrease(false);
    setBottomShelf(false);
    setPestCover("none");
    onConfigPreview?.(null);
  };

  function handleAdd() {
    if (!sizeId || !calculation) return;
    const config: RaisedBedConfig = { sizeId, finish, depthIncrease, bottomShelf, pestCover };
    const desc = getRaisedBedDescription(config);
    onAddRaisedBed(config, calculation.total, desc);
    // Reset
    setSizeId(null);
    setFinish("natural");
    setDepthIncrease(false);
    setBottomShelf(false);
    setPestCover("none");
    onConfigPreview?.(null);
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-3 transition-colors hover:bg-zinc-800/40"
      >
        <Sprout className="h-4 w-4 text-yellow-400" />
        <span className="flex-1 text-left text-sm font-medium text-zinc-300">
          Raised Bed Planters
        </span>
        {selectedBed && !expanded && (
          <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
            {selectedBed.widthIn}"×{selectedBed.lengthIn}"
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
                Handmade cedar raised bed planters. Select a style and size, then customize finishes and add-ons.
              </p>

              {/* Style Toggle: With Legs vs Ground */}
              <div>
                <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                  Style
                </label>
                <div className="flex gap-1.5">
                  {([
                    { id: "with_legs" as const, label: "Elevated (with legs)" },
                    { id: "without_legs" as const, label: "Ground-Level" },
                  ]).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleStyleChange(s.id)}
                      className={`flex-1 rounded-lg border px-2 py-2 text-center text-xs font-bold transition-all ${
                        style === s.id
                          ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                          : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-600"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size Selection */}
              <div>
                <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                  Size
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {filteredSizes.map((bed) => (
                    <button
                      key={bed.id}
                      type="button"
                      onClick={() => handleSizeChange(bed.id)}
                      className={`relative rounded-lg border px-3 py-2.5 text-left transition-all ${
                        sizeId === bed.id
                          ? "border-yellow-400 bg-yellow-400/10"
                          : "border-zinc-700 bg-zinc-800/60 hover:border-zinc-600"
                      }`}
                    >
                      {bed.popular && (
                        <span className="absolute -top-2 right-2 flex items-center gap-0.5 rounded-full bg-yellow-400 px-1.5 py-0.5 text-[8px] font-black text-zinc-900 uppercase">
                          <Star className="h-2 w-2" /> Popular
                        </span>
                      )}
                      <p className={`text-xs font-bold ${sizeId === bed.id ? "text-yellow-400" : "text-zinc-300"}`}>
                        {bed.widthIn}" × {bed.lengthIn}"
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        {bed.heightIn}" tall · ${bed.basePrice}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Options — only show when a size is selected */}
              {selectedBed && (
                <>
                  {/* Finish */}
                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                      Finish
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([
                        { id: "natural" as RaisedBedFinish, label: "Natural Cedar", price: 0 },
                        { id: "stain" as RaisedBedFinish, label: "Cedar Stain", price: selectedBed.stainPrice },
                        { id: "liner" as RaisedBedFinish, label: "Landscape Liner", price: selectedBed.linerPrice },
                        { id: "painted_white" as RaisedBedFinish, label: "Painted White", price: selectedBed.paintedWhitePrice },
                      ]).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFinish(f.id)}
                          className={`rounded-lg border px-2.5 py-2 text-left transition-all ${
                            finish === f.id
                              ? "border-yellow-400 bg-yellow-400/10"
                              : "border-zinc-700 bg-zinc-800/60 hover:border-zinc-600"
                          }`}
                        >
                          <p className={`text-xs font-bold ${finish === f.id ? "text-yellow-400" : "text-zinc-300"}`}>
                            {f.label}
                          </p>
                          {f.price > 0 && (
                            <p className="text-[10px] text-zinc-500">+${f.price}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Depth Increase */}
                  {selectedBed.depthIncreaseAvailable && (
                    <label className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 cursor-pointer hover:border-zinc-600 transition-colors">
                      <div>
                        <p className="text-xs font-bold text-zinc-300">Increase Planting Depth to 12"</p>
                        <p className="text-[10px] text-zinc-500">+${selectedBed.depthIncreasePrice}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={depthIncrease}
                        onChange={(e) => setDepthIncrease(e.target.checked)}
                        className="accent-yellow-400"
                      />
                    </label>
                  )}

                  {/* Bottom Shelf */}
                  {selectedBed.bottomShelfAvailable && (
                    <label className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 cursor-pointer hover:border-zinc-600 transition-colors">
                      <div>
                        <p className="text-xs font-bold text-zinc-300">Add Bottom Shelf</p>
                        <p className="text-[10px] text-zinc-500">+${selectedBed.bottomShelfPrice}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={bottomShelf}
                        onChange={(e) => setBottomShelf(e.target.checked)}
                        className="accent-yellow-400"
                      />
                    </label>
                  )}

                  {/* Pest Protection */}
                  {selectedBed.pestCoverCategory !== "none" && (
                    <div>
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                        Pest Protection (optional)
                      </label>
                      <div className="space-y-1.5">
                        {PEST_COVER_OPTIONS.map((cover) => {
                          const isLarge = selectedBed.pestCoverCategory === "2x6";
                          const price = cover.id === "none" ? 0 : (isLarge ? cover.price_2x6 : cover.price_2x4);
                          // Add stain addon if finish is stain
                          const stainAddon = finish === "stain" && cover.id !== "none"
                            ? (isLarge ? cover.stainAddon_2x6 : cover.stainAddon_2x4) : 0;
                          const totalCoverPrice = price + stainAddon;

                          return (
                            <button
                              key={cover.id}
                              type="button"
                              onClick={() => setPestCover(cover.id)}
                              className={`w-full rounded-lg border px-3 py-2.5 text-left transition-all ${
                                pestCover === cover.id
                                  ? "border-yellow-400 bg-yellow-400/10"
                                  : "border-zinc-700 bg-zinc-800/60 hover:border-zinc-600"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <p className={`text-xs font-bold ${pestCover === cover.id ? "text-yellow-400" : "text-zinc-300"}`}>
                                  {cover.label}
                                </p>
                                {totalCoverPrice > 0 && (
                                  <span className="text-[10px] text-zinc-500">+${totalCoverPrice}</span>
                                )}
                              </div>
                              <p className="text-[10px] text-zinc-500 mt-0.5">{cover.description}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Price + Add Button */}
                  {calculation && (
                    <div className="space-y-2 pt-1">
                      {/* Price breakdown */}
                      <div className="rounded-lg border border-zinc-700 bg-zinc-800/60 p-3 space-y-1">
                        {calculation.breakdown.map((b, i) => (
                          <div key={i} className="flex justify-between text-[11px]">
                            <span className="text-zinc-400">{b.label}</span>
                            <span className="text-zinc-300 font-semibold">${b.amount}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-bold pt-1 border-t border-zinc-700 mt-1">
                          <span className="text-white">Total</span>
                          <RollingPrice value={calculation.total} />
                        </div>
                      </div>

                      <motion.button
                        type="button"
                        onClick={handleAdd}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-900 transition-colors hover:bg-yellow-300"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Plus className="h-4 w-4" />
                        Add to Order
                      </motion.button>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
