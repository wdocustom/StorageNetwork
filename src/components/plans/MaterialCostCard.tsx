"use client";

// ═══════════════════════════════════════════════════════════════════════════
// MATERIAL COST — live retail cost of the configured build in the plans
// designer: whole 2×4s, full plywood sheets for worktops, caster 4-packs,
// screw boxes. Totes shown separately (many buyers already own them).
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, ShoppingCart } from "lucide-react";
import { estimatePlanMaterials } from "@/app/actions/plan-materials";
import { RETAIL_PRICES_CHECKED, type MaterialEstimate } from "@/lib/plan-retail-prices";
import { TOTE_PLAN_TIERS, encodeTotePlanDesign, formatPlanPrice, type TotePlanDesign } from "@/lib/tote-plans";

const dollars = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function MaterialCostCard({ design }: { design: TotePlanDesign }) {
  const [estimate, setEstimate] = useState<MaterialEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const key = encodeTotePlanDesign(design);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const t = setTimeout(() => {
      estimatePlanMaterials(design)
        .then((e) => live && setEstimate(e))
        .finally(() => live && setLoading(false));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!estimate && !loading) return null;

  return (
    <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-slate-900 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10">
          <ShoppingCart className="h-5 w-5 text-emerald-400" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Materials for this build</p>
          <p className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">
              {estimate ? `≈ ${dollars(estimate.materialsTotal)}` : "…"}
            </span>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-500" aria-hidden />}
          </p>
          {estimate && (
            <p className="text-[11px] text-stone-400">
              DIY total ≈ {dollars(estimate.materialsTotal + TOTE_PLAN_TIERS.pdf.price / 100)} with the{" "}
              {formatPlanPrice(TOTE_PLAN_TIERS.pdf.price)} PDF plan
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-bold text-stone-300 transition hover:border-emerald-400/60 hover:text-white"
        >
          Details
          <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>

      {open && estimate && (
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60">
          <ul className="divide-y divide-slate-800 text-xs">
            {estimate.lines.map((l) => (
              <li key={l.label} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 text-stone-300">{l.label}</span>
                <span className="text-stone-500">
                  {l.qty} {l.qty === 1 ? l.unit : l.unit === "box" ? "boxes" : `${l.unit}s`} × ${l.unitPrice.toFixed(2)}
                </span>
                <span className="w-16 text-right font-bold text-white">${l.total.toFixed(2)}</span>
              </li>
            ))}
            <li className="flex items-center gap-2 px-3 py-2 text-stone-500">
              <span className="min-w-0 flex-1">
                + {estimate.totes.count} totes, if you need them
              </span>
              <span className="w-16 text-right">${estimate.totes.total.toFixed(2)}</span>
            </li>
          </ul>
          <p className="border-t border-slate-800 px-3 py-2 text-[10px] text-stone-600">
            Full boards, sheets, packs and boxes at typical home-center prices ({RETAIL_PRICES_CHECKED}). Prices vary by store and region.
          </p>
        </div>
      )}
    </section>
  );
}
