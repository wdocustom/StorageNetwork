"use client";

import { useState } from "react";
import { Check, Loader2, Power } from "lucide-react";

import {
  updateToteFulfillmentSettings,
  type ToteFulfillmentSettings as Settings,
} from "@/app/actions/realtor-gift-fulfillment";

// ═══════════════════════════════════════════════════════════════════════════
// Installer opt-in card. Two states inside:
//   active=false → big "Turn on" CTA + stock + capacity inputs.
//   active=true  → compact settings strip with edit-in-place inputs and
//                  a "Pause" toggle. Shows current in-flight job count.
// ═══════════════════════════════════════════════════════════════════════════

export function ToteFulfillmentSettings({
  initial,
  jobsInFlight,
}: {
  initial: Settings;
  jobsInFlight: number;
}) {
  const [active, setActive] = useState(initial.active);
  const [stock, setStock] = useState(String(initial.stock));
  const [capacity, setCapacity] = useState(String(initial.capacity || 5));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function save(patch: Partial<Settings>) {
    setError("");
    setSaving(true);
    const result = await updateToteFulfillmentSettings(patch);
    setSaving(false);
    if (!result.ok) {
      setError(result.error || "Couldn't save settings.");
      return;
    }
    setSavedAt(Date.now());
    if (typeof patch.active === "boolean") setActive(patch.active);
  }

  async function activate() {
    const stockNum = parseInt(stock, 10);
    const capacityNum = parseInt(capacity, 10);
    if (Number.isNaN(stockNum) || stockNum < 0) {
      setError("Enter a valid tote stock count.");
      return;
    }
    if (Number.isNaN(capacityNum) || capacityNum < 1) {
      setError("Capacity must be at least 1.");
      return;
    }
    await save({ active: true, stock: stockNum, capacity: capacityNum });
  }

  async function saveStock() {
    const n = parseInt(stock, 10);
    if (Number.isNaN(n) || n < 0) return;
    await save({ stock: n });
  }

  async function saveCapacity() {
    const n = parseInt(capacity, 10);
    if (Number.isNaN(n) || n < 1) return;
    await save({ capacity: n });
  }

  if (!active) {
    return (
      <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-6 sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/10 ring-1 ring-yellow-400/40">
            <Power className="h-5 w-5 text-yellow-400" />
          </div>
          <h2 className="text-lg font-bold">Opt in to fulfillment</h2>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-stone-300">
          Tell us how many reusable totes you have on hand and how many concurrent gift
          jobs you can comfortably run. We&apos;ll route closing-gift orders to you whenever
          a realtor sends one in your service area.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Reusable totes on hand"
            value={stock}
            onChange={setStock}
            help="Total inventory. Includes totes currently out on jobs."
          />
          <NumberField
            label="Max concurrent gift jobs"
            value={capacity}
            onChange={setCapacity}
            help="We won't assign you a new job past this number."
          />
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={activate}
          disabled={saving}
          className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-yellow-300 disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Turning on&hellip;
            </>
          ) : (
            <>Turn on tote-rental fulfillment</>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30" />
          <p className="text-sm font-semibold text-white">Fulfillment is live</p>
          <span className="text-xs text-stone-500">
            {jobsInFlight} in flight
          </span>
        </div>
        <button
          onClick={() => save({ active: false })}
          disabled={saving}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-stone-300 hover:border-slate-600 disabled:opacity-60"
        >
          Pause new jobs
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InlineNumberField
          label="Totes on hand"
          value={stock}
          onChange={setStock}
          onCommit={saveStock}
        />
        <InlineNumberField
          label="Max concurrent jobs"
          value={capacity}
          onChange={setCapacity}
          onCommit={saveCapacity}
        />
      </div>

      <div className="mt-3 flex items-center gap-3 text-[11px] text-stone-500">
        {error ? (
          <span className="text-red-400">{error}</span>
        ) : savedAt ? (
          <span className="flex items-center gap-1.5 text-emerald-400">
            <Check className="h-3 w-3" />
            Saved
          </span>
        ) : (
          <span>Edits save when you tab out of a field.</span>
        )}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  help: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-stone-400">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder:text-stone-500 focus:border-yellow-400/50 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
      />
      <p className="mt-1 text-[11px] text-stone-500">{help}</p>
    </div>
  );
}

function InlineNumberField({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium text-stone-500">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-yellow-400/50 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
      />
    </div>
  );
}
