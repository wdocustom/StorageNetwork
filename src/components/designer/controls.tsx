"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Designer controls — the big-touch-target inputs shared by the plans
// generator (/plans/checkout) and the installer design studio (/design).
// ═══════════════════════════════════════════════════════════════════════════

import { Minus, Plus } from "lucide-react";

export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="rounded-xl bg-slate-800/60 p-3">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">{label}</div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={`Fewer — ${label}`}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700 text-white transition hover:bg-slate-600 disabled:opacity-30"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="text-2xl font-black text-white">{value}</span>
        <button
          type="button"
          aria-label={`More — ${label}`}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700 text-white transition hover:bg-slate-600 disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Segmented<T extends string | boolean>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              className={`rounded-xl border px-3 py-2.5 text-left transition ${
                active
                  ? "border-yellow-400/60 bg-yellow-400/10 text-white"
                  : "border-slate-700 bg-slate-800/40 text-stone-400 hover:border-slate-600"
              }`}
            >
              <div className="text-sm font-bold">{opt.label}</div>
              {opt.hint && <div className="text-[10px] text-stone-500">{opt.hint}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
