"use client";

// ═══════════════════════════════════════════════════════════════════════════
// All-Access — the one tote plan product, as shown in the designer
//
//   AllAccessOffer  — first-time buyers: $19 once, unlimited plans for life
//   IncludedPlanCard — buyers who already own it: generate this design's
//                      plan at no charge (createIncludedPlan)
//   BuildForALiving — the side-income invitation shown after purchase
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useId, useState } from "react";
import Stars from "@/components/reviews/Stars";
import Link from "next/link";
import { ArrowRight, Box, CheckCircle, FileText, Hammer, Infinity as InfinityIcon, Loader2, Sparkles, Tag, X } from "lucide-react";
import type { AppliedPromo } from "@/lib/plan-offer";

import { TOTE_PLAN_ALL_ACCESS, TOTE_PLAN_MINI, formatPlanPrice, type TotePlanTier } from "@/lib/tote-plans";

const PRICE = formatPlanPrice(TOTE_PLAN_ALL_ACCESS.price);

type PromoCheck = { ok: true } | { ok: false; error: string; field: "code" | "email" };

/** "Have a code?" — a promo code (FRIDAY) and the email it's for. */
function PromoCode({
  promo,
  retentionActive,
  onApply,
  onRemove,
  prefillCode,
}: {
  promo: AppliedPromo | null;
  retentionActive: boolean;
  onApply: (code: string, email: string) => Promise<PromoCheck>;
  onRemove: () => void;
  /** From a promo link (/go/friday): the form starts open with the code typed in */
  prefillCode?: string;
}) {
  const uid = useId();
  const [open, setOpen] = useState(!!prefillCode);
  const [code, setCode] = useState(prefillCode ?? "");
  // The link's code is read after first render: open the form with it then.
  useEffect(() => {
    if (!prefillCode) return;
    setOpen(true);
    setCode(prefillCode);
  }, [prefillCode]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; field: "code" | "email" } | null>(null);

  if (promo) {
    return (
      <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <p className="flex min-w-0 items-start gap-2 text-sm text-emerald-200">
            <Tag className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
            <span className="min-w-0">
              <strong className="font-black tracking-wide text-white">{promo.display}</strong> applied · {promo.label}
              <span className="block truncate text-xs text-emerald-300/80">For {promo.email} · 1 per customer</span>
            </span>
          </p>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove code"
            className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-emerald-300 transition hover:bg-emerald-500/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {retentionActive && (
          <p className="mt-2 text-[11px] text-emerald-300/70">Codes can&apos;t be combined with other offers.</p>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <p className="mt-3 text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-400 underline-offset-2 hover:text-white hover:underline"
        >
          <Tag className="h-3.5 w-3.5" aria-hidden /> Have a code?
        </button>
      </p>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await onApply(code, email);
    setBusy(false);
    if (!r.ok) setError({ text: r.error, field: r.field });
  };
  const field =
    "w-full rounded-lg border bg-slate-950 px-3 py-2.5 text-base text-white placeholder:text-stone-600 outline-none transition focus:border-yellow-400 sm:text-sm";

  return (
    <form onSubmit={submit} noValidate className="mt-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-stone-300">Promo code</p>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          aria-label="Close"
          className="text-stone-500 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[8rem_1fr]">
        <label htmlFor={`${uid}-code`} className="sr-only">
          Code
        </label>
        <input
          id={`${uid}-code`}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          maxLength={40}
          aria-invalid={error?.field === "code"}
          className={`${field} font-bold uppercase tracking-wide ${error?.field === "code" ? "border-red-500/70" : "border-slate-700"}`}
        />
        <label htmlFor={`${uid}-email`} className="sr-only">
          Email for your plans
        </label>
        <input
          id={`${uid}-email`}
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email for your plans"
          aria-invalid={error?.field === "email"}
          className={`${field} ${error?.field === "email" ? "border-red-500/70" : "border-slate-700"}`}
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {error.text}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !code.trim()}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-700 py-2.5 text-sm font-bold text-white transition hover:bg-slate-600 disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Apply code
      </button>
      <p className="mt-2 text-[11px] leading-snug text-stone-500">
        One per customer: pay with this email. Codes can&apos;t be combined with other offers.
      </p>
    </form>
  );
}

export function AllAccessOffer({
  loading,
  onBuy,
  onSample,
  wallet,
  offerPrice,
  offerTag,
  promo = null,
  retentionActive = false,
  onApplyPromo,
  onRemovePromo,
  prefillPromo,
  rating,
  mini = false,
}: {
  loading: boolean;
  onBuy: () => void;
  onSample: (tier: TotePlanTier) => void;
  /** Inside Facebook / Instagram: the "Buy with Apple / Google Pay" escape, shown first */
  wallet?: React.ReactNode;
  /** The discounted price (retention offer or promo code), e.g. "$16" */
  offerPrice?: string;
  /** Under the price, e.g. "$3 off · 24 hours" or "Black Friday · $5 off" */
  offerTag?: string;
  /** The applied promo code, if any */
  promo?: AppliedPromo | null;
  /** A retention offer is active (shown as "can't be combined" next to a code) */
  retentionActive?: boolean;
  onApplyPromo?: (code: string, email: string) => Promise<PromoCheck>;
  onRemovePromo?: () => void;
  /** A code from the link, waiting for the buyer's email */
  prefillPromo?: string;
  /** Published plan reviews for this product (shown from 3 up) */
  rating?: { average: number; total: number } | null;
  /** A Mini Tote Rack design: the separate Mini Tote Rack Plans product */
  mini?: boolean;
}) {
  const regular = mini ? formatPlanPrice(TOTE_PLAN_MINI.price) : PRICE;
  const shown = offerPrice ?? regular;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-yellow-400/40 bg-slate-900 p-5">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-yellow-400">
            <InfinityIcon className="h-4 w-4" /> {mini ? "Unlimited mini plans" : "Unlimited plans"}
          </p>
          <h3 className="mt-1 text-lg font-black leading-tight text-white">Get the plan for this design</h3>
        </div>
        <div className="shrink-0 text-right">
          {offerPrice && <p className="text-sm font-bold text-stone-500 line-through">{regular}</p>}
          <p className="text-4xl font-black leading-none text-white">{shown}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-yellow-400">
            {offerPrice ? offerTag ?? "Offer price" : "Once, for life"}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-stone-300">
        {mini ? (
          <>
            Plus a free plan for <strong className="text-white">every mini tote rack you design after it</strong>.
            Sized for HDX 6.5 qt totes, built from 2×3s and plywood.
          </>
        ) : (
          <>
            Plus a free plan for <strong className="text-white">every tote organizer you design after it</strong>. Your
            garage today, the shed next spring.
          </>
        )}
      </p>

      <ul className="mt-3 grid gap-x-3 gap-y-1.5 text-xs text-stone-300 sm:grid-cols-2">
        {[mini ? "Unlimited mini plans, any size" : "Unlimited plans, any size", "Interactive 3D build guide", "Printable PDF with cut list", "No subscription, ever"].map(
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
        {loading ? "Opening checkout…" : `Get my plans — ${shown}`}
      </button>
      <p className="mt-2 text-center text-[11px] text-stone-500">
        Instant access · link by email · all sales final
      </p>
      {rating && rating.total >= 3 && (
        <a href="/plans#reviews" target="_blank" className="mt-2 flex items-center justify-center gap-1.5 text-xs text-stone-400 hover:text-white">
          <Stars rating={rating.average} size="xs" />
          <span>
            <strong className="text-stone-200">{rating.average.toFixed(1)}</strong> from {rating.total} verified builders
          </span>
        </a>
      )}
      {onApplyPromo && onRemovePromo && (
        <PromoCode
          promo={promo}
          retentionActive={retentionActive}
          onApply={onApplyPromo}
          onRemove={onRemovePromo}
          prefillCode={prefillPromo}
        />
      )}
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
  mini = false,
}: {
  emailHint: string;
  loading: boolean;
  onGenerate: () => void;
  /** Covered by Mini Tote Rack Plans (not All-Access) */
  mini?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5 text-center sm:p-6">
      <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-emerald-300">
        <Sparkles className="h-4 w-4" /> Included with your {mini ? TOTE_PLAN_MINI.name : "All-Access plans"}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-stone-300">
        You own unlimited {mini ? "mini tote rack" : "tote organizer"} plans ({emailHint}). Generate this design&apos;s
        plan, with the 3D guide and the PDF, at no charge.
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
