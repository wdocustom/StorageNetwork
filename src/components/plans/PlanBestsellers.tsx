"use client";

// ═══════════════════════════════════════════════════════════════════════════
// PLAN BESTSELLERS — lightbox in the plans designer: quick 3D, specs and a
// one-tap start for each bestseller (data in @/lib/plan-bestsellers).
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Star, X } from "lucide-react";
import SystemMap from "@/components/plans/SystemMap";
import PlanRack3D from "@/components/plans/PlanRack3D";
import { PLAN_BESTSELLERS } from "@/lib/plan-bestsellers";
import type { TotePlanDesign } from "@/lib/tote-plans";

/** Lean pill that opens the picker. */
export function BestsellersButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-full border border-yellow-400/40 bg-slate-900/90 px-2.5 py-1 text-[11px] font-bold text-yellow-300 shadow-lg backdrop-blur transition hover:border-yellow-400 hover:text-yellow-200"
    >
      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" aria-hidden />
      Bestsellers
    </button>
  );
}

/** Lightbox: quick 3D + details for one bestseller, the others as cards. */
export function BestsellersLightbox({
  open,
  currentName,
  onClose,
  onPick,
}: {
  open: boolean;
  currentName?: string;
  onClose: () => void;
  onPick: (design: TotePlanDesign) => void;
}) {
  const initial = useMemo(
    () => Math.max(0, PLAN_BESTSELLERS.findIndex((b) => b.preset.name === currentName)),
    [currentName],
  );
  const [focus, setFocus] = useState(initial);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Open on the current design's bestseller (or the first)
  useEffect(() => {
    if (open) setFocus(initial);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open || PLAN_BESTSELLERS.length === 0) return null;
  const b = PLAN_BESTSELLERS[Math.min(focus, PLAN_BESTSELLERS.length - 1)];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bestseller designs"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-700 bg-slate-900 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <p className="flex items-center gap-1.5 text-sm font-black text-white">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" aria-hidden />
            Bestseller builds
          </p>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Close"
            className="rounded-full p-1.5 text-stone-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto">
          <div className="relative h-52 bg-white sm:h-60">
            <PlanRack3D key={b.preset.id} design={b.design} />
          </div>

          <div className="space-y-2 px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-black text-white">{b.preset.name}</h2>
              <span className="shrink-0 rounded-full bg-yellow-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                {b.preset.label}
              </span>
            </div>
            {b.blurb && <p className="text-sm text-stone-300">{b.blurb}</p>}
            <p className="font-mono text-[11px] text-stone-400">{b.spec}</p>
            <SystemMap design={b.design} className="h-14 w-full" title={`${b.preset.name}: units A, B, C left to right`} />
            <button
              type="button"
              onClick={() => onPick(b.design)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-3 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:from-amber-300 hover:to-yellow-400"
            >
              <Check className="h-4 w-4" aria-hidden />
              Build {b.preset.name}
            </button>
          </div>

          <ul className="grid grid-cols-2 gap-2 border-t border-slate-800 p-3 sm:grid-cols-3">
            {PLAN_BESTSELLERS.map((item, i) => (
              <li key={item.preset.id}>
                <button
                  type="button"
                  onClick={() => setFocus(i)}
                  aria-pressed={i === focus}
                  className={`w-full rounded-xl border p-2 text-left transition ${
                    i === focus ? "border-yellow-400/60 bg-yellow-400/10" : "border-slate-800 bg-slate-950/60 hover:border-slate-600"
                  }`}
                >
                  <SystemMap design={item.design} className="h-10 w-full" title={item.preset.name} />
                  <p className="mt-1 truncate text-xs font-bold text-white">{item.preset.name}</p>
                  <p className="text-[10px] text-stone-500">{item.totes} totes</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
