"use client";

import { useState } from "react";
import { Minus, Plus, Package, Check } from "lucide-react";
import BottomDrawer from "./BottomDrawer";
import type { InstallerPricing } from "@/types/viewModels";
import { CHAIR_FINISHES, type ChairFinish } from "@/lib/chairs";

const CHAIR_DEFAULT_PRICE = 265;
const CHAIR_PAINT_ADDON_DEFAULT = 75;

interface ChairDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  installerPricing?: InstallerPricing;
  onAddChair: (quantity: number, price: number, desc: string, finish: ChairFinish) => void;
}

export default function ChairDrawer({
  isOpen,
  onClose,
  installerPricing,
  onAddChair,
}: ChairDrawerProps) {
  const [quantity, setQuantity] = useState(1);
  const [finish, setFinish] = useState<ChairFinish>("natural");

  const basePrice = installerPricing?.adirondack_chair ?? CHAIR_DEFAULT_PRICE;
  const paintAddon = installerPricing?.adirondack_chair_paint_addon ?? CHAIR_PAINT_ADDON_DEFAULT;
  const isPainted = finish === "white" || finish === "black";
  const priceEach = basePrice + (isPainted ? paintAddon : 0);
  const total = priceEach * quantity;

  function handleAdd() {
    const finishObj = CHAIR_FINISHES.find((f) => f.id === finish);
    const finishLabel = finishObj?.label ?? "Natural";
    const qtyLabel = quantity > 1 ? ` (×${quantity})` : "";
    const desc = `Low Boy Adirondack Chair — ${finishLabel}${qtyLabel}`;
    onAddChair(quantity, total, desc, finish);
    setQuantity(1);
    setFinish("natural");
  }

  return (
    <BottomDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Low Boy Adirondack Chair"
      subtitle="Outdoor seating — natural upsell after garage builds"
      icon={<Package className="h-4 w-4 text-amber-400" />}
    >
      <div className="space-y-5 p-4">
        <p className="text-[13px] leading-relaxed text-stone-400">
          A sleek, low-profile Adirondack built from standard dimensional lumber.
          Weekend build, beginner-friendly.
        </p>

        {/* Finish selector */}
        <div>
          <p className="mb-2.5 text-sm font-semibold text-white">Finish</p>
          <div className="flex gap-3">
            {CHAIR_FINISHES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFinish(f.id)}
                className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${
                  finish === f.id
                    ? "border-amber-400/60 bg-amber-400/5"
                    : "border-slate-700 bg-slate-800/30 hover:border-slate-500"
                }`}
              >
                <div
                  className="relative h-8 w-8 rounded-full border border-white/10"
                  style={{ backgroundColor: f.hex }}
                >
                  {finish === f.id && (
                    <Check className={`absolute inset-0 m-auto h-4 w-4 ${f.id === "black" ? "text-white" : "text-gray-900"}`} />
                  )}
                </div>
                <span className="text-[11px] font-medium text-stone-400">{f.label}</span>
                {(f.id === "white" || f.id === "black") && (
                  <span className="text-[10px] text-amber-400/70">+${paintAddon}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity selector */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Quantity</p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-stone-400 transition-colors hover:border-slate-500 hover:text-white"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-6 text-center text-lg font-bold text-white">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(20, q + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-stone-400 transition-colors hover:border-slate-500 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Price display */}
        <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3">
          <p className="text-[13px] text-stone-400">
            ${priceEach.toLocaleString()} × {quantity}
          </p>
          <p className="text-xl font-black text-white">${total.toLocaleString()}</p>
        </div>

        {/* Add button */}
        <button
          type="button"
          onClick={handleAdd}
          className="w-full rounded-xl bg-amber-400 py-3.5 text-sm font-black text-gray-950 transition-all hover:bg-amber-300 active:scale-[0.98]"
        >
          Add to Quote
        </button>

        <p className="text-center text-[11px] text-stone-600">
          No cut list generated — build plans are in Guides &amp; Training
        </p>
      </div>
    </BottomDrawer>
  );
}
