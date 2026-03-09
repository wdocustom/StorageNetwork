"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════════════════
// Upsell Success Page — Shown after cleanout add-on payment completes
// ═══════════════════════════════════════════════════════════════════════════

function UpsellSuccessContent() {
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

        {/* Success Badge */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-950 border-2 border-green-600 mb-6">
          <span className="text-4xl">&#10003;</span>
        </div>

        <h1 className="text-2xl font-extrabold text-white mb-3">
          Service Added Successfully!
        </h1>

        <p className="text-slate-400 text-sm leading-relaxed mb-8">
          Your add-on service has been confirmed and added to your upcoming appointment.
          Your installer has been notified and will include this service during your visit.
          You&rsquo;ll receive a confirmation email shortly with all the details.
        </p>

        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 mb-8">
          <div className="flex items-center justify-center gap-2 text-green-400 text-sm font-semibold mb-2">
            <span>&#128274;</span>
            <span>Payment Processed</span>
          </div>
          <p className="text-slate-500 text-xs">
            A 50% deposit has been securely processed via Stripe.
            The remaining balance will be collected by your installer at the time of service.
          </p>
        </div>

        {jobId && (
          <Link
            href={`/success?jobId=${jobId}`}
            className="inline-block bg-yellow-400 text-slate-900 font-bold px-8 py-3 rounded-xl hover:bg-yellow-300 transition-colors text-sm uppercase tracking-wider"
          >
            View Full Order
          </Link>
        )}

        <p className="text-slate-600 text-xs mt-6">
          Questions? Check your email for your installer&rsquo;s contact info.
        </p>
      </div>
    </div>
  );
}

export default function UpsellSuccessPage() {
  return (
    <Suspense>
      <UpsellSuccessContent />
    </Suspense>
  );
}
