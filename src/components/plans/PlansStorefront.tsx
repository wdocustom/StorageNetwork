"use client";

// ═══════════════════════════════════════════════════════════════════════════
// /plans interactive pieces — the server page renders all the copy; only
// the buy button and the resend-link form need the browser.
// ═══════════════════════════════════════════════════════════════════════════

import { CONTACT_EMAIL } from "@/lib/plan-library";
import { useState } from "react";
import { CheckCircle, Loader2, Mail } from "lucide-react";

// ── Buy button (fixed-price plans) ───────────────────────────────────────────

export function BuyPlanButton({ planId, priceDisplay }: { planId: string; priceDisplay: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleBuy() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/plans/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout failed");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <>
      {error && (
        <p className="mt-3 text-xs font-medium text-red-400">{error}</p>
      )}

      <button
        onClick={handleBuy}
        disabled={loading}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:from-amber-300 hover:to-yellow-400 disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirecting…
          </>
        ) : (
          `Get the Plans — ${priceDisplay}`
        )}
      </button>
    </>
  );
}

// ── Resend Link Panel ────────────────────────────────────────────────────────

export function ResendLinkPanel() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/plans/resend-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id="resend" className="scroll-mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Mail className="h-4 w-4 text-stone-500" />
        <h2 className="text-sm font-bold text-white">Already purchased?</h2>
      </div>
      <p className="mb-4 text-xs text-stone-500">
        Lost your access link? Enter your purchase email and we&apos;ll resend it.
      </p>

      {sent ? (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-3">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-emerald-300">
              If we have a purchase on file for that email, the link is on its way.
            </p>
            <p className="mt-1 text-xs text-stone-400">
              Not there in a few minutes? Check your junk or spam folder for mail from orders@storage-network.app.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleResend} className="flex gap-2">
          <label htmlFor="resend-email" className="sr-only">
            Purchase email
          </label>
          <input
            id="resend-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-stone-600 outline-none focus:border-yellow-400"
          />
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="shrink-0 rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-600 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend"}
          </button>
        </form>
      )}
      <p className="mt-3 text-[11px] text-stone-500">
        Still stuck? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-stone-300 hover:text-yellow-400">
          {CONTACT_EMAIL}
        </a>
      </p>
    </div>
  );
}
