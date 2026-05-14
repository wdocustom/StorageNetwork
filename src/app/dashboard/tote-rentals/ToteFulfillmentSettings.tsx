"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

import {
  updateToteFulfillmentSettings,
  type ToteFulfillmentSettings as Settings,
} from "@/app/actions/realtor-gift-fulfillment";

// ═══════════════════════════════════════════════════════════════════════════
// Live-state installer settings strip.
//
// Renders only when fulfillment is already turned on (active=true). The
// pre-opt-in pitch + gate-checking + initial form lives in
// ToteFulfillmentOnboarding.tsx; the page.tsx dispatches between the two
// based on the active flag.
//
// Inline edits commit on blur or Enter. The "Pause new jobs" button flips
// active=false, sending the installer back to the onboarding view.
// ═══════════════════════════════════════════════════════════════════════════

export function ToteFulfillmentSettings({
  initial,
  jobsInFlight,
}: {
  initial: Settings;
  jobsInFlight: number;
}) {
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
    if (patch.active === false) {
      // Pausing flips us back to the onboarding view — reload so the page
      // server-renders that branch instead of trying to swap in-place.
      window.location.reload();
    }
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
          label="27-gallon totes on hand"
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
        ) : saving ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving&hellip;
          </span>
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
