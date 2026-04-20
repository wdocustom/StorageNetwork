"use client";

import { Calculator } from "lucide-react";
import type { MaterialBreakdown, MaterialPrices } from "@/utils/calculateMaterials";
import type { BuildFeeBreakdown } from "@/app/actions/fee-engine";

interface CartProfitCalcProps {
  unitCount: number;
  displayPrice: number;
  displayMaterials: MaterialBreakdown | null;
  feeBreakdown: BuildFeeBreakdown | null;
  materialPrices: MaterialPrices;
}

export default function CartProfitCalc({
  unitCount,
  displayPrice,
  displayMaterials,
  feeBreakdown,
  materialPrices,
}: CartProfitCalcProps) {
  if (!displayMaterials) return null;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
        <Calculator className="h-4 w-4 text-yellow-400" />
        Profit Calculator{" "}
        {unitCount > 0 && <span className="text-yellow-400">({unitCount} units)</span>}
      </h2>

      <div className="space-y-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-stone-500">
              Est. Material Cost
            </span>
            <span className="text-lg font-black text-orange-400">
              ${displayMaterials.totalCost.toLocaleString()}
            </span>
          </div>
          <div className="space-y-1 text-xs text-stone-400">
            {displayMaterials.items.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span>
                  {item.name} × {item.qty}
                </span>
                <span className="font-mono">${item.subtotal.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {Object.keys(materialPrices).length > 0 && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/20 px-3 py-1.5">
              <span className="rounded-full bg-yellow-400/20 px-1.5 py-0.5 text-[9px] font-bold text-yellow-400">
                CUSTOM
              </span>
              <span className="text-[10px] text-stone-500">
                Material prices from your profile settings
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Network Lead */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
            <div className="mb-2 text-center">
              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                NETWORK LEAD
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-stone-400">
                <span>Job Price</span>
                <span>${displayPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-red-400">
                <span>Network Fee ({feeBreakdown?.networkFeePercent ?? "..."})</span>
                <span>-${(feeBreakdown?.networkFeeAmount ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>You Collect</span>
                <span>${(feeBreakdown?.networkCollect ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-orange-400">
                <span>Materials</span>
                <span>-${displayMaterials.totalCost.toLocaleString()}</span>
              </div>
              <div className="mt-2 border-t border-slate-600 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-300">Net Profit</span>
                  <span className="text-lg font-black text-emerald-400">
                    ${(feeBreakdown?.networkNetProfit ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Direct Lead */}
          <div className="relative rounded-lg border border-yellow-400/50 bg-yellow-400/5 p-3">
            <div className="mb-2 text-center">
              <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
                DIRECT LEAD
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-stone-400">
                <span>Job Price</span>
                <span>${displayPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-red-400">
                <span>
                  Maintenance Fee ({feeBreakdown?.directFeePercent ?? "..."})
                </span>
                <span>-${(feeBreakdown?.directFeeAmount ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>You Collect</span>
                <span>${(feeBreakdown?.directCollect ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-orange-400">
                <span>Materials</span>
                <span>-${displayMaterials.totalCost.toLocaleString()}</span>
              </div>
              <div className="mt-2 border-t border-slate-600 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-300">Net Profit</span>
                  <span className="text-lg font-black text-emerald-400">
                    ${(feeBreakdown?.directNetProfit ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
