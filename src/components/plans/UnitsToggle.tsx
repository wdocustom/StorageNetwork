"use client";

// in / mm switch for the DIY plans, 3D guide and PDF (see lib/measure-units).

import { setUnits, useUnits, type Units } from "@/lib/measure-units";
import { trackPlanEvent } from "@/lib/plan-events";

export default function UnitsToggle({ className = "" }: { className?: string }) {
  const units = useUnits();
  const pick = (u: Units) => {
    if (u === units) return;
    setUnits(u);
    trackPlanEvent("units", u);
  };
  const btn = (u: Units, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={units === u}
      onClick={() => pick(u)}
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
        units === u ? "bg-yellow-400 text-gray-950" : "text-stone-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div
      role="radiogroup"
      aria-label="Measurement units"
      className={`inline-flex items-center rounded-full border border-slate-700 bg-slate-900/90 p-0.5 ${className}`}
    >
      {btn("imperial", "in")}
      {btn("metric", "mm")}
    </div>
  );
}
