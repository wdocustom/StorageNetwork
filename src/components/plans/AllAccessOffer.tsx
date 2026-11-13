"use client";

// ═══════════════════════════════════════════════════════════════════════════
// All-Access — the one tote plan product, as shown in the designer
//
//   AllAccessOffer  — first-time buyers: $19 once, unlimited plans for life
//   IncludedPlanCard — buyers who already own it: generate this design's
//                      plan at no charge (createIncludedPlan)
//   BuildForALiving — the side-income invitation shown after purchase
// ═══════════════════════════════════════════════════════════════════════════

import Link from "next/link";
import { ArrowRight, Box, CheckCircle, FileText, Hammer, Infinity as InfinityIcon, Loader2, Sparkles } from "lucide-react";

import { TOTE_PLAN_ALL_ACCESS, formatPlanPrice, type TotePlanTier } from "@/lib/tote-plans";

const PRICE = formatPlanPrice(TOTE_PLAN_ALL_ACCESS.price);

export function AllAccessOffer({
  loading,
  onBuy,
  onSample,
  wallet,
}: {
  loading: boolean;
  onBuy: () => void;
  onSample: (tier: TotePlanTier) => void;
  /** Inside Facebook / Instagram: the "Buy with Apple / Google Pay" escape, shown first */
  wallet?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-yellow-400/40 bg-slate-900 p-5">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-yellow-400">
            <InfinityIcon className="h-4 w-4" /> Unlimited plans
          </p>
          <h3 className="mt-1 text-lg font-black leading-tight text-white">Get the plan for this design</h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-4xl font-black leading-none text-white">{PRICE}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-yellow-400">Once, for life</p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-stone-300">
        Plus a free plan for <strong className="text-white">every tote organizer you design after it</strong>. Your
        garage today, the shed next spring.
      </p>

      <ul className="mt-3 grid gap-x-3 gap-y-1.5 text-xs text-stone-300 sm:grid-cols-2">
        {["Unlimited plans, any size", "Interactive 3D build guide", "Printable PDF with cut list", "No subscription, ever"].map(
          (item) => (
            <li key={item} className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              {item}
            </li>
          )
        )}
      </ul>

      {wallet && (
        <div className="mt-4">
          {wallet}
          <p className="my-3 flex items-center gap-3 text-[11px] uppercase tracking-widest text-stone-600">
            <span className="h-px flex-1 bg-slate-700" /> or pay here <span className="h-px flex-1 bg-slate-700" />
          </p>
        </div>
      )}
      <button
        onClick={onBuy}
        disabled={loading}
        className={`${wallet ? "" : "mt-4 "}flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-4 text-base font-black uppercase tracking-wide text-gray-950 shadow-lg shadow-yellow-500/20 transition hover:from-amber-300 hover:to-yellow-400 disabled:opacity-60`}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Opening checkout…" : `Get my plans — ${PRICE}`}
      </button>
      <p className="mt-2 text-center text-[11px] text-stone-500">
        Instant access · link by email · all sales final
      </p>
      <p className="mt-2 flex items-center justify-center gap-3 text-xs text-stone-400">
        See a sample:
        <button type="button" onClick={() => onSample("interactive")} className="inline-flex items-center gap-1 font-semibold text-yellow-300 hover:underline">
          <Box className="h-3.5 w-3.5" /> 3D guide
        </button>
        <button type="button" onClick={() => onSample("pdf")} className="inline-flex items-center gap-1 font-semibold text-yellow-300 hover:underline">
          <FileText className="h-3.5 w-3.5" /> PDF
        </button>
      </p>
    </div>
  );
}

export function IncludedPlanCard({
  emailHint,
  loading,
  onGenerate,
}: {
  emailHint: string;
  loading: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5 text-center sm:p-6">
      <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-emerald-300">
        <Sparkles className="h-4 w-4" /> Included with your All-Access plans
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-stone-300">
        You own unlimited tote organizer plans ({emailHint}). Generate this design&apos;s plan, with the 3D guide and the
        PDF, at no charge.
      </p>
      <button
        onClick={onGenerate}
        disabled={loading}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-black uppercase tracking-wider text-white transition hover:bg-emerald-500 disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Generating your plan…" : "Generate this plan — included"}
      </button>
    </div>
  );
}

/** "Building these for others?" — the installer program, for buyers who caught the bug. */
export function BuildForALiving({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-950 p-5 ${className}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-yellow-400">
        <Hammer className="h-4 w-4" /> Side income
      </p>
      <h3 className="mt-1 text-base font-black text-white">Interested in building these for a living?</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-stone-400">
        Neighbors pay real money for a garage like yours. Storage Network installers get customers who design and
        pay a deposit online, exact cut lists for every job, and instant payouts. Start on the side, keep your day job.
      </p>
      <Link
        href="/join?src=plans"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-yellow-300 hover:text-yellow-200"
      >
        See how installers earn <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
