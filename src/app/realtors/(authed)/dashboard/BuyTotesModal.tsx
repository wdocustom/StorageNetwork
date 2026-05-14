"use client";

import { useState, useTransition } from "react";
import { Loader2, Package, ShoppingCart, Sparkles, X } from "lucide-react";

import {
  createTotePackCheckout,
  type PackSku,
  type PackOption,
} from "@/app/actions/realtor-tote-inventory";

// ═══════════════════════════════════════════════════════════════════════════
// Buy Totes modal — opens from the inventory tile on the realtor dashboard.
//
// Four options: pack_50, pack_100, pack_250 (fixed bonus tiers) and 'custom'
// (1–49 tote top-up at flat $6.50/each, no bonus). On submit, calls the
// server action which inserts a pending purchase + Stripe Session; the
// client then redirects to Stripe Checkout. Webhook + the dashboard's
// ?session_id= query param both finalize idempotently on return.
// ═══════════════════════════════════════════════════════════════════════════

interface BuyTotesModalProps {
  open: boolean;
  onClose: () => void;
  packs: PackOption[];
  /** Custom top-up bounds + per-tote price, sourced from listTotePackOptions(). */
  custom: { unitPriceCents: number; min: number; max: number };
  /** Optional preselect, useful when the modal is opened from a "top up" CTA
   *  on the gift-new page (PR4) with a known shortfall amount. */
  initialSelection?: PackSku;
  initialCustomQuantity?: number;
}

export function BuyTotesModal({
  open,
  onClose,
  packs,
  custom,
  initialSelection = "pack_50",
  initialCustomQuantity,
}: BuyTotesModalProps) {
  const [selected, setSelected] = useState<PackSku>(initialSelection);
  const [customQty, setCustomQty] = useState<number>(
    initialCustomQuantity && initialCustomQuantity >= custom.min && initialCustomQuantity <= custom.max
      ? initialCustomQuantity
      : 10
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const customAmountCents = customQty * custom.unitPriceCents;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await createTotePackCheckout(
        selected === "custom"
          ? { packSku: "custom", customQuantity: customQty }
          : { packSku: selected }
      );
      if (!result.success || !result.url) {
        setError(result.error ?? "Could not start checkout.");
        return;
      }
      window.location.href = result.url;
    });
  }

  return (
    <div
      onClick={(e) => {
        if (!pending && e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-10"
    >
      <div className="relative w-full max-w-2xl rounded-2xl border border-yellow-400/30 bg-slate-950 p-6 shadow-2xl">
        <button
          onClick={onClose}
          disabled={pending}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-md p-1 text-stone-500 hover:bg-slate-800 hover:text-stone-200 disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-full bg-yellow-400/10 p-2 ring-1 ring-yellow-400/40">
            <ShoppingCart className="h-5 w-5 text-yellow-300" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Buy totes</h3>
            <p className="text-xs text-stone-400">
              Flat $6.50 per tote. Bonus totes added free on 50+ packs.
            </p>
          </div>
        </div>

        {/* Fixed packs */}
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          {packs.map((pack) => (
            <PackCard
              key={pack.sku}
              pack={pack}
              selected={selected === pack.sku}
              onSelect={() => setSelected(pack.sku)}
              disabled={pending}
            />
          ))}
        </div>

        {/* Custom top-up */}
        <CustomCard
          selected={selected === "custom"}
          onSelect={() => setSelected("custom")}
          qty={customQty}
          onQtyChange={setCustomQty}
          amountCents={customAmountCents}
          min={custom.min}
          max={custom.max}
          disabled={pending}
        />

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-2">
          <p className="text-[11px] text-stone-500">
            You'll be redirected to Stripe. No refunds — totes never expire.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={pending}
              className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-wider text-stone-300 hover:bg-slate-800 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={pending || (selected === "custom" && (customQty < custom.min || customQty > custom.max))}
              className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-950 hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
              Buy {summaryFor(selected, packs, customQty)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PackCard({
  pack,
  selected,
  onSelect,
  disabled,
}: {
  pack: PackOption;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-all disabled:opacity-50 ${
        selected
          ? "border-yellow-400/60 bg-yellow-400/10"
          : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
      }`}
    >
      {pack.sku === "pack_250" && (
        <span className="absolute -top-2 right-3 rounded-full bg-yellow-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-950">
          Pro deal
        </span>
      )}
      <div className="flex items-center gap-2">
        <Package className={selected ? "h-4 w-4 text-yellow-300" : "h-4 w-4 text-stone-400"} />
        <span className="text-sm font-bold text-white">{pack.label}</span>
      </div>
      <p className="text-2xl font-black text-white">
        ${(pack.amountCents / 100).toFixed(0)}
      </p>
      <p className="text-[11px] leading-relaxed text-stone-400">
        <span className="font-semibold text-emerald-300">+{pack.bonusCount} bonus</span>
        {" — "}
        {pack.totalCredited} totes credited.
      </p>
    </button>
  );
}

function CustomCard({
  selected,
  onSelect,
  qty,
  onQtyChange,
  amountCents,
  min,
  max,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  qty: number;
  onQtyChange: (n: number) => void;
  amountCents: number;
  min: number;
  max: number;
  disabled: boolean;
}) {
  return (
    <div
      onClick={() => !disabled && onSelect()}
      className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-all ${
        selected
          ? "border-yellow-400/60 bg-yellow-400/10"
          : "border-slate-800 bg-slate-900/40 hover:border-slate-700 cursor-pointer"
      }`}
    >
      <div className="flex items-center gap-3">
        <Sparkles className={selected ? "h-4 w-4 text-yellow-300" : "h-4 w-4 text-stone-400"} />
        <div>
          <p className="text-sm font-bold text-white">Custom top-up</p>
          <p className="text-[11px] text-stone-500">
            {min}&ndash;{max} totes. No bonus, flat $6.50 each.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={min}
          max={max}
          value={qty}
          onClick={(e) => e.stopPropagation()}
          onFocus={() => onSelect()}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (Number.isFinite(n)) onQtyChange(Math.max(min, Math.min(max, n)));
          }}
          disabled={disabled}
          className="w-20 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-center text-sm font-semibold text-white focus:border-yellow-400/60 focus:outline-none"
        />
        <p className="w-20 text-right text-sm font-black text-white">
          ${(amountCents / 100).toFixed(2)}
        </p>
      </div>
    </div>
  );
}

function summaryFor(selected: PackSku, packs: PackOption[], customQty: number): string {
  if (selected === "custom") return `${customQty} totes`;
  const pack = packs.find((p) => p.sku === selected);
  if (!pack) return "totes";
  return `${pack.totalCredited} totes`;
}
