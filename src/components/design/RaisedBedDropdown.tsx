"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Sprout, Plus, Loader2, Star } from "lucide-react";
import {
  RAISED_BED_SIZES,
  PEST_COVER_OPTIONS,
  getRaisedBedDescription,
  type RaisedBedConfig,
  type RaisedBedFinish,
  type PestCoverType,
} from "@/lib/raised-beds";
import { calculateRaisedBedPriceServer, getRaisedBedOptionPrices } from "@/app/actions/platform-defaults";
import { RollingPrice } from "./configurator-primitives";
import type { InstallerPricing } from "@/types/viewModels";

// ═══════════════════════════════════════════════════════════════════════════
// Raised Bed Planter Dropdown — Design Configurator Step 1
//
// Collapsible section for configuring handmade cedar raised bed planters.
// Supports: size selection, finish, depth increase, bottom shelf,
// pest protection covers. Calculates total price and adds to order.
// ═══════════════════════════════════════════════════════════════════════════

interface RaisedBedDropdownProps {
  onAddRaisedBed: (config: RaisedBedConfig, price: number, desc: string) => void;
  onConfigPreview?: (preview: { widthIn: number; lengthIn: number; heightIn: number; hasLegs: boolean; groundClearance: number; pestCover: string; finish: string; hasStringLightPost?: boolean; postHeightIn?: number } | null) => void;
  onPriceChange?: (price: number | null) => void;
  installerPricing?: InstallerPricing;
  defaultExpanded?: boolean;
}

export default function RaisedBedDropdown({
  onAddRaisedBed,
  onConfigPreview,
  onPriceChange,
  installerPricing,
  defaultExpanded = false,
}: RaisedBedDropdownProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Config state
  const DEFAULT_ELEVATED = "legs_24x24x16_post";
  const DEFAULT_GROUND = "ground_18x72x22";

  const [style, setStyle] = useState<"with_legs" | "without_legs">("without_legs");
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [finish, setFinish] = useState<RaisedBedFinish>("natural");
  const [hasLiner, setHasLiner] = useState(false);
  const [depthIncrease, setDepthIncrease] = useState(false);
  const [bottomShelf, setBottomShelf] = useState(false);
  const [pestCover, setPestCover] = useState<PestCoverType>("none");
  const [postHeight, setPostHeight] = useState<number | null>(null);
  const [hasHook, setHasHook] = useState(false);
  const [highWindWeighted, setHighWindWeighted] = useState(false);

  const selectedBed = sizeId ? RAISED_BED_SIZES.find((s) => s.id === sizeId) : null;
  const filteredSizes = RAISED_BED_SIZES.filter((s) => s.style === style);
  const bestsellerSizes = filteredSizes.filter((s) => s.bestseller);
  const standardSizes = filteredSizes.filter((s) => !s.bestseller);

  // Fetch option prices from server when size changes
  const [optionPrices, setOptionPrices] = useState<Awaited<ReturnType<typeof getRaisedBedOptionPrices>>>(null);
  useEffect(() => {
    if (!sizeId) { setOptionPrices(null); return; }
    getRaisedBedOptionPrices(sizeId, installerPricing).then(setOptionPrices);
  }, [sizeId, installerPricing]);

  // Calculate price via server action
  const [calculation, setCalculation] = useState<{ total: number; breakdown: { label: string; amount: number }[] } | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  useEffect(() => {
    if (!sizeId || !expanded) { setCalculation(null); onPriceChange?.(null); return; }
    let cancelled = false;
    setPriceLoading(true);
    calculateRaisedBedPriceServer({ sizeId, finish, hasLiner, depthIncrease, bottomShelf, pestCover, postHeight, hasHook, highWindWeighted, installerPricing })
      .then((result) => { if (!cancelled) { setCalculation(result); setPriceLoading(false); onPriceChange?.(result.total); } })
      .catch(() => { if (!cancelled) setPriceLoading(false); });
    return () => { cancelled = true; };
  }, [sizeId, finish, hasLiner, depthIncrease, bottomShelf, pestCover, postHeight, hasHook, highWindWeighted, installerPricing, expanded]);

  // Notify parent of live config for 3D preview on every change
  useEffect(() => {
    if (!sizeId || !expanded) {
      onConfigPreview?.(null);
      return;
    }
    const bed = RAISED_BED_SIZES.find((s) => s.id === sizeId);
    if (!bed) { onConfigPreview?.(null); return; }
    onConfigPreview?.({
      widthIn: bed.widthIn,
      lengthIn: bed.lengthIn,
      heightIn: bed.heightIn,
      hasLegs: bed.style === "with_legs",
      groundClearance: bed.groundClearance,
      pestCover,
      finish,
      hasStringLightPost: bed.hasStringLightPost || !!postHeight,
      postHeightIn: bed.postHeightIn || postHeight || undefined,
    });
  }, [sizeId, finish, pestCover, postHeight, expanded, onConfigPreview]);

  const handleSizeChange = (id: string | null) => {
    setSizeId(id);
    setHasLiner(false);
    setDepthIncrease(false);
    setBottomShelf(false);
    setPestCover("none");
    setFinish("natural");
    setPostHeight(null);
    setHasHook(false);
    setHighWindWeighted(false);
  };

  const handleStyleChange = (s: "with_legs" | "without_legs") => {
    setStyle(s);
    setSizeId(s === "with_legs" ? DEFAULT_ELEVATED : DEFAULT_GROUND);
    setHasLiner(false);
    setDepthIncrease(false);
    setBottomShelf(false);
    setPestCover("none");
    setFinish("natural");
    setPostHeight(null);
    setHasHook(false);
    setHighWindWeighted(false);
  };

  function handleAdd() {
    if (!sizeId || !calculation) return;
    const config: RaisedBedConfig = { sizeId, finish, hasLiner, depthIncrease, bottomShelf, pestCover, postHeight, hasHook, highWindWeighted };
    const desc = getRaisedBedDescription(config);
    onAddRaisedBed(config, calculation.total, desc);
    // Reset to current style's default
    onPriceChange?.(null);
    setSizeId(style === "with_legs" ? DEFAULT_ELEVATED : DEFAULT_GROUND);
    setFinish("natural");
    setHasLiner(false);
    setDepthIncrease(false);
    setBottomShelf(false);
    setPestCover("none");
    setPostHeight(null);
    setHasHook(false);
    setHighWindWeighted(false);
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

              {/* Size Selection — Bestsellers first, then other sizes */}
              <div className="space-y-3">
                {bestsellerSizes.length > 0 && (
                  <div>
                    <label className="mb-1.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-yellow-400">
                      <Star className="h-2.5 w-2.5" /> Bestsellers
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {bestsellerSizes.map((bed) => (
                        <button
                          key={bed.id}
                          type="button"
                          onClick={() => handleSizeChange(sizeId === bed.id ? null : bed.id)}
                          className={`relative rounded-lg border px-3 py-2.5 text-left transition-all ${
                            sizeId === bed.id
                              ? "border-yellow-400 bg-yellow-400/10"
                              : "border-yellow-400/40 bg-yellow-400/5 hover:border-yellow-400/70"
                          }`}
                        >
                          {bed.hasStringLightPost && (
                            <span className="absolute -top-2 left-2 rounded-full bg-emerald-400 px-1.5 py-0.5 text-[8px] font-black text-zinc-900 uppercase">
                              String Light
                            </span>
                          )}
                          <p className={`text-xs font-bold ${sizeId === bed.id ? "text-yellow-400" : "text-zinc-300"}`}>
                            {bed.widthIn}" × {bed.lengthIn}"
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            {bed.hasStringLightPost ? "16.5\" + 7' post & cap" : `${bed.heightIn}" tall`}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {standardSizes.length > 0 && (
                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                      {bestsellerSizes.length > 0 ? "All Other Sizes" : "Size"}
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {standardSizes.map((bed) => (
                        <button
                          key={bed.id}
                          type="button"
                          onClick={() => handleSizeChange(sizeId === bed.id ? null : bed.id)}
                          className={`relative rounded-lg border px-3 py-2.5 text-left transition-all ${
                            sizeId === bed.id
                              ? "border-yellow-400 bg-yellow-400/10"
                              : "border-zinc-700 bg-zinc-800/60 hover:border-zinc-600"
                          }`}
                        >
                          <p className={`text-xs font-bold ${sizeId === bed.id ? "text-yellow-400" : "text-zinc-300"}`}>
                            {bed.widthIn}" × {bed.lengthIn}"
                          </p>
                          <p className="text-[10px] text-zinc-500">{bed.heightIn}" tall</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Options — only show when a size is selected */}
              {selectedBed && (
                <>
                  {/* ── Finish ─────────────────────────────────────────── */}
                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                      Finish
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([
                        { id: "natural" as RaisedBedFinish, label: "Natural Cedar", price: 0 },
                        { id: "stain" as RaisedBedFinish, label: "Cedar Stain", price: optionPrices?.stainPrice ?? 0 },
                        { id: "painted_white" as RaisedBedFinish, label: "Painted White", price: optionPrices?.paintedWhitePrice ?? 0 },
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

                  {/* ── Add-ons ────────────────────────────────────────── */}
                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                      Add-ons
                    </label>
                    <div className="space-y-1.5">
                      {/* Landscape Liner */}
                      <label className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 cursor-pointer hover:border-zinc-600 transition-colors">
                        <div>
                          <p className="text-xs font-bold text-zinc-300">Landscape Liner</p>
                          <p className="text-[10px] text-zinc-500">+${optionPrices?.linerPrice ?? 0}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={hasLiner}
                          onChange={(e) => setHasLiner(e.target.checked)}
                          className="accent-yellow-400"
                        />
                      </label>

                      {/* Depth Increase */}
                      {selectedBed.depthIncreaseAvailable && (
                        <label className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 cursor-pointer hover:border-zinc-600 transition-colors">
                          <div>
                            <p className="text-xs font-bold text-zinc-300">Increase Planting Depth to 12"</p>
                            <p className="text-[10px] text-zinc-500">+${optionPrices?.depthIncreasePrice ?? 0}</p>
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
                            <p className="text-xs font-bold text-zinc-300">Bottom Shelf</p>
                            <p className="text-[10px] text-zinc-500">+${optionPrices?.bottomShelfPrice ?? 0}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={bottomShelf}
                            onChange={(e) => setBottomShelf(e.target.checked)}
                            className="accent-yellow-400"
                          />
                        </label>
                      )}

                      {/* Post Add-on */}
                      {selectedBed.postAddonAvailable && (
                        <div className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2.5">
                          <p className="text-xs font-bold text-zinc-300 mb-1.5">Post</p>
                          <div className="grid grid-cols-4 gap-1.5">
                            {([
                              { value: null, label: "None", price: 0 },
                              { value: 72, label: "6'", price: optionPrices?.post72Price ?? 0 },
                              { value: 84, label: "7'", price: optionPrices?.post84Price ?? 0 },
                              { value: 96, label: "8'", price: optionPrices?.post96Price ?? 0 },
                            ] as const).map((opt) => (
                              <button
                                key={opt.label}
                                type="button"
                                onClick={() => {
                                  setPostHeight(opt.value);
                                  if (!opt.value) setHasHook(false);
                                }}
                                className={`rounded-lg border px-2 py-1.5 text-center transition-all ${
                                  postHeight === opt.value
                                    ? "border-yellow-400 bg-yellow-400/10"
                                    : "border-zinc-600 bg-zinc-800 hover:border-zinc-500"
                                }`}
                              >
                                <p className={`text-[11px] font-bold ${postHeight === opt.value ? "text-yellow-400" : "text-zinc-300"}`}>
                                  {opt.label}
                                </p>
                                {opt.price > 0 && (
                                  <p className="text-[9px] text-zinc-500">+${opt.price}</p>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Hook — only available when a post is selected */}
                      {selectedBed.postAddonAvailable && postHeight && (
                        <label className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 cursor-pointer hover:border-zinc-600 transition-colors">
                          <div>
                            <p className="text-xs font-bold text-zinc-300">Hook</p>
                            <p className="text-[10px] text-zinc-500">+${optionPrices?.hookPrice ?? 0}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={hasHook}
                            onChange={(e) => setHasHook(e.target.checked)}
                            className="accent-yellow-400"
                          />
                        </label>
                      )}

                      {/* High-Wind Weighted Kit — elevated planters only */}
                      {selectedBed.highWindWeightedAvailable && (
                        <label className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 cursor-pointer hover:border-zinc-600 transition-colors">
                          <div>
                            <p className="text-xs font-bold text-zinc-300">High-Wind Weighted Kit</p>
                            <p className="text-[10px] text-zinc-500">+${optionPrices?.highWindWeightedPrice ?? 0} &middot; Anchors base against tipping</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={highWindWeighted}
                            onChange={(e) => setHighWindWeighted(e.target.checked)}
                            className="accent-yellow-400"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Pest Protection */}
                  {selectedBed.pestCoverCategory !== "none" && (
                    <div>
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                        Pest Protection (optional)
                      </label>
                      <div className="space-y-1.5">
                        {PEST_COVER_OPTIONS.map((cover) => {
                          const isLarge = selectedBed.pestCoverCategory === "2x6";
                          const coverPrices = cover.id !== "none" && optionPrices?.pestCovers?.[cover.id];
                          const price = coverPrices ? (isLarge ? coverPrices.price_2x6 : coverPrices.price_2x4) : 0;
                          const totalCoverPrice = price;

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
