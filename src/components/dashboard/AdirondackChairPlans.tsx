"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Check, Package, FileText, ChevronRight } from "lucide-react";
import {
  checkChairPlanAccess,
  createChairPlanCheckout,
  createChairBundleCheckout,
} from "@/app/actions/chair-plans";

type AccessState = {
  checked: boolean;
  hasAccess: boolean;
  isAdmin: boolean;
  hasTemplate: boolean;
};

export default function AdirondackChairPlans() {
  const [access, setAccess] = useState<AccessState>({
    checked: false,
    hasAccess: false,
    isAdmin: false,
    hasTemplate: false,
  });
  const [loading, setLoading] = useState<"plans" | "bundle" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkChairPlanAccess().then((result) => {
      setAccess({ checked: true, ...result });
    });
  }, []);

  async function handleBuy(type: "plans" | "bundle") {
    setLoading(type);
    setError(null);
    const result =
      type === "plans" ? await createChairPlanCheckout() : await createChairBundleCheckout();
    if (result.success && result.url) {
      window.location.href = result.url;
    } else {
      setError(result.error ?? "Something went wrong. Please try again.");
      setLoading(null);
    }
  }

  // Loading skeleton
  if (!access.checked) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="h-1 bg-amber-400/30" />
        <div className="p-5 space-y-3 animate-pulse">
          <div className="h-4 w-2/5 rounded bg-slate-800" />
          <div className="h-3 w-3/5 rounded bg-slate-800" />
          <div className="h-3 w-1/2 rounded bg-slate-800" />
        </div>
      </section>
    );
  }

  // ── Purchased state ──────────────────────────────────────────────────────
  if (access.hasAccess) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-slate-900">
        <div className="h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-400/5 blur-3xl" />

        <div className="relative p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10">
                <FileText className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">Low Boy Adirondack Chair</p>
                  <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                    Unlocked
                  </span>
                </div>
                <p className="text-[10px] text-stone-500">Build Plans</p>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Link
              href="/dashboard/chair-plans"
              className="flex w-full items-center justify-between rounded-xl bg-amber-400 px-4 py-3 text-sm font-bold text-gray-950 transition-all hover:bg-amber-300"
            >
              <span>View Build Plans</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            {!access.hasTemplate && (
              <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Package className="h-4 w-4 text-stone-500" />
                  <div>
                    <p className="text-xs font-semibold text-stone-300">Add the MDF Template Set</p>
                    <p className="text-[10px] text-stone-500">Physical 1/2&quot; CNC-cut template, ships to you</p>
                  </div>
                </div>
                <Link
                  href="/dashboard/chair-plans"
                  className="shrink-0 rounded-lg border border-amber-400/30 px-3 py-1.5 text-[11px] font-bold text-amber-400 transition-colors hover:bg-amber-400/10"
                >
                  $72 →
                </Link>
              </div>
            )}

            {access.hasTemplate && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-3">
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                <p className="text-xs text-stone-400">MDF Template Set — ordered</p>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // ── Pre-purchase state ───────────────────────────────────────────────────
  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-slate-900">
      <div className="h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-400/5 blur-3xl" />

      <div className="relative p-5">
        {/* Header */}
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10">
            <FileText className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Low Boy Adirondack Chair</p>
            <p className="text-[10px] font-medium text-amber-400/70">Pro Build Plans + MDF Template</p>
          </div>
        </div>

        <p className="mb-4 text-[13px] leading-relaxed text-stone-400">
          A sleek, low-profile Adirondack built from standard dimensional lumber. Weekend build,
          beginner-friendly, and a natural upsell after any garage storage install.
        </p>

        {/* Selling points */}
        <ul className="mb-5 space-y-2">
          {[
            "Point-to-point cut profiles — mark the dots, draw the line, make the cut",
            "Complete cut list, pocket hole guide, and 6-step assembly",
            "Installer pricing + upsell notes built into the plans",
            "Optional 1/2” MDF template for batch production",
          ].map((point) => (
            <li key={point} className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span className="text-xs text-stone-400">{point}</span>
            </li>
          ))}
        </ul>

        {/* Pricing cards */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          {/* Plans only */}
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-stone-500 mb-1">Plans Only</p>
            <p className="text-2xl font-black text-white mb-0.5">$18</p>
            <p className="text-[10px] text-stone-500 mb-3">Digital download</p>
            <button
              onClick={() => handleBuy("plans")}
              disabled={!!loading}
              className="w-full rounded-lg border border-amber-400/40 py-2 text-xs font-bold text-amber-400 transition-all hover:bg-amber-400/10 disabled:opacity-60"
            >
              {loading === "plans" ? "Redirecting…" : "Get Plans"}
            </button>
          </div>

          {/* Bundle */}
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-4 relative">
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-gray-950">
                Save $30
              </span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-400/70 mb-1">Bundle</p>
            <div className="flex items-baseline gap-1.5 mb-0.5">
              <p className="text-2xl font-black text-white">$60</p>
              <p className="text-sm line-through text-stone-600">$90</p>
            </div>
            <p className="text-[10px] text-stone-500 mb-3">Plans + MDF template</p>
            <button
              onClick={() => handleBuy("bundle")}
              disabled={!!loading}
              className="w-full rounded-lg bg-amber-400 py-2 text-xs font-black text-gray-950 transition-all hover:bg-amber-300 disabled:opacity-60"
            >
              {loading === "bundle" ? "Redirecting…" : "Get Bundle"}
            </button>
          </div>
        </div>

        {/* Template note */}
        <div className="flex items-start gap-2 rounded-lg bg-slate-800/40 px-3 py-2.5">
          <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500" />
          <p className="text-[11px] text-stone-500">
            <span className="font-semibold text-stone-400">MDF Template:</span> 1/2&quot; CNC-cut template
            ships to you. Buy plans first, add template later at $72 — no discount after initial purchase.
          </p>
        </div>

        {error && (
          <p className="mt-3 text-center text-xs text-red-400">{error}</p>
        )}
      </div>
    </section>
  );
}
