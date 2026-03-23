"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { createBalanceCheckout } from "@/app/actions/payments";

// ═══════════════════════════════════════════════════════════════════════════
// Balance Payment Page — /payment/collect/[leadId]
//
// Permanent link that never expires. When the customer visits:
//   1. Creates a fresh Stripe Checkout Session
//   2. Redirects them to Stripe to pay
//
// If already paid, shows a "paid" confirmation instead.
// ═══════════════════════════════════════════════════════════════════════════

export default function BalancePaymentPage() {
  const params = useParams();
  const leadId = params.leadId as string;

  const [status, setStatus] = useState<"loading" | "paid" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!leadId) return;

    createBalanceCheckout(leadId).then((result) => {
      if (result.success && result.url) {
        // Redirect to fresh Stripe Checkout
        window.location.href = result.url;
      } else if (result.alreadyPaid) {
        setStatus("paid");
      } else {
        setErrorMsg(result.error || "Something went wrong.");
        setStatus("error");
      }
    });
  }, [leadId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-yellow-400" />
            <h1 className="mb-2 text-lg font-bold text-white">
              Preparing your payment...
            </h1>
            <p className="text-sm text-stone-400">
              You&apos;ll be redirected to checkout in a moment.
            </p>
          </>
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
              onClick={() => {
                setStatus("loading");
                setErrorMsg("");
                createBalanceCheckout(leadId).then((result) => {
                  if (result.success && result.url) {
                    window.location.href = result.url;
                  } else {
                    setErrorMsg(result.error || "Something went wrong.");
                    setStatus("error");
                  }
                });
              }}
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
