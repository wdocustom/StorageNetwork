"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

// ═══════════════════════════════════════════════════════════════════════════
// Upsell Cancel Page — Shown when customer cancels checkout
// ═══════════════════════════════════════════════════════════════════════════

function UpsellCancelContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job");

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        <img
          src="/landing_page_logo.png"
          alt="Storage Network"
          className="mx-auto w-16 h-16 mb-6"
        />

        <h1 className="text-xl font-bold text-white mb-3">
          No Worries!
        </h1>

        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          You haven&rsquo;t been charged. Your installation is still confirmed
          and on the calendar &mdash; the add-on service was not added.
        </p>

        <p className="text-slate-500 text-xs">
          Changed your mind? Check your email for the link to add a service anytime before your appointment.
        </p>
      </div>
    </div>
  );
}

export default function UpsellCancelPage() {
  return (
    <Suspense>
      <UpsellCancelContent />
    </Suspense>
  );
}
