"use client";

import { useState } from "react";
import { Minus, Plus, Package } from "lucide-react";
import BottomDrawer from "./BottomDrawer";
import type { InstallerPricing } from "@/types/viewModels";

const CHAIR_DEFAULT_PRICE = 265;

interface ChairDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  installerPricing?: InstallerPricing;
  onAddChair: (quantity: number, price: number, desc: string) => void;
}

export default function ChairDrawer({
  isOpen,
  onClose,
  installerPricing,
  onAddChair,
}: ChairDrawerProps) {
  const [quantity, setQuantity] = useState(1);
  const priceEach = installerPricing?.adirondack_chair ?? CHAIR_DEFAULT_PRICE;
  const total = priceEach * quantity;

  function handleAdd() {
    const desc =
      quantity > 1
        ? `Low Boy Adirondack Chair (×${quantity})`
        : "Low Boy Adirondack Chair";
    onAddChair(quantity, total, desc);
    setQuantity(1);
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
