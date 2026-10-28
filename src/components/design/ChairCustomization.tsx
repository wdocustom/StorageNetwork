"use client";

// Adirondack chair options (finish + quantity) with the live price, shown in
// the design studio's "+" view once the chair is picked.

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { ConfiguratorSidebarProps } from "./configurator-types";
import { CHAIR_FINISHES } from "@/lib/chairs";
import { calculateChairPriceServer, getChairOptionPrices } from "@/app/actions/platform-defaults";

export function ChairCustomization({
  props,
}: {
  props: ConfiguratorSidebarProps;
}) {
  const finish = props.chairFinish ?? "natural";
  const quantity = props.chairQuantity ?? 1;

  const [optionPrices, setOptionPrices] = useState<{ basePrice: number; paintAddon: number } | null>(null);
  useEffect(() => {
    getChairOptionPrices(props.chairInstallerPricing).then(setOptionPrices);
  }, [props.chairInstallerPricing]);

  useEffect(() => {
    let cancelled = false;
    calculateChairPriceServer({ finish, quantity, installerPricing: props.chairInstallerPricing })
      .then((result) => {
        if (!cancelled) props.onChairPriceChange?.(result.total);
      });
    return () => { cancelled = true; };
  }, [finish, quantity, props.chairInstallerPricing]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Finish Selection */}
      <div>
        <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          Finish
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {CHAIR_FINISHES.map((f) => {
            const isSelected = finish === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  props.onChairFinishChange?.(f.id);
                  props.onChairPreview?.({ finish: f.id });
                }}
                className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-all ${
                  isSelected
                    ? "border-yellow-400/60 bg-yellow-400/5 ring-1 ring-yellow-400/30"
                    : "border-zinc-700/60 bg-zinc-800/40 hover:border-zinc-600"
                }`}
              >
                <div
                  className="h-6 w-6 rounded-full border border-zinc-600"
                  style={{ backgroundColor: f.hex }}
                />
                <span className={`text-[11px] font-semibold ${isSelected ? "text-yellow-400" : "text-zinc-300"}`}>{f.label}</span>
                {(f.id === "white" || f.id === "black") && optionPrices && (
                  <span className="text-[10px] font-bold text-yellow-400">+${optionPrices.paintAddon}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quantity */}
      <div>
        <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          Quantity
        </h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => props.onChairQuantityChange?.(Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/60 text-zinc-300 transition-colors hover:border-zinc-600 disabled:opacity-40"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[2rem] text-center text-sm font-bold text-white">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => props.onChairQuantityChange?.(Math.min(4, quantity + 1))}
            disabled={quantity >= 4}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/60 text-zinc-300 transition-colors hover:border-zinc-600 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}
