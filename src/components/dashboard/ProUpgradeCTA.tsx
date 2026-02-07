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
} from "lucide-react";
import { createProCheckoutSession } from "@/app/actions/pro-subscription";

// ═══════════════════════════════════════════════════════════════════════════
// Pro Upgrade CTA — Persistent call-to-action for profile page
// Highlights benefits and links to Stripe checkout
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
];

export default function ProUpgradeCTA({ userId }: ProUpgradeCTAProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
          One job pays for it. Every job after is pure profit.
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

        {/* ROI Calculator Hint */}
        <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
          <p className="text-xs text-stone-400">
            <span className="font-semibold text-white">Example:</span> On a
            $1,000 job, you save{" "}
            <span className="font-bold text-emerald-400">$100</span> in fees.
            Pro pays for itself on your first job each month.
          </p>
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
