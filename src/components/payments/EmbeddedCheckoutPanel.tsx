"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Stripe's payment form, inside our own page
//
// Used by every plan purchase (/plans/checkout, /plans/[slug], /plans/jig,
// the guide upgrade on /plans/build). The session is created server-side by
// createEmbeddedCheckoutSession, which also sets the form's dark/yellow
// branding. When payment completes Stripe sends the page to the session's
// return_url, the same page the hosted checkout used to land on.
//
// Rendered into document.body: a parent with a CSS transform (the page's
// fade-in animations) would otherwise pin the "fixed" panel to that parent
// instead of the screen.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Loader2, Lock, X } from "lucide-react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";

import { getStripePromise } from "@/lib/stripe/client";

export default function EmbeddedCheckoutPanel({
  clientSecret,
  onClose,
}: {
  clientSecret: string;
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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Secure checkout"
      className="fixed inset-0 z-[100] flex justify-center bg-black/80 backdrop-blur-sm sm:items-start sm:overflow-y-auto sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-900 sm:h-auto sm:max-w-lg sm:rounded-2xl sm:border sm:border-slate-700 sm:shadow-2xl">
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-950 px-4 py-2.5">
          <Image src="/landing_page_logo.png" alt="Storage Network" width={78} height={30} className="h-7 w-auto" />
          <p className="flex flex-1 items-center gap-1.5 text-xs font-semibold text-stone-300">
            <Lock className="h-3.5 w-3.5 text-yellow-400" aria-hidden /> Secure checkout
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-stone-300 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto sm:min-h-[560px]">
          {/* Shows until Stripe paints the form over it. */}
          <div className="pointer-events-none absolute inset-x-0 top-24 flex flex-col items-center gap-3 text-sm text-stone-400">
            <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
            Loading secure checkout…
          </div>
          <div className="relative">
            <EmbeddedCheckoutProvider stripe={getStripePromise()} options={{ clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
