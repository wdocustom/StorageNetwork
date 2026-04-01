"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import type { UnitConfig, ConfiguratorSidebarProps } from "./configurator-types";
import type { AddonPricing, PaintColorId } from "@/types/viewModels";
import { PAINT_COLORS } from "@/types/viewModels";
import { OVERHEAD_GRID_PRESETS } from "@/lib/overhead-storage";

export default function OrderItemCard({
  item,
  index,
  onRemove,
  pricing,
  platformDefaults,
  addonPricing,
  addonDefaults,
}: {
  item: UnitConfig;
  index: number;
  onRemove: () => void;
  pricing?: ConfiguratorSidebarProps["pricing"];
  platformDefaults: ConfiguratorSidebarProps["platformDefaults"];
  addonPricing?: AddonPricing;
  addonDefaults?: { plywood_door: number; side_panel: number; concealed_hinge_pair: number; rail_removal: number; shelf: number; paint_frame_price: number; paint_doors_panels_price: number };
}) {
  const [expanded, setExpanded] = useState(false);

  // Build add-on list with prices
  const addOnItems: { label: string; price: number }[] = [];

  const isOverhead = !!item.overheadStorageConfig;
  const slots = isOverhead ? 0 : item.cols * item.rows;

  if (item.hasTotes) {
    if (isOverhead) {
      // Overhead tote pricing — use grid preset tote count
      const cfg = item.overheadStorageConfig!;
      const preset = OVERHEAD_GRID_PRESETS.find((p) => p.id === cfg.gridPresetId);
      const toteCount = preset?.toteCount ?? 0;
      const totePrice = pricing?.standard_tote ?? platformDefaults.standard_tote;
      addOnItems.push({ label: "Totes", price: toteCount * totePrice });
    } else {
      let totePrice: number;
      if (item.toteType === "HDX" && item.unitType === "standard" && item.toteColor === "clear") {
        totePrice = pricing?.standard_tote_clear ?? platformDefaults.standard_tote_clear;
      } else if (item.unitType === "mini") {
        totePrice = pricing?.mini_tote ?? platformDefaults.mini_tote;
      } else {
        totePrice = pricing?.standard_tote ?? platformDefaults.standard_tote;
      }
      const label = (item.toteType === "HDX" && item.unitType === "standard" && item.toteColor === "clear") ? "Clear Totes" : "Totes";
      addOnItems.push({ label, price: slots * totePrice });
    }
  }
  if (item.hasWheels) {
    const wheelsPrice = item.unitType === "mini"
      ? (pricing?.mini_wheels ?? platformDefaults.mini_wheels)
      : (pricing?.standard_wheels ?? platformDefaults.standard_wheels);
    addOnItems.push({ label: "Wheels", price: wheelsPrice });
  }
  if (item.hasTop) {
    const topUnitPrice = pricing?.plywood_top ?? platformDefaults.plywood_top;
    let topSheets: number;
    if (item.unitType === "mini") {
      topSheets = 1;
    } else {
      if (item.totalW > 192) topSheets = 3;
      else if (item.totalW > 96) topSheets = 2;
      else topSheets = 1;
    }
    addOnItems.push({ label: "Plywood Top", price: topSheets * topUnitPrice });
  }

  const ap = addonPricing;
  const shelfCount = item.addons?.filter((a) => a.type === "shelf").length ?? 0;
  if (shelfCount > 0) {
    const shelfPrice = ap?.shelf ?? addonDefaults?.shelf ?? 0;
    addOnItems.push({ label: `${shelfCount} Shelf${shelfCount !== 1 ? "s" : ""}`, price: shelfCount * shelfPrice });
  }
  const railRemovedCount = item.addons?.filter((a) => a.type === "rail_removed").length ?? 0;
  if (railRemovedCount > 0) {
    const railPrice = ap?.rail_removal ?? addonDefaults?.rail_removal ?? 0;
    addOnItems.push({ label: `${railRemovedCount} Rail${railRemovedCount !== 1 ? "s" : ""} Removed`, price: railRemovedCount * railPrice });
  }
  const doorAddons = item.addons?.filter((a) => a.type === "plywood_door") ?? [];
  if (doorAddons.length > 0) {
    const doorPrice = ap?.plywood_door ?? addonDefaults?.plywood_door ?? 0;
    const allDoorsOn = doorAddons.some((a) => a.target === "doors_on");
    const totalDoorPrice = allDoorsOn ? doorPrice * item.cols : doorPrice * doorAddons.length;
    addOnItems.push({ label: "Plywood Doors", price: totalDoorPrice });
  }
  const sidePanelCount = item.addons?.filter((a) => a.type === "side_panel").length ?? 0;
  if (sidePanelCount > 0) {
    const panelPrice = ap?.side_panel ?? addonDefaults?.side_panel ?? 0;
    addOnItems.push({ label: `${sidePanelCount} Side Panel${sidePanelCount !== 1 ? "s" : ""}`, price: sidePanelCount * panelPrice });
  }

  // Paint details per component
  const paintLabel = (colorId: PaintColorId) => PAINT_COLORS.find((c) => c.id === colorId)?.label ?? colorId;
  const paintFramePrice = ap?.paint_frame_price ?? addonDefaults?.paint_frame_price ?? 0;
  const paintDoorsPanelsPrice = ap?.paint_doors_panels_price ?? addonDefaults?.paint_doors_panels_price ?? 0;
  if (item.paintFrameColor) addOnItems.push({ label: `Paint Frame: ${paintLabel(item.paintFrameColor)}`, price: paintFramePrice });
  if (item.paintDoorColor) addOnItems.push({ label: `Paint Doors: ${paintLabel(item.paintDoorColor)}`, price: paintDoorsPanelsPrice });
  if (item.paintSidePanelColor) addOnItems.push({ label: `Paint Side Panels: ${paintLabel(item.paintSidePanelColor)}`, price: paintDoorsPanelsPrice });

  const hasAddOns = addOnItems.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-zinc-200">
              Unit #{index + 1}: {item.desc}
            </p>
            {hasAddOns && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-0.5 rounded-full bg-zinc-800 border border-zinc-700/50 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-300"
              >
                {addOnItems.length} add-on{addOnItems.length !== 1 ? "s" : ""}
                <motion.div
                  animate={{ rotate: expanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-2.5 w-2.5" />
                </motion.div>
              </button>
            )}
          </div>
          {!hasAddOns && (
            <p className="text-[11px] text-zinc-500">Frame Only</p>
          )}
          {hasAddOns && !expanded && (
            <p className="text-[11px] text-zinc-500 truncate">
              {addOnItems.map((a) => a.label).join(", ")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className="text-sm font-bold text-white">
            ${item.price.toLocaleString()}
          </span>
          <button
            onClick={onRemove}
            className="text-zinc-600 transition-colors hover:text-red-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expandable add-ons list */}
      <AnimatePresence initial={false}>
        {expanded && hasAddOns && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-zinc-800/60 px-4 pb-3 pt-2">
              <ul className="space-y-1">
                {addOnItems.map((addon, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="h-1 w-1 rounded-full bg-yellow-400/60 shrink-0" />
                      <span className="truncate">{addon.label}</span>
                    </span>
                    {addon.price > 0 && (
                      <span className="shrink-0 text-zinc-500">${addon.price.toLocaleString()}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
