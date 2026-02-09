"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { XCircle, Home, RefreshCw } from "lucide-react";

// =============================================================================
// Payment Cancelled — Customer cancelled or closed the payment page
// =============================================================================

export default function PaymentCancelledPage() {
  return (
    <Suspense>
      <PaymentCancelledInner />
    </Suspense>
  );
}

function PaymentCancelledInner() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job") || "";

  return (
    <div className="relative min-h-screen bg-slate-950">
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 40%, rgba(239,68,68,0.06) 0%, transparent 50%)",
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">
        {/* Cancelled badge */}
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20 shadow-lg shadow-red-500/10 ring-2 ring-red-500/30">
          <XCircle className="h-10 w-10 text-red-400" />
        </div>

        {/* Headline */}
        <h1 className="mb-2 text-center text-4xl font-black uppercase tracking-tight text-white sm:text-5xl">
          Payment{" "}
          <span className="text-red-400">Cancelled</span>
        </h1>

        {/* Subheadline */}
        <p className="mb-8 max-w-md text-center text-lg text-stone-400">
          Your payment was not completed. No charges have been made to your card.
        </p>

        {/* Info box */}
        <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900 px-6 py-4">
          <p className="text-sm text-stone-400">
            If you need to complete your payment, check your email for the
            payment link or contact your installer.
          </p>
        </div>

        {/* Job reference (if available) */}
        {jobId && (
          <p className="mb-6 text-xs text-stone-500">
            Reference: <span className="font-mono text-stone-400">{jobId.slice(0, 8)}</span>
          </p>
        )}

        <div className="flex gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
