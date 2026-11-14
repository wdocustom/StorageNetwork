"use client";

// ═══════════════════════════════════════════════════════════════════════════
// "Wait — take $5 off" — shown once to a designer visitor who is leaving
// (closed the payment form, hesitated at the price, or came back from
// another app). Buy at the offer price now, or have the design emailed with
// the offer so we can follow up. The parent decides when to open it.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Mail, X } from "lucide-react";

export default function ExitOffer({
  designName,
  price,
  wasPrice,
  wallet,
  buying,
  onBuy,
  onEmail,
  onClose,
}: {
  designName: string;
  price: string;
  wasPrice: string;
  /** In Facebook / Instagram: the Apple / Google Pay escape, shown first */
  wallet?: React.ReactNode;
  buying: boolean;
  onBuy: () => void;
  onEmail: (email: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    const r = await onEmail(email).catch(() => ({ ok: false as const, error: "Something went wrong. Please try again." }));
    setSending(false);
    if (r.ok) setSent(true);
    else setError(r.error);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="$5 off your plans"
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-yellow-400/40 bg-slate-900 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />
        <button
          type="button"
          onClick={onClose}
          aria-label="No thanks"
          className="absolute right-3 top-3 rounded-lg p-2 text-stone-500 hover:bg-slate-800 hover:text-stone-300"
        >
          <X className="h-5 w-5" />
        </button>

        <p className="text-xs font-black uppercase tracking-widest text-yellow-400">Wait — before you go</p>
        <h2 className="mt-1 text-2xl font-black leading-tight text-white">Take $5 off your plans</h2>
        <p className="mt-1 text-sm text-stone-400">For your {designName}, and every rack you design after it.</p>

        <div className="mt-4 flex items-baseline gap-3">
          <span className="text-5xl font-black text-white">{price}</span>
          <span className="text-xl font-bold text-stone-500 line-through">{wasPrice}</span>
          <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-300">Saved for 24 hours</span>
        </div>

        <div className="mt-5 space-y-3">
          {wallet}
          <button
            type="button"
            onClick={onBuy}
            disabled={buying}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-4 text-base font-black uppercase tracking-wide text-gray-950 shadow-lg shadow-yellow-500/20 transition hover:from-amber-300 hover:to-yellow-400 disabled:opacity-60"
          >
            {buying && <Loader2 className="h-4 w-4 animate-spin" />}
            {buying ? "Opening checkout…" : `${wallet ? "Pay here" : "Get my plans"} — ${price}`}
          </button>
        </div>

        <div className="mt-5 border-t border-slate-800 pt-4">
          {sent ? (
            <p className="flex items-center gap-2 text-sm text-emerald-300">
              <Check className="h-4 w-4 shrink-0" /> Sent. Your design and the {price} price are in your inbox.
            </p>
          ) : (
            <form onSubmit={submit}>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-stone-200">
                <Mail className="h-4 w-4 text-yellow-400" /> Not ready? Email me my design + this price
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  aria-label="Email address"
                  className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none placeholder:text-stone-600 focus:border-yellow-400"
                />
                <button
                  type="submit"
                  disabled={sending || !email}
                  className="shrink-0 rounded-xl border border-slate-600 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
                </button>
              </div>
              {error && <p className="mt-2 text-xs text-amber-400">{error}</p>}
            </form>
          )}
        </div>

        <button type="button" onClick={onClose} className="mt-4 w-full text-center text-xs font-semibold text-stone-500 hover:text-stone-300">
          No thanks
        </button>
      </div>
    </div>,
    document.body,
  );
}
