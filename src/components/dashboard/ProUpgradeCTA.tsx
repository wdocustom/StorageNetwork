"use client";

import { useState } from "react";
import {
  Zap,
  Percent,
  Link2,
  Palette,
  ArrowRight,
  Loader2,
  Check,
  Sparkles,
  Calculator,
  Minus,
  Plus,
  DollarSign,
  QrCode,
} from "lucide-react";
import { createProCheckoutSession } from "@/app/actions/pro-subscription";

// ═══════════════════════════════════════════════════════════════════════════
// Pro Upgrade CTA — Persistent call-to-action for profile page
// Highlights benefits and links to Stripe checkout
// Includes interactive fee comparison calculator
// ═══════════════════════════════════════════════════════════════════════════

interface ProUpgradeCTAProps {
  userId: string;
}

const BENEFITS = [
  {
    icon: Percent,
    title: "Only 5% Platform Fee",
    description: "Keep more of every job. Drops from 15% to just 5%.",
  },
  {
    icon: Link2,
    title: "Custom Branded Link",
    description: "Your business name in the URL, not a random ID.",
  },
  {
    icon: Palette,
    title: "White-Label Branding",
    description: "Your logo on the design tool. Your brand, your clients.",
  },
  {
    icon: DollarSign,
    title: "Custom Pricing",
    description: "Set your own prices for slots, totes, and add-ons.",
  },
  {
    icon: QrCode,
    title: "Custom QR Code",
    description: "A branded QR code that links directly to your design page.",
  },
];

// Pricing constants (matches /design calculator)
const PRICE_PER_SLOT = 30; // $30 per storage opening
const TOTE_PRICE = 12; // $12 per tote
const WHEELS_PRICE = 65; // $65 flat for wheels

const FREE_PLATFORM_FEE = 0.15; // 15%
const PRO_PLATFORM_FEE = 0.05; // 5%
const PRO_MONTHLY_COST = 99;

function calculateJobPrice(slots: number): number {
  // Standard unit with totes and wheels (most common configuration)
  const basePrice = slots * PRICE_PER_SLOT;
  const totesPrice = slots * TOTE_PRICE;
  return basePrice + totesPrice + WHEELS_PRICE;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProUpgradeCTA({ userId }: ProUpgradeCTAProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [slots, setSlots] = useState(16); // Default: 4x4 unit

  const jobPrice = calculateJobPrice(slots);
  const freeFee = Math.round(jobPrice * FREE_PLATFORM_FEE);
  const proFee = Math.round(jobPrice * PRO_PLATFORM_FEE);
  const savings = freeFee - proFee;

  // Calculate how many jobs to break even on Pro
  const jobsToBreakEven = Math.ceil(PRO_MONTHLY_COST / savings);

  async function handleUpgrade() {
    setLoading(true);
    setError("");

    const result = await createProCheckoutSession(userId);

    if (result.success && result.url) {
      window.location.href = result.url;
    } else {
      setError(result.error || "Failed to start checkout");
      setLoading(false);
    }
  }

  function adjustSlots(delta: number) {
    setSlots((prev) => Math.max(1, Math.min(36, prev + delta)));
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 via-slate-900 to-slate-900">
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-yellow-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-yellow-400/10 blur-2xl" />

      <div className="relative p-5">
        {/* Header */}
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400">
            <Zap className="h-4 w-4 text-gray-950" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-yellow-400">
              Upgrade to Pro
            </h2>
            <p className="text-[11px] text-stone-500">
              Maximize your earnings
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1 rounded-full bg-yellow-400/20 px-2.5 py-1">
            <Sparkles className="h-3 w-3 text-yellow-400" />
            <span className="text-xs font-bold text-yellow-400">$99/mo</span>
          </div>
        </div>

        {/* Tagline */}
        <p className="mb-4 text-lg font-bold text-white">
          One job covers the cost. Keep 10% more on every job after.
        </p>

        {/* Benefits */}
        <div className="mb-5 space-y-3">
          {BENEFITS.map((benefit) => (
            <div
              key={benefit.title}
              className="flex items-start gap-3 rounded-xl bg-slate-800/50 p-3"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-yellow-400/10">
                <benefit.icon className="h-4 w-4 text-yellow-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  {benefit.title}
                </p>
                <p className="text-xs text-stone-500">{benefit.description}</p>
              </div>
              <Check className="ml-auto h-4 w-4 flex-shrink-0 text-emerald-400" />
            </div>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            Interactive Fee Calculator
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-5 rounded-xl border border-slate-700 bg-slate-800/80 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Calculator className="h-4 w-4 text-yellow-400" />
            <h3 className="text-sm font-bold text-white">See Your Savings</h3>
          </div>

          {/* Slot Input */}
          <div className="mb-4">
            <label className="mb-2 block text-xs text-stone-400">
              Total tote sections (columns × tiers)
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => adjustSlots(-1)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600 bg-slate-700 text-white transition-colors hover:bg-slate-600"
              >
                <Minus className="h-4 w-4" />
              </button>

              <div className="relative flex-1">
                <input
                  type="range"
                  min="1"
                  max="36"
                  value={slots}
                  onChange={(e) => setSlots(parseInt(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-yellow-400"
                />
                <div className="mt-1 flex justify-between text-[10px] text-stone-600">
                  <span>1</span>
                  <span>12</span>
                  <span>24</span>
                  <span>36</span>
                </div>
              </div>

              <button
                onClick={() => adjustSlots(1)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600 bg-slate-700 text-white transition-colors hover:bg-slate-600"
              >
                <Plus className="h-4 w-4" />
              </button>

              <div className="flex h-10 w-16 items-center justify-center rounded-lg border border-yellow-500/50 bg-yellow-400/10">
                <span className="text-lg font-bold text-yellow-400">
                  {slots}
                </span>
              </div>
            </div>
          </div>

          {/* Job Price Display */}
          <div className="mb-4 rounded-lg bg-slate-900/50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-400">
                Estimated job price
              </span>
              <span className="text-sm font-semibold text-white">
                {formatCurrency(jobPrice)}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-stone-600">
              {slots} sections with totes + wheels
            </p>
          </div>

          {/* Fee Comparison */}
          <div className="grid grid-cols-2 gap-3">
            {/* Free Plan */}
            <div className="rounded-lg border border-slate-600 bg-slate-900/50 p-3">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-stone-500">
                Free Plan
              </p>
              <p className="text-xl font-bold text-red-400">
                {formatCurrency(freeFee)}
              </p>
              <p className="text-[10px] text-stone-500">15% platform fee</p>
            </div>

            {/* Pro Plan */}
            <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-emerald-400">
                Pro Plan
              </p>
              <p className="text-xl font-bold text-emerald-400">
                {formatCurrency(proFee)}
              </p>
              <p className="text-[10px] text-stone-500">5% platform fee</p>
            </div>
          </div>

          {/* Savings Highlight */}
          <div className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-400/10 p-3 text-center">
            <p className="text-xs text-stone-400">You save per job</p>
            <p className="text-2xl font-black text-yellow-400">
              {formatCurrency(savings)}
            </p>
            <p className="mt-1 text-[11px] text-stone-500">
              {jobsToBreakEven === 1
                ? "Pro pays for itself in 1 job"
                : `Pro pays for itself in ${jobsToBreakEven} jobs`}
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-sm font-black uppercase tracking-widest text-gray-950 shadow-lg shadow-yellow-400/25 transition-all hover:bg-yellow-300 hover:shadow-yellow-400/40 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Upgrade Now
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        {error && (
          <p className="mt-2 text-center text-xs font-medium text-red-400">
            {error}
          </p>
        )}

        {/* Fine print */}
        <p className="mt-3 text-center text-[11px] text-stone-600">
          Cancel anytime. No long-term contracts.
        </p>
      </div>
    </section>
  );
}
