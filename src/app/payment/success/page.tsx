"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Home, Mail } from "lucide-react";

// =============================================================================
// Payment Success — Thank You page after balance payment
// Public page accessible without authentication
// =============================================================================

export default function PaymentSuccessPage() {
  return (
    <Suspense>
      <PaymentSuccessInner />
    </Suspense>
  );
}

function PaymentSuccessInner() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job") || "";

  return (
    <div className="relative min-h-screen bg-slate-950">
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            "radial-gradient(ellipse at 50% 30%, rgba(16,185,129,0.10) 0%, transparent 50%)",
            "radial-gradient(ellipse at 50% 60%, rgba(250,204,21,0.05) 0%, transparent 40%)",
          ].join(", "),
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">
        {/* Success badge */}
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/30">
          <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        </div>

        {/* Headline */}
        <h1 className="mb-2 text-center text-4xl font-black uppercase tracking-tight text-white sm:text-5xl">
          Payment{" "}
          <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
            Complete!
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mb-8 max-w-md text-center text-lg text-stone-400">
          Thank you for your payment. Your installer has been notified and your
          job is now complete.
        </p>

        {/* Email prompt */}
        <div className="mb-8 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-6 py-4">
          <Mail className="h-5 w-5 shrink-0 text-emerald-400" />
          <p className="text-sm text-stone-400">
            A{" "}
            <span className="font-semibold text-white">payment receipt</span>{" "}
            has been sent to your email.
          </p>
        </div>

        {/* Job reference (if available) */}
        {jobId && (
          <p className="mb-6 text-xs text-stone-500">
            Reference: <span className="font-mono text-stone-400">{jobId.slice(0, 8)}</span>
          </p>
        )}

        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
        >
          <Home className="h-4 w-4" />
          Back to Home
        </a>
      </div>
    </div>
  );
}
