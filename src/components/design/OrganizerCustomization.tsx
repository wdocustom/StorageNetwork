"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Grid3X3,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  X,
  DoorOpen,
  PanelLeft,
  Minus,
  Layers,
  Paintbrush,
} from "lucide-react";
import type { SectionAddon, AddonPricing, PaintColorId } from "@/types/viewModels";
import { PAINT_COLORS } from "@/types/viewModels";
import { PaintSwatch, PaintColorPicker } from "./PaintPicker";
import { AddonToggleBtn } from "./configurator-primitives";

export function OrganizerCustomization({
  cols,
  rows,
  addons,
  onAddonsChange,
  addonPricing,
  addonDefaults,
  paintFrameColor,
  paintDoorColor,
  paintSidePanelColor,
  onPaintFrameColorChange,
  onPaintDoorColorChange,
  onPaintSidePanelColorChange,
}: {
  cols: number;
  rows: number;
  addons: SectionAddon[];
  onAddonsChange: (addons: SectionAddon[]) => void;
  addonPricing?: AddonPricing;
  addonDefaults?: { plywood_door: number; side_panel: number; concealed_hinge_pair: number; rail_removal: number; shelf: number; paint_frame_price: number; paint_doors_panels_price: number };
  paintFrameColor: PaintColorId | null;
  paintDoorColor: PaintColorId | null;
  paintSidePanelColor: PaintColorId | null;
  onPaintFrameColorChange: (c: PaintColorId | null) => void;
  onPaintDoorColorChange: (c: PaintColorId | null) => void;
  onPaintSidePanelColorChange: (c: PaintColorId | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [railGridOpen, setRailGridOpen] = useState(false);
  const [activeCell, setActiveCell] = useState<{ col: number; row: number } | null>(null);

  const doorPrice = addonPricing?.plywood_door ?? addonDefaults?.plywood_door ?? 0;
  const sidePanelPrice = addonPricing?.side_panel ?? addonDefaults?.side_panel ?? 0;
  const railRemovalPrice = addonPricing?.rail_removal ?? addonDefaults?.rail_removal ?? 0;
  const shelfPrice = addonPricing?.shelf ?? addonDefaults?.shelf ?? 0;

  const showDoor = addonPricing?.plywood_door_enabled !== false;
  const showSidePanel = addonPricing?.side_panel_enabled !== false;
  const showRailRemoval = addonPricing?.rail_removal_enabled !== false;
  const showShelf = addonPricing?.shelf_enabled !== false;
  const showSlotGrid = showRailRemoval || showShelf;
  const showPaint = addonPricing?.paint_enabled !== false;
  const paintFramePrice = addonPricing?.paint_frame_price ?? addonDefaults?.paint_frame_price ?? 0;
  const paintDoorsPanelsPrice = addonPricing?.paint_doors_panels_price ?? addonDefaults?.paint_doors_panels_price ?? 0;

  // Doors: total price = per-door price × number of columns
  const doorsTotalPrice = doorPrice * cols;
  const doorsOn = addons.some((a) => a.type === "plywood_door" && a.target === "doors_on");

  // Helper: check if an addon exists for a given type/target/row
  function hasAddon(type: SectionAddon["type"], target: SectionAddon["target"], row?: number): boolean {
    return addons.some((a) =>
      a.type === type && a.target === target && (row === undefined || a.row === row)
    );
  }

  // Toggle an addon on/off
  function toggleAddon(type: SectionAddon["type"], target: SectionAddon["target"], row?: number) {
    if (hasAddon(type, target, row)) {
      const updated = addons.filter((a) =>
        !(a.type === type && a.target === target && (row === undefined || a.row === row))
      );
      onAddonsChange(updated);
      // Clear side panel paint if both panels are now removed
      if (type === "side_panel") {
        const hasLeftAfter = updated.some((a) => a.type === "side_panel" && a.target === "left");
        const hasRightAfter = updated.some((a) => a.type === "side_panel" && a.target === "right");
        if (!hasLeftAfter && !hasRightAfter) {
          onPaintSidePanelColorChange(null);
        }
      }
    } else {
      onAddonsChange([...addons, { type, target, row }]);
    }
  }

  // Toggle doors on/off for the whole unit
  function toggleDoors() {
    if (doorsOn) {
      onAddonsChange(addons.filter((a) => !(a.type === "plywood_door" && a.target === "doors_on")));
      onPaintDoorColorChange(null);
    } else {
      onAddonsChange([...addons, { type: "plywood_door", target: "doors_on" }]);
    }
  }

  const addonCount = addons.length;

  function getCellAddons(col: number, row: number) {
    return addons.filter((a) => (a.type === "rail_removed" || a.type === "shelf") && typeof a.target === "number" && a.target === col && (a.row === undefined || a.row === row));
  }

  if (cols < 1 || rows < 1) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded-xl border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 transition-colors hover:border-zinc-600 hover:bg-zinc-800/50"
      >
        <Grid3X3 className="h-4 w-4 text-yellow-400" />
        <span className="flex-1 text-left text-sm font-medium text-zinc-300">
          Organizer Customization
        </span>
        {addonCount > 0 && (
          <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
            {addonCount}
          </span>
        )}
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-zinc-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/60 p-3 space-y-3">
              {/* Doors — toggle + paint color circles inside the box */}
              {showDoor && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Doors
                  </p>
                  <button
                    type="button"
                    onClick={toggleDoors}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                      doorsOn
                        ? "border-yellow-400/50 bg-yellow-400/10"
                        : "border-zinc-700 bg-zinc-800/30 hover:border-zinc-600"
                    }`}
                  >
                    <motion.div
                      className={`relative h-5 w-9 shrink-0 rounded-full ${doorsOn ? "bg-yellow-400" : "bg-zinc-700"}`}
                      animate={{ backgroundColor: doorsOn ? "#facc15" : "#3f3f46" }}
                      transition={{ duration: 0.2 }}
                    >
                      <motion.div
                        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm"
                        animate={{ left: doorsOn ? 18 : 2 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <DoorOpen className={`h-3.5 w-3.5 ${doorsOn ? "text-yellow-400" : "text-zinc-500"}`} />
                        <span className={`text-sm font-medium ${doorsOn ? "text-yellow-300" : "text-zinc-400"}`}>
                          Plywood Doors
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        {cols} door{cols !== 1 ? "s" : ""} with Blum concealed hinges &middot; +${doorsTotalPrice}
                      </p>
                    </div>
                    {/* Paint color circles for doors — inline horizontal */}
                    {showPaint && doorsOn && (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {PAINT_COLORS.map((c) => (
                          <PaintSwatch
                            key={c.id}
                            colorId={c.id}
                            hex={c.hex}
                            active={paintDoorColor === c.id}
                            onSelect={() => onPaintDoorColorChange(paintDoorColor === c.id ? null : c.id)}
                          />
                        ))}
                        {paintDoorColor && (
                          <span className="ml-1 text-[9px] font-medium text-yellow-400/80">+${paintDoorsPanelsPrice}</span>
                        )}
                      </div>
                    )}
                  </button>
                </div>
              )}

              {/* Side Panel Buttons — paint circles inside the Left box, applies to both */}
              {showSidePanel && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Side Panels
                  </p>
                  <div className="flex gap-2">
                    {/* Left panel — includes shared paint color circles */}
                    <button
                      type="button"
                      onClick={() => toggleAddon("side_panel", "left")}
                      className={`flex flex-1 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-all ${
                        hasAddon("side_panel", "left")
                          ? "border-yellow-400/50 bg-yellow-400/10 text-yellow-300"
                          : "border-zinc-700 bg-zinc-800/30 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
                      }`}
                    >
                      <PanelLeft className="h-3.5 w-3.5" />
                      <span className="flex-1">{`Left (+$${sidePanelPrice})`}</span>
                      {/* Paint circles — shown when either panel is active */}
                      {showPaint && (hasAddon("side_panel", "left") || hasAddon("side_panel", "right")) && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {PAINT_COLORS.map((c) => (
                            <PaintSwatch
                              key={c.id}
                              colorId={c.id}
                              hex={c.hex}
                              active={paintSidePanelColor === c.id}
                              onSelect={() => onPaintSidePanelColorChange(paintSidePanelColor === c.id ? null : c.id)}
                            />
                          ))}
                          {paintSidePanelColor && (
                            <span className="ml-1 text-[9px] font-medium text-yellow-400/80">+${paintDoorsPanelsPrice}</span>
                          )}
                        </div>
                      )}
                    </button>
                    {/* Right panel */}
                    <AddonToggleBtn
                      icon={<PanelLeft className="h-3.5 w-3.5 scale-x-[-1]" />}
                      label={`Right (+$${sidePanelPrice})`}
                      active={hasAddon("side_panel", "right")}
                      onToggle={() => toggleAddon("side_panel", "right")}
                    />
                  </div>
                </div>
              )}

              {/* Paint — Frame color + Color All shortcut */}
              {showPaint && (
                <div className="border-t border-zinc-700/40 pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Paintbrush className="h-3.5 w-3.5 text-rose-400" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      Paint
                    </p>
                  </div>
                  <div className="space-y-2.5">
                    {/* Frame color */}
                    <PaintColorPicker
                      label="Frame"
                      activeColor={paintFrameColor}
                      onColorChange={onPaintFrameColorChange}
                      price={paintFramePrice}
                    />

                    {/* Color All shortcut — sets frame, door, and panel to the same color */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide min-w-[42px]">All</span>
                      <div className="flex items-center gap-1.5">
                        {PAINT_COLORS.map((c) => {
                          const allMatch = paintFrameColor === c.id
                            && (!doorsOn || paintDoorColor === c.id)
                            && ((!hasAddon("side_panel", "left") && !hasAddon("side_panel", "right")) || paintSidePanelColor === c.id);
                          return (
                            <PaintSwatch
                              key={c.id}
                              colorId={c.id}
                              hex={c.hex}
                              active={allMatch}
                              onSelect={() => {
                                if (allMatch) {
                                  onPaintFrameColorChange(null);
                                  onPaintDoorColorChange(null);
                                  onPaintSidePanelColorChange(null);
                                } else {
                                  onPaintFrameColorChange(c.id);
                                  if (doorsOn) onPaintDoorColorChange(c.id);
                                  if (hasAddon("side_panel", "left") || hasAddon("side_panel", "right")) onPaintSidePanelColorChange(c.id);
                                }
                              }}
                            />
                          );
                        })}
                      </div>
                      {paintFrameColor && (
                        <span className="ml-auto text-[10px] font-medium text-yellow-400/80">
                          +${paintFramePrice + (doorsOn && paintDoorColor ? paintDoorsPanelsPrice : 0) + ((hasAddon("side_panel", "left") || hasAddon("side_panel", "right")) && paintSidePanelColor ? paintDoorsPanelsPrice : 0)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Per-slot customization — collapsible grid (rail removal + shelf) */}
              {showSlotGrid && (
                <div>
                  <button
                    type="button"
                    onClick={() => { setRailGridOpen(!railGridOpen); if (railGridOpen) setActiveCell(null); }}
                    className="mb-1 flex w-full items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-400 transition-colors"
                  >
                    {railGridOpen ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    Tap a slot to customize
                  </button>
                  <AnimatePresence>
                    {railGridOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="grid gap-1 mt-1" style={{ gridTemplateColumns: `repeat(${Math.min(cols, 8)}, 1fr)` }}>
                          {Array.from({ length: Math.min(rows, 10) }).map((_, ri) => {
                            const r = Math.min(rows, 10) - 1 - ri;
                            return Array.from({ length: Math.min(cols, 8) }).map((_, c) => {
                              const cellAddons = getCellAddons(c, r);
                              const hasRailRemoved = cellAddons.some((a) => a.type === "rail_removed");
                              const hasShelf = cellAddons.some((a) => a.type === "shelf");
                              const isActive = activeCell?.col === c && activeCell?.row === r;
                              return (
                                <button
                                  key={`cell-${c}-${r}`}
                                  type="button"
                                  onClick={() => setActiveCell(isActive ? null : { col: c, row: r })}
                                  className={`relative rounded-md border py-1.5 text-[9px] font-bold transition-all ${
                                    isActive
                                      ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                                      : hasRailRemoved
                                      ? "border-red-500/40 bg-red-500/10 text-red-400"
                                      : hasShelf
                                      ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
                                      : "border-zinc-700 bg-zinc-800/50 text-zinc-600 hover:border-zinc-600"
                                  }`}
                                >
                                  {hasRailRemoved ? <Minus className="mx-auto h-3 w-3" /> : hasShelf ? <Layers className="mx-auto h-3 w-3" /> : `${r + 1},${c + 1}`}
                                </button>
                              );
                            });
                          })}
                        </div>

                        {/* Active cell customization menu */}
                        <AnimatePresence>
                          {activeCell && (
                            <motion.div
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              className="mt-2 rounded-lg border border-zinc-700 bg-zinc-800/80 p-3 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-zinc-300">
                                  Row {activeCell.row + 1}, Bay {activeCell.col + 1}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setActiveCell(null)}
                                  className="text-zinc-500 hover:text-zinc-300"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              {showRailRemoval && (
                                <AddonToggleBtn
                                  icon={<Minus className="h-3.5 w-3.5" />}
                                  label="Remove Rails"
                                  price={railRemovalPrice}
                                  active={hasAddon("rail_removed", activeCell.col, activeCell.row)}
                                  onToggle={() => toggleAddon("rail_removed", activeCell.col, activeCell.row)}
                                />
                              )}
                              {showShelf && activeCell.row < rows - 1 && (
                                <AddonToggleBtn
                                  icon={<Layers className="h-3.5 w-3.5" />}
                                  label="Add Shelf"
                                  price={shelfPrice}
                                  active={hasAddon("shelf", activeCell.col, activeCell.row)}
                                  onToggle={() => toggleAddon("shelf", activeCell.col, activeCell.row)}
                                />
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Addon Summary */}
              {addonCount > 0 && (
                <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">{addonCount} add-on{addonCount !== 1 ? "s" : ""} selected</span>
                    <button
                      type="button"
                      onClick={() => onAddonsChange([])}
                      className="text-[10px] font-medium text-red-400 hover:text-red-300"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
