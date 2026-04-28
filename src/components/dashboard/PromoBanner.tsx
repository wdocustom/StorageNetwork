"use client";

import { useState, useEffect } from "react";
import { X, Zap, CreditCard } from "lucide-react";

const BANNER_DISMISS_KEY = "promo-banner-dismissed-v2";

interface PromoBannerProps {
  isPro?: boolean;
  isTrialActive?: boolean;
  hasStripeConnected?: boolean;
}

export default function PromoBanner({
  hasStripeConnected = false,
}: PromoBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(BANNER_DISMISS_KEY);
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  function handleDismiss() {
    setVisible(false);
    localStorage.setItem(BANNER_DISMISS_KEY, new Date().toISOString());
  }

  if (!visible) return null;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-yellow-500/30 bg-slate-900/95 shadow-lg shadow-yellow-400/5">
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 z-10 rounded-lg p-1 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="h-1 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500" />

      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-yellow-400">
            <Zap className="h-3.5 w-3.5 text-gray-950" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-yellow-400">
            Pro Pricing
          </p>
        </div>

        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-xl text-stone-500 line-through">$99</span>
          <span className="text-3xl font-black text-white">$49</span>
          <span className="text-sm text-stone-400">/mo</span>
          <span className="ml-auto rounded-full bg-red-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
            Launch Price
          </span>
        </div>

        <div className="mb-3 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-stone-300">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[8px] font-bold text-emerald-400">
              &#10003;
            </span>
            <span>
              Only <span className="font-bold text-emerald-400">3% maintenance fee</span> on direct leads
            </span>
          </div>
          {!hasStripeConnected && (
            <div className="flex items-center gap-2 text-xs text-amber-300">
              <CreditCard className="h-4 w-4 flex-shrink-0 text-amber-400" />
              <span>
                <span className="font-bold">Connect your Stripe</span> to receive deposit splits automatically
              </span>
            </div>
          )}
        </div>

        {!hasStripeConnected && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
            <p className="text-[11px] leading-relaxed text-stone-300">
              Orders in your area collect a{" "}
              <span className="font-bold text-white">15% deposit</span> — with Stripe
              connected, <span className="font-bold text-emerald-400">12% goes to you</span> and
              only 3% stays with the platform.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
