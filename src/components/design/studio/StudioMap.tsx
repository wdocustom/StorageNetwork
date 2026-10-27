"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Studio unit map — every line of the order as a tile, drawn to scale
// (bays 21" wide × tiers 16" tall), lettered A, B, C… Tap a tile to edit that
// unit; "+" adds another. Bestsellers show their sub-units side by side.
// ═══════════════════════════════════════════════════════════════════════════

import { Armchair, Plus, Sprout, Warehouse, Rows3 } from "lucide-react";
import type { UnitConfig } from "@/hooks/configurator/types";
import { studioItemKind } from "@/lib/studio";
import { unitLetter } from "@/lib/tote-plans";

const BAY_ASPECT = 21 / 16;
const MAX_TILE_H = 64;
const MAX_ROW_W = 280;
const GAP = 8;

function blocksOf(item: UnitConfig): { cols: number; rows: number }[] {
  if (item.presetUnits?.length) return item.presetUnits.map((u) => ({ cols: u.cols, rows: u.rows }));
  return [{ cols: item.cols, rows: item.rows }];
}

const OTHER_ICON = { shelving: Rows3, overhead: Warehouse, "raised-bed": Sprout, chair: Armchair } as const;

export default function StudioMap({
  items,
  activeIndex,
  onSelect,
  onAdd,
}: {
  items: UnitConfig[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
}) {
  // One scale for the whole system so tiles compare honestly
  const racks = items.filter((it) => {
    const k = studioItemKind(it);
    return k === "tote" || k === "bestseller";
  });
  const maxRows = Math.max(1, ...racks.flatMap((it) => blocksOf(it).map((b) => b.rows)));
  let tier = Math.min(14, MAX_TILE_H / maxRows);
  const widthAt = (t: number) =>
    items.reduce((s, it) => {
      const k = studioItemKind(it);
      if (k !== "tote" && k !== "bestseller") return s + 40 + GAP;
      return s + blocksOf(it).reduce((w, b) => w + b.cols * t * BAY_ASPECT + 2, 0) + GAP;
    }, 0);
  const total = widthAt(tier);
  if (total > MAX_ROW_W) tier = Math.max(3, (tier * MAX_ROW_W) / total);

  return (
    <div className="flex items-end justify-center gap-2 overflow-x-auto pb-1">
      {items.map((item, i) => {
        const active = i === activeIndex;
        const kind = studioItemKind(item);
        const letter = unitLetter(i);
        const qty = item.quantity || 1;
        const tone = active
          ? "border-yellow-400 bg-yellow-400 text-zinc-900"
          : "border-zinc-600 bg-zinc-800 text-white hover:border-zinc-400";
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            aria-pressed={active}
            aria-label={`Unit ${letter}: ${item.desc}`}
            className="relative flex shrink-0 flex-col items-center gap-1"
          >
            {kind === "tote" || kind === "bestseller" ? (
              <div className="flex items-end gap-0.5">
                {blocksOf(item).map((b, j) => (
                  <div
                    key={j}
                    className={`flex items-center justify-center rounded-sm border-2 transition-colors ${tone}`}
                    style={{ width: Math.max(14, b.cols * tier * BAY_ASPECT), height: Math.max(14, b.rows * tier) }}
                  >
                    {j === Math.floor((blocksOf(item).length - 1) / 2) && (
                      <span className="text-sm font-black leading-none">{letter}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              (() => {
                const Icon = OTHER_ICON[kind];
                return (
                  <div className={`flex h-10 w-10 flex-col items-center justify-center rounded-md border-2 transition-colors ${tone}`}>
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-black leading-none">{letter}</span>
                  </div>
                );
              })()
            )}
            {qty > 1 && (
              <span className="absolute -right-1.5 -top-1.5 rounded-full bg-emerald-500 px-1.5 text-[10px] font-black text-white">
                ×{qty}
              </span>
            )}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        aria-label="Add a unit"
        className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md border-2 border-dashed border-zinc-600 text-zinc-400 transition hover:border-yellow-400 hover:text-yellow-400"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
