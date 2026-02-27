"use client";

import { useState, useEffect } from "react";
import { X, Zap, CreditCard, ArrowRight } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Promo Banner — Floating announcement for pricing changes
//
// Highlights:
// - Pro price drop: $99 → $49 (first 50 subscribers)
// - Platform fee drop: 5% → 3%
// - Deposit split: 12% back to installer Stripe
// - Stripe connect reminder
// - Dismissible via localStorage
// ═══════════════════════════════════════════════════════════════════════════

const BANNER_DISMISS_KEY = "promo-banner-dismissed-v1";

interface PromoBannerProps {
  isPro?: boolean;
  isTrialActive?: boolean;
  hasStripeConnected?: boolean;
}

export default function PromoBanner({
  isPro = false,
  isTrialActive = false,
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

  // Trial users get a more urgent message
  const isTrialUser = isTrialActive && !isPro;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-yellow-500/30 bg-slate-900/95 shadow-2xl shadow-yellow-400/10 backdrop-blur-sm">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 z-10 rounded-lg p-1 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Top accent */}
        <div className="h-1 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500" />

        <div className="p-4">
          {/* Header */}
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-yellow-400">
              <Zap className="h-3.5 w-3.5 text-gray-950" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-yellow-400">
                {isTrialUser ? "Your Trial is Active" : "New Pro Pricing"}
              </p>
            </div>
          </div>

          {/* Main pricing announcement */}
          <div className="mb-3 flex items-baseline gap-2">
            <span className="text-xl text-stone-500 line-through">$99</span>
            <span className="text-3xl font-black text-white">$49</span>
            <span className="text-sm text-stone-400">/mo</span>
            <span className="ml-auto rounded-full bg-red-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
              First 50 only
            </span>
          </div>

          {/* Key changes */}
          <div className="mb-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-stone-300">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[8px] font-bold text-emerald-400">
                &#10003;
              </span>
              <span>
                Platform fee dropped to <span className="font-bold text-emerald-400">3%</span>{" "}
                <span className="text-stone-500">(was 5%)</span>
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

          {/* CTA — context-aware */}
          {isTrialUser && (
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-400/5 p-2.5">
              <p className="text-[11px] leading-relaxed text-stone-300">
                You&apos;re on a Pro trial — lock in the{" "}
                <span className="font-bold text-yellow-400">$49/mo launch price</span> before the
                first 50 spots fill. This price won&apos;t last.
              </p>
            </div>
          )}

          {isPro && !hasStripeConnected && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
              <p className="text-[11px] leading-relaxed text-stone-300">
                You&apos;re Pro, but your Stripe isn&apos;t connected yet. Orders in your area
                collect a <span className="font-bold text-white">15% deposit</span> — with Stripe
                connected, <span className="font-bold text-emerald-400">12% goes to you</span> and
                only 3% stays with the platform.
              </p>
            </div>
          )}

          {!isPro && !isTrialUser && (
            <a
              href="/dashboard/profile"
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300"
            >
              <Zap className="h-3.5 w-3.5" />
              Upgrade to Pro
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
