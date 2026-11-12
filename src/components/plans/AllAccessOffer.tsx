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

import { PlanSampleThumb } from "@/components/plans/PlanSample";
import { TOTE_PLAN_ALL_ACCESS, formatPlanPrice, type TotePlanTier } from "@/lib/tote-plans";

const PRICE = formatPlanPrice(TOTE_PLAN_ALL_ACCESS.price);

export function AllAccessOffer({
  loading,
  onBuy,
  onSample,
}: {
  loading: boolean;
  onBuy: () => void;
  onSample: (tier: TotePlanTier) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-yellow-400/40 bg-slate-900 p-5 sm:p-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-yellow-400">
            <InfinityIcon className="h-4 w-4" /> Unlimited plans
          </p>
          <h3 className="mt-1 text-xl font-black text-white">{TOTE_PLAN_ALL_ACCESS.name}</h3>
          <p className="mt-1 text-sm text-stone-400">{TOTE_PLAN_ALL_ACCESS.tagline}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-4xl font-black leading-none text-white">{PRICE}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-yellow-400">Lifetime · one time</p>
        </div>
      </div>

      <p className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm leading-relaxed text-stone-300">
        Most plans cover one size. Yours covers <strong className="text-white">every size you design</strong>: get
        this plan today, then come back for your garage, your shed, a friend&apos;s basement. Every new plan is free.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-stone-300">
            <Box className="h-3.5 w-3.5 text-yellow-400" /> Interactive 3D guide
          </p>
          <PlanSampleThumb tier="interactive" onOpen={() => onSample("interactive")} />
        </div>
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-stone-300">
            <FileText className="h-3.5 w-3.5 text-yellow-400" /> Printable PDF
          </p>
          <PlanSampleThumb tier="pdf" onOpen={() => onSample("pdf")} />
        </div>
      </div>

      <ul className="mb-5 mt-4 space-y-2">
        {TOTE_PLAN_ALL_ACCESS.includes.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-stone-300">
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            {item}
          </li>
        ))}
      </ul>

      <button
        onClick={onBuy}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:from-amber-300 hover:to-yellow-400 disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Opening checkout…" : `Get All-Access — ${PRICE} lifetime`}
      </button>
      <p className="mt-2 text-center text-[11px] text-stone-500">
        One payment. No subscription. We email you a permanent link, no account needed.
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
