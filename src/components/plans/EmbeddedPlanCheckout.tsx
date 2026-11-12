"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Plan checkout inside our own page (Stripe Embedded Checkout)
//
// The buyer never leaves storage-network.app: Stripe's payment form renders
// in a panel over /plans/checkout. Card, Apple Pay / Google Pay and Link work
// as on the hosted page. When payment completes, Stripe sends the page to
// the session's return_url (/plans/build?session_id=…), exactly where the
// hosted page used to send it.
//
// The form's own colors and logo come from the Stripe Dashboard
// (Settings → Branding).
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect } from "react";
import Image from "next/image";
import { Lock, X } from "lucide-react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";

import { getStripePromise } from "@/lib/stripe/client";

export default function EmbeddedPlanCheckout({
  clientSecret,
  title,
  price,
  onClose,
}: {
  clientSecret: string;
  /** "Interactive Build Guide — 3-unit tote rack" */
  title: string;
  /** "$29" */
  price: string;
  onClose: () => void;
}) {
  // Lock the page behind the panel and close on Escape.
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-checkout-title"
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/80 backdrop-blur-sm sm:items-start sm:overflow-y-auto sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex w-full flex-col bg-slate-950 sm:max-w-xl sm:rounded-2xl sm:border sm:border-slate-800">
        <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
          <Image src="/landing_page_logo.png" alt="Storage Network" width={84} height={32} className="h-8 w-auto" />
          <div className="min-w-0 flex-1">
            <p id="plan-checkout-title" className="truncate text-sm font-bold text-white">
              {title}
            </p>
            <p className="flex items-center gap-1 text-xs text-stone-400">
              <Lock className="h-3 w-3" aria-hidden /> Secure checkout · {price}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-stone-300 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-white sm:rounded-b-2xl">
          <EmbeddedCheckoutProvider stripe={getStripePromise()} options={{ clientSecret }}>
            <EmbeddedCheckout className="min-h-[540px]" />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    </div>
  );
}
