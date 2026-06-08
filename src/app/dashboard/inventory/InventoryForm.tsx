"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, Loader2, Trash2 } from "lucide-react";

import {
  clearMyInventory,
  setMyInventory,
} from "@/app/actions/inventory";
import type { MaterialInventory } from "@/utils/inventoryManager";

interface Props {
  initial: MaterialInventory;
  use2x4Rails?: boolean;
}

export function InventoryForm({ initial, use2x4Rails }: Props) {
  // Screws
  const [screws158, setScrews158] = useState(String(initial.screws_1_5_8));
  const [screws3, setScrews3] = useState(String(initial.screws_3));
  const [screws1, setScrews1] = useState(String(initial.screws_1));

  // Plywood
  const [plywoodSheetsFull, setPlywoodSheetsFull] = useState(String(initial.plywood_sheets_full));
  const [plywoodStrips, setPlywoodStrips] = useState(String(initial.plywood_strips));
  const [plywoodStripsMini, setPlywoodStripsMini] = useState(String(initial.plywood_strips_mini));

  // 2×4 Lumber
  const [lumber2x4Full, setLumber2x4Full] = useState(String(initial.lumber_2x4_full));
  const [offcuts, setOffcuts] = useState(
    initial.lumber_offcuts.map((o) => o.length).join(", ")
  );

  // 2×4 Rails
  const [rails2x4Pieces, setRails2x4Pieces] = useState(String(initial.rails_2x4_pieces));

  // Casters
  const [casterKits, setCasterKits] = useState(String(initial.caster_kits));

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  function parseOffcuts(raw: string): { length: number }[] {
    return raw
      .split(/[,\n]/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
      .map((n) => ({ length: n }));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await setMyInventory({
        screws_1_5_8: Number(screws158) || 0,
        screws_3: Number(screws3) || 0,
        screws_1: Number(screws1) || 0,
        plywood_sheets_full: Number(plywoodSheetsFull) || 0,
        plywood_strips: Number(plywoodStrips) || 0,
        plywood_strips_mini: Number(plywoodStripsMini) || 0,
        lumber_2x4_full: Number(lumber2x4Full) || 0,
        lumber_offcuts: parseOffcuts(offcuts),
        rails_2x4_pieces: Number(rails2x4Pieces) || 0,
        caster_kits: Number(casterKits) || 0,
      });
      if (!result.success) {
        setError(result.error ?? "Could not save inventory.");
        return;
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    });
  }

  function handleClear() {
    setError(null);
    startTransition(async () => {
      const result = await clearMyInventory();
      if (!result.success) {
        setError(result.error ?? "Could not clear inventory.");
        return;
      }
      setScrews158("0");
      setScrews3("0");
      setScrews1("0");
      setPlywoodSheetsFull("0");
      setPlywoodStrips("0");
      setPlywoodStripsMini("0");
      setLumber2x4Full("0");
      setOffcuts("");
      setRails2x4Pieces("0");
      setCasterKits("0");
      setConfirmClear(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    });
  }

  return (
    <div className="space-y-6">
      {/* ── 2×4 Lumber ──────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-stone-400">
          2×4 Lumber
        </h2>
        <p className="mb-4 text-[11px] text-stone-500">
          Full boards and leftover offcuts from previous builds.
        </p>
        <div className="mb-4">
          <NumberField
            label="Full 8ft boards"
            value={lumber2x4Full}
            onChange={setLumber2x4Full}
            help="Uncut 2×4 × 8' boards on hand"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-stone-400">Offcuts</label>
          <p className="mb-2 text-[10px] text-stone-500">
            Comma-separated lengths in inches. E.g. <span className="font-mono text-stone-400">48, 36, 30</span>.
            Auto-updated after each build — edit to match what&apos;s actually on hand.
          </p>
          <textarea
            value={offcuts}
            onChange={(e) => setOffcuts(e.target.value)}
            placeholder="48, 36, 30"
            rows={3}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-stone-600 focus:border-yellow-400/50 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
          />
        </div>
      </section>

      {/* ── Plywood ─────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-stone-400">
          Plywood
        </h2>
        <p className="mb-4 text-[11px] text-stone-500">
          Full sheets for tops and structural cuts. Rail strips are auto-generated
          from builds — adjust here if your actual count differs.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField
            label="Full 4×8 sheets"
            value={plywoodSheetsFull}
            onChange={setPlywoodSheetsFull}
            help="Uncut sheets on hand"
          />
          <NumberField
            label='Rail strips (1-7/8")'
            value={plywoodStrips}
            onChange={setPlywoodStrips}
            help="Standard width — from offcuts"
          />
          <NumberField
            label='Mini strips (1")'
            value={plywoodStripsMini}
            onChange={setPlywoodStripsMini}
            help="Mini width — from offcuts"
          />
        </div>
      </section>

      {/* ── 2×4 Rail Pieces (shown when 2x4 rail mode is enabled) ── */}
      {use2x4Rails && (
        <section className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-5">
          <h2 className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
            2×4 Rail Construction
          </h2>
          <p className="mb-4 text-[11px] text-stone-500">
            Pre-ripped rail pieces from previous builds. Auto-updated when builds
            produce leftovers — adjust to match actual on-hand count.
          </p>
          <NumberField
            label="Rail pieces on hand"
            value={rails2x4Pieces}
            onChange={setRails2x4Pieces}
            help="Ripped 2×4 rail strips ready to install"
          />
        </section>
      )}

      {/* ── Casters ─────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-stone-400">
          Casters
        </h2>
        <p className="mb-4 text-[11px] text-stone-500">
          Wheel kits on hand. Each kit includes 4 casters for one unit base.
        </p>
        <NumberField
          label="Caster kits (4-pack)"
          value={casterKits}
          onChange={setCasterKits}
          help="1 kit per wheeled unit"
        />
      </section>

      {/* ── Screws ──────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-stone-400">
          Screws (individual count)
        </h2>
        <p className="mb-4 text-[11px] text-stone-500">
          Enter the number of individual screws, not boxes. The system
          converts to boxes automatically on purchase lists.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField label='1-5/8" #8' value={screws158} onChange={setScrews158} help="158 per box — rail screws" />
          <NumberField label='3" frame' value={screws3} onChange={setScrews3} help="137 per box — structural" />
          <NumberField label='1" mini' value={screws1} onChange={setScrews1} help="90 per box — caster screws" />
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={handleSave}
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : savedFlash ? (
            <>
              <Check className="h-4 w-4" />
              Saved
            </>
          ) : (
            <>Save inventory</>
          )}
        </button>

        {confirmClear ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-stone-300">Reset all values to zero?</span>
            <button
              onClick={handleClear}
              disabled={pending}
              className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-1.5 font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-60"
            >
              Yes, clear
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              disabled={pending}
              className="rounded-lg border border-slate-700 px-3 py-1.5 font-semibold text-stone-300 hover:bg-slate-800 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-stone-300 hover:bg-slate-800 disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear all
          </button>
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
  help?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-stone-400">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-yellow-400/50 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
      />
      {help && <p className="mt-1 text-[10px] text-stone-500">{help}</p>}
    </div>
  );
}
