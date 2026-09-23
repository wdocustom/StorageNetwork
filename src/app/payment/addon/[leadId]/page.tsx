"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle, PlusCircle } from "lucide-react";
import { createAddonDepositCheckout, getAddonDepositSummary } from "@/app/actions/payments";

// ═══════════════════════════════════════════════════════════════════════════
// Add-On Deposit Page — /payment/addon/[leadId]
//
// Permanent link for the deposit on items the installer added after the
// original deposit was paid (e.g. a plywood top). Shows what was added and
// the deposit due, then creates a fresh Stripe Checkout Session on "Pay".
// The rest of each add-on is simply part of the final balance.
// ═══════════════════════════════════════════════════════════════════════════

function money(n: number): string {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Item = { description: string; amount: number; deposit: number };

export default function AddonDepositPage() {
  const params = useParams();
  const leadId = params.leadId as string;

  const [status, setStatus] = useState<"loading" | "ready" | "redirecting" | "nothing_due" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [depositTotal, setDepositTotal] = useState(0);

  function load() {
    setStatus("loading");
    setErrorMsg("");
    getAddonDepositSummary(leadId).then((result) => {
      if (result.success && result.items) {
        setItems(result.items);
        setDepositTotal(result.depositTotal || 0);
        setStatus("ready");
      } else if (result.alreadyPaid) {
        setStatus("nothing_due");
      } else {
        setErrorMsg(result.error || "Something went wrong.");
        setStatus("error");
      }
    });
  }

  useEffect(() => {
    if (!leadId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  function handlePay() {
    setStatus("redirecting");
    createAddonDepositCheckout(leadId).then((result) => {
      if (result.success && result.url) {
        window.location.href = result.url;
      } else if (result.alreadyPaid) {
        setStatus("nothing_due");
      } else {
        setErrorMsg(result.error || "Something went wrong.");
        setStatus("error");
      }
    });
  }

  const addedTotal = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center sm:p-8">
        {(status === "loading" || status === "redirecting") && (
          <>
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-yellow-400" />
            <h1 className="mb-2 text-lg font-bold text-white">
              {status === "loading" ? "Loading..." : "Preparing your payment..."}
            </h1>
          </>
        )}

        {status === "ready" && (
          <div className="text-left">
            <PlusCircle className="mx-auto mb-3 h-10 w-10 text-yellow-400" />
            <h1 className="mb-1 text-center text-xl font-bold text-white">Items Added to Your Order</h1>
            <p className="mb-5 text-center text-sm text-stone-400">
              A deposit is due on the added items. The rest is added to your remaining balance.
            </p>

            <div className="mb-5 space-y-2 rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-sm">
              {items.map((item, i) => (
                <div key={i} className="flex justify-between gap-3 text-stone-300">
                  <span>{item.description}</span>
                  <span className="shrink-0">{money(item.amount)}</span>
                </div>
              ))}
              {items.length > 1 && (
                <div className="flex justify-between border-t border-slate-700 pt-2 text-stone-400">
                  <span>Added total</span>
                  <span>{money(addedTotal)}</span>
                </div>
              )}
            </div>

            <div className="mb-5 flex items-baseline justify-between">
              <span className="text-sm font-semibold text-white">Deposit due now</span>
              <span className="text-2xl font-black text-yellow-400">{money(depositTotal)}</span>
            </div>

            <button
              onClick={handlePay}
              className="w-full rounded-lg bg-yellow-400 px-6 py-3.5 text-sm font-black uppercase tracking-wide text-gray-950 transition-colors hover:bg-yellow-300"
            >
              Pay {money(depositTotal)} &rarr;
            </button>
            <p className="mt-3 text-center text-[11px] text-stone-600">
              Payments processed securely via Stripe.
            </p>
          </div>
        )}

        {status === "nothing_due" && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <h1 className="mb-2 text-xl font-bold text-white">You&apos;re All Set</h1>
            <p className="mb-6 text-sm text-stone-400">
              There&apos;s no add-on deposit due on this order.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
            <h1 className="mb-2 text-xl font-bold text-white">Payment Unavailable</h1>
            <p className="mb-6 text-sm text-stone-400">{errorMsg}</p>
            <button
              onClick={load}
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
