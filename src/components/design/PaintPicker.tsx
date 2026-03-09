"use client";

import type { PaintColorId } from "@/types/viewModels";
import { PAINT_COLORS } from "@/types/viewModels";

/** Small color circle swatch — toggles paint color for a target */
export function PaintSwatch({
  colorId,
  hex,
  active,
  onSelect,
}: {
  colorId: PaintColorId;
  hex: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={colorId.charAt(0).toUpperCase() + colorId.slice(1)}
      className={`relative h-5 w-5 rounded-full border-2 transition-all ${
        active
          ? "border-yellow-400 ring-1 ring-yellow-400/30 scale-110"
          : "border-zinc-600 hover:border-zinc-400 hover:scale-105"
      }`}
      style={{ backgroundColor: hex }}
    >
      {active && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className={`text-[7px] font-black ${colorId === "white" ? "text-zinc-800" : "text-white"}`}>✓</span>
        </span>
      )}
    </button>
  );
}

/** Row of paint color swatches for a specific target */
export function PaintColorPicker({
  label,
  activeColor,
  onColorChange,
  price,
}: {
  label: string;
  activeColor: PaintColorId | null;
  onColorChange: (c: PaintColorId | null) => void;
  price: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide min-w-[42px]">{label}</span>
      <div className="flex items-center gap-1.5">
        {PAINT_COLORS.map((c) => (
          <PaintSwatch
            key={c.id}
            colorId={c.id}
            hex={c.hex}
            active={activeColor === c.id}
            onSelect={() => onColorChange(activeColor === c.id ? null : c.id)}
          />
        ))}
      </div>
      {activeColor && (
        <span className="ml-auto text-[10px] font-medium text-yellow-400/80">+${price}</span>
      )}
    </div>
  );
}
