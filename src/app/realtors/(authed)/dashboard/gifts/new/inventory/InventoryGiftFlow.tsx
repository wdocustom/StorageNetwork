"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  Loader2,
  Package as PackageIcon,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";

import {
  createInventoryGiftDispatch,
} from "@/app/actions/realtor-inventory-gifts";
import {
  previewToteGiftDelivery,
  type DeliveryPreview,
} from "@/app/actions/realtor-tote-delivery";
import {
  type PackOption,
} from "@/app/actions/realtor-tote-inventory";

import { BuyTotesModal } from "../../../BuyTotesModal";
import { DeliveryDistanceGate } from "./DeliveryDistanceGate";

// ═══════════════════════════════════════════════════════════════════════════
// InventoryGiftFlow — inventory-mode gift creation form.
//
// Form sections:
//   1. Tote count (10–50 slider) + duration (7/14/28)
//   2. Recipient (name, email, address, ZIP, optional note)
//   3. Live distance preview + summary sidebar
//
// Submit behavior:
//   • free tier      → createInventoryGiftDispatch returns giftSuccessUrl;
//                      navigate there. Gift is already live; no Stripe.
//   • surcharge tier → createInventoryGiftDispatch returns checkoutUrl;
//                      window.location to Stripe. Webhook finalizes on pay.
//   • inquire tier   → Send button is hidden; gate renders the mailto.
//   • no_coverage    → Send button disabled; user must change ZIP or use
//                      Quick-send.
//
// Balance guard:
//   • If balance < requested tote count, render an inline "Top up" CTA that
//     opens BuyTotesModal (shared with the dashboard inventory tile). Send
//     button is disabled until balance >= request OR the user tops up.
// ═══════════════════════════════════════════════════════════════════════════

const MIN_TOTES = 10;
const MAX_TOTES = 50;
const DEFAULT_TOTES = 20;
const DURATIONS = [7, 14, 28] as const;

interface Props {
  balance: number;
  packs: PackOption[];
  custom: { unitPriceCents: number; min: number; max: number };
}

export function InventoryGiftFlow({ balance, packs, custom }: Props) {
  // ── Form state ────────────────────────────────────────────────────────
  const [toteCount, setToteCount] = useState<number>(DEFAULT_TOTES);
  const [durationDays, setDurationDays] = useState<number>(14);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryZip, setDeliveryZip] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");

  // ── Distance preview state (debounced on deliveryZip changes) ─────────
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<DeliveryPreview | null>(null);

  useEffect(() => {
    const zip = deliveryZip.trim();
    if (!/^\d{5}$/.test(zip)) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }
    setPreviewLoading(true);
    const handle = setTimeout(async () => {
      try {
        const result = await previewToteGiftDelivery({ deliveryZip: zip });
        setPreview(result);
      } finally {
        setPreviewLoading(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [deliveryZip]);

  // ── Top-up + submit state ─────────────────────────────────────────────
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const insufficientBalance = balance < toteCount;
  const shortfall = Math.max(0, toteCount - balance);
  const canSend =
    !insufficientBalance &&
    !!preview &&
    (preview.tier === "free" || preview.tier === "surcharge") &&
    !!recipientName.trim() &&
    !!recipientEmail.trim() &&
    !!deliveryAddress.trim() &&
    /^\d{5}$/.test(deliveryZip.trim());

  const surchargeCents = preview?.tier === "surcharge" ? preview.surchargeCents : 0;

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await createInventoryGiftDispatch({
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim(),
        deliveryAddress: deliveryAddress.trim(),
        deliveryZip: deliveryZip.trim(),
        personalMessage: personalMessage.trim() || undefined,
        toteCount,
        durationDays,
      });
      if (!result.success) {
        setError(result.error ?? "Could not send gift.");
        return;
      }
      if (result.checkoutUrl) {
        // Surcharge path — Stripe takes over.
        window.location.href = result.checkoutUrl;
        return;
      }
      if (result.giftSuccessUrl) {
        // Free path — gift is live.
        window.location.href = result.giftSuccessUrl;
        return;
      }
      setError("Server did not return a redirect target.");
    });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      {/* ── Left column: form ─────────────────────────────────────── */}
      <div className="space-y-10">
        {/* Tote count + duration */}
        <section>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-stone-400">
            1. How many totes?
          </h2>
          <ToteCountSlider value={toteCount} onChange={setToteCount} />
          <p className="mt-3 text-[11px] text-stone-500">
            Minimum 10, maximum 50 per gift. All 27-gallon reusable totes.
          </p>

          <h2 className="mb-4 mt-8 text-xs font-bold uppercase tracking-[0.2em] text-stone-400">
            2. Rental length
          </h2>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => {
              const sel = durationDays === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDurationDays(d)}
                  className={`rounded-xl border px-5 py-3 text-sm font-semibold transition-all ${
                    sel
                      ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-300"
                      : "border-slate-800 bg-slate-900/40 text-stone-300 hover:border-slate-700"
                  }`}
                >
                  {d} days
                </button>
              );
            })}
          </div>
        </section>

        {/* Recipient */}
        <section>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-stone-400">
            3. Recipient
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Recipient name" value={recipientName} onChange={setRecipientName} placeholder="Jane Doe" />
            <TextField
              label="Recipient email"
              value={recipientEmail}
              onChange={setRecipientEmail}
              placeholder="jane@example.com"
              type="email"
            />
            <TextField
              label="Delivery address"
              value={deliveryAddress}
              onChange={setDeliveryAddress}
              placeholder="123 Main St, Springfield"
              className="sm:col-span-2"
            />
            <TextField
              label="Delivery ZIP"
              value={deliveryZip}
              onChange={(v) => setDeliveryZip(v.replace(/\D/g, "").slice(0, 5))}
              placeholder="62704"
              maxLength={5}
            />
          </div>

          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-medium text-stone-400">
              Personal note (optional)
            </label>
            <textarea
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              maxLength={400}
              rows={3}
              placeholder="Congrats on the new place — couldn't be happier for you!"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-stone-500 focus:border-yellow-400/50 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
            />
            <p className="mt-1 text-[11px] text-stone-500">
              Shows up on the gift email and the recipient page. {personalMessage.length}/400.
            </p>
          </div>
        </section>

        {/* Distance gate (inline, under the form) */}
        <section>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-stone-400">
            4. Delivery
          </h2>
          <DeliveryDistanceGate
            loading={previewLoading}
            preview={preview}
            zipEntered={/^\d{5}$/.test(deliveryZip.trim())}
            recipientName={recipientName}
            deliveryAddress={deliveryAddress}
            deliveryZip={deliveryZip}
            toteCount={toteCount}
            durationDays={durationDays}
          />
        </section>
      </div>

      {/* ── Right column: balance + summary + send button ────────── */}
      <aside className="lg:sticky lg:top-10 lg:self-start">
        <div className="space-y-4">
          {/* Balance card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-stone-500">
              Tote inventory
            </p>
            <p className="text-3xl font-black text-white">
              {balance.toLocaleString()}
              <span className="ml-2 text-xs font-medium text-stone-400">available</span>
            </p>
            <p className="mt-2 text-xs text-stone-500">
              {insufficientBalance ? (
                <>
                  <span className="font-semibold text-amber-300">
                    Short {shortfall} {shortfall === 1 ? "tote" : "totes"}
                  </span>{" "}
                  for this gift.
                </>
              ) : (
                <>
                  After this gift: {(balance - toteCount).toLocaleString()} totes remaining.
                </>
              )}
            </p>
            {insufficientBalance && (
              <button
                onClick={() => setTopUpOpen(true)}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-950 hover:bg-yellow-300"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Top up — {shortfall} more
              </button>
            )}
          </div>

          {/* Summary card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
              Summary
            </p>

            <div className="mb-1 flex items-center gap-2">
              <PackageIcon className="h-4 w-4 text-yellow-300" />
              <p className="text-lg font-bold">{toteCount} totes</p>
            </div>
            <p className="mb-5 text-sm text-stone-400">
              27-gallon &middot; {durationDays}-day rental
            </p>

            <ul className="mb-5 space-y-1.5 text-xs text-stone-400">
              <SummaryRow label="Totes from inventory" value={`-${toteCount}`} />
              <SummaryRow
                label="Delivery + pickup"
                value={surchargeCents > 0 ? `+$${(surchargeCents / 100).toFixed(0)} (extended)` : "Included"}
                emphasis={surchargeCents > 0 ? "amber" : "emerald"}
              />
            </ul>

            <div className="mb-5 flex items-end justify-between border-t border-slate-800 pt-4">
              <span className="text-sm text-stone-400">Charge today</span>
              <span className="text-3xl font-black text-white">
                ${(surchargeCents / 100).toFixed(0)}
              </span>
            </div>

            {error && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {preview?.tier !== "inquire" && (
              <button
                onClick={handleSubmit}
                disabled={!canSend || pending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-6 py-3 text-base font-bold text-slate-950 transition-all hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {surchargeCents > 0 ? "Redirecting…" : "Sending…"}
                  </>
                ) : surchargeCents > 0 ? (
                  <>Pay $25 &amp; send</>
                ) : (
                  <>Send gift</>
                )}
              </button>
            )}

            <div className="mt-4 flex items-start gap-2 text-[11px] text-stone-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" />
              <span>
                {surchargeCents > 0
                  ? "Secure checkout via Stripe. Totes are reserved from your inventory now; the gift sends once payment completes."
                  : "Your totes are reserved on send. The recipient gets the link immediately."}
              </span>
            </div>
          </div>
        </div>
      </aside>

      <BuyTotesModal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        packs={packs}
        custom={custom}
        initialSelection={shortfall > 0 && shortfall <= custom.max ? "custom" : "pack_50"}
        initialCustomQuantity={shortfall > 0 && shortfall <= custom.max ? shortfall : undefined}
      />
    </div>
  );
}

// ── Tote count slider ────────────────────────────────────────────────────

function ToteCountSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-4xl font-black text-white">{value}</span>
        <span className="text-xs text-stone-500">totes</span>
      </div>
      <input
        type="range"
        min={MIN_TOTES}
        max={MAX_TOTES}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-yellow-400"
      />
      <div className="mt-1 flex justify-between text-[11px] text-stone-500">
        <span>{MIN_TOTES}</span>
        <span>{MAX_TOTES}</span>
      </div>
    </div>
  );
}

// ── Tiny presentational helpers ──────────────────────────────────────────

function SummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: "emerald" | "amber";
}) {
  const valueColor =
    emphasis === "emerald" ? "text-emerald-300" : emphasis === "amber" ? "text-amber-300" : "text-stone-200";
  return (
    <li className="flex items-baseline justify-between">
      <span className="text-stone-500">{label}</span>
      <span className={`font-semibold ${valueColor}`}>{value}</span>
    </li>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  className?: string;
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
  className = "",
}: TextFieldProps) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-stone-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder:text-stone-500 focus:border-yellow-400/50 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
      />
    </div>
  );
}
