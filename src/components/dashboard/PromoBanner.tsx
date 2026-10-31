"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Zap, CreditCard } from "lucide-react";
import ProPrice from "@/components/ProPrice";
import { PRO_FREE_PROMO } from "@/config/pro-pricing";

// New key per offer, so a banner dismissed under the old price shows the free offer.
const BANNER_DISMISS_KEY = PRO_FREE_PROMO ? "promo-banner-dismissed-free-pro" : "promo-banner-dismissed-v2";

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
            {PRO_FREE_PROMO ? "Pro is free right now" : "Pro Pricing"}
          </p>
        </div>

        <div className="mb-3">
          <ProPrice />
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

        {PRO_FREE_PROMO && (
          <Link
            href="/upgrade"
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-2.5 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:bg-yellow-300"
          >
            <Zap className="h-4 w-4" />
            Get Pro free
          </Link>
        )}

        {!hasStripeConnected && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
            <p className="text-[11px] leading-relaxed text-stone-300">
              Orders in your area collect a{" "}
              <span className="font-bold text-white">15% deposit</span>. Connect
              Stripe to get the installer share routed to you instantly on every
              direct lead — the platform keeps a flat{" "}
              <span className="font-bold text-emerald-400">3%</span> on those,
              and <span className="font-bold text-emerald-400">15%</span> on
              network leads we send you.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
