"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle, Heart } from "lucide-react";
import { createBalanceCheckout, getBalanceSummary } from "@/app/actions/payments";
import { MAX_TIP_DOLLARS } from "@/lib/lead-money";

// ═══════════════════════════════════════════════════════════════════════════
// Balance Payment Page — /payment/collect/[leadId]
//
// Permanent link that never expires (sent by the installer from the job
// ticket via email or copied link). When the customer visits:
//   1. Shows their remaining balance and an optional free-form tip field
//   2. "Pay" creates a fresh Stripe Checkout Session (balance + tip line)
//   3. Redirects them to Stripe to pay
//
// The tip carries no platform fee and no sales tax — it all goes to the
// installer (see createBalanceCheckout).
//
// If already paid, shows a "paid" confirmation instead.
// ═══════════════════════════════════════════════════════════════════════════

function money(n: number): string {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Keep only digits and one decimal point with at most 2 decimals.
function sanitizeTip(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("").slice(0, 2)}`;
}

export default function BalancePaymentPage() {
  const params = useParams();
  const leadId = params.leadId as string;

  const [status, setStatus] = useState<"loading" | "ready" | "redirecting" | "paid" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [balance, setBalance] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [tipInput, setTipInput] = useState("");

  function loadSummary() {
    setStatus("loading");
    setErrorMsg("");
    getBalanceSummary(leadId).then((result) => {
      if (result.success && result.balance) {
        setBalance(result.balance);
        setBusinessName(result.businessName || "your installer");
        setFirstName(result.customerFirstName || "");
        setStatus("ready");
      } else if (result.alreadyPaid) {
        setStatus("paid");
      } else {
        setErrorMsg(result.error || "Something went wrong.");
        setStatus("error");
      }
    });
  }

  useEffect(() => {
    if (!leadId) return;
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const tip = Number(tipInput) || 0;
  const tipTooLarge = tip > MAX_TIP_DOLLARS;
  const total = Math.round((balance + tip) * 100) / 100;

  function handlePay() {
    if (tipTooLarge) return;
    setStatus("redirecting");
    createBalanceCheckout(leadId, tip > 0 ? tip : null).then((result) => {
      if (result.success && result.url) {
        window.location.href = result.url;
      } else if (result.alreadyPaid) {
        setStatus("paid");
      } else {
        setErrorMsg(result.error || "Something went wrong.");
        setStatus("error");
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center sm:p-8">
        {(status === "loading" || status === "redirecting") && (
          <>
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-yellow-400" />
            <h1 className="mb-2 text-lg font-bold text-white">
              {status === "loading" ? "Loading your balance..." : "Preparing your payment..."}
            </h1>
            {status === "redirecting" && (
              <p className="text-sm text-stone-400">
                You&apos;ll be redirected to checkout in a moment.
              </p>
            )}
          </>
        )}

        {status === "ready" && (
          <div className="text-left">
            <h1 className="mb-1 text-center text-xl font-bold text-white">
              {firstName ? `Hi ${firstName},` : "Remaining Balance"}
            </h1>
            <p className="mb-6 text-center text-sm text-stone-400">
              Here&apos;s the remaining balance for your build with{" "}
              <span className="font-semibold text-yellow-400">{businessName}</span>.
            </p>

            <div className="mb-5 rounded-xl border border-slate-700 bg-slate-800/60 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-stone-400">Balance due</span>
                <span className="text-lg font-bold text-white">{money(balance)}</span>
              </div>
            </div>

            <label htmlFor="tip" className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-white">
              <Heart className="h-4 w-4 text-pink-400" />
              Add a tip <span className="font-normal text-stone-500">(optional)</span>
            </label>
            <p className="mb-2 text-xs text-stone-500">
              100% of your tip goes to {businessName}.
            </p>
            <div className="relative mb-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
              <input
                id="tip"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={tipInput}
                onChange={(e) => setTipInput(sanitizeTip(e.target.value))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 py-3 pl-7 pr-3 text-base text-white placeholder:text-stone-600 focus:border-yellow-400 focus:outline-none"
              />
            </div>
            {tipTooLarge && (
              <p className="mb-2 text-xs text-red-400">
                Tip can&apos;t be more than {money(MAX_TIP_DOLLARS)}.
              </p>
            )}

            <div className="mb-5 mt-4 space-y-1 border-t border-slate-800 pt-4 text-sm">
              <div className="flex justify-between text-stone-400">
                <span>Balance</span>
                <span>{money(balance)}</span>
              </div>
              {tip > 0 && (
                <div className="flex justify-between text-stone-400">
                  <span>Tip</span>
                  <span>{money(tip)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 text-base font-bold text-white">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>

            <button
              onClick={handlePay}
              disabled={tipTooLarge}
              className="w-full rounded-lg bg-yellow-400 px-6 py-3.5 text-sm font-black uppercase tracking-wide text-gray-950 transition-colors hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Pay {money(total)} &rarr;
            </button>
            <p className="mt-3 text-center text-[11px] text-stone-600">
              Payments processed securely via Stripe.
            </p>
          </div>
        )}

        {status === "paid" && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <h1 className="mb-2 text-xl font-bold text-white">
              Already Paid!
            </h1>
            <p className="mb-6 text-sm text-stone-400">
              This order has already been paid. No further action needed.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            >
              Back to Home
            </a>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
            <h1 className="mb-2 text-xl font-bold text-white">
              Payment Unavailable
            </h1>
            <p className="mb-6 text-sm text-stone-400">{errorMsg}</p>
            <button
              onClick={loadSummary}
              className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-6 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
