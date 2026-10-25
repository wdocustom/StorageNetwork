"use client";

// ═══════════════════════════════════════════════════════════════════════════
// DIY PLANS CHECKOUT — pick a tier for the unit designed on /design
//
// Reads the configuration from the URL, shows what the customer is buying,
// and offers the two retail tiers (PDF / Interactive Build Guide). Pro
// subscribers and admins skip Stripe; /plans/build re-verifies them.
// ═══════════════════════════════════════════════════════════════════════════

import { useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Box, CheckCircle, Crown, FileText, Loader2 } from "lucide-react";
import { createDIYPlanCheckout, checkDIYPlanAccess } from "@/app/actions/diy-plan-checkout";
import { generateCutList } from "@/lib/diy-cut-list";
import {
  TOTE_PLAN_LIMITS,
  TOTE_PLAN_TIERS,
  decodeTotePlanConfig,
  encodeTotePlanConfig,
  formatPlanPrice,
  totePlanName,
  totePlanSummary,
  type TotePlanTier,
} from "@/lib/tote-plans";

const TIER_ICONS: Record<TotePlanTier, typeof Box> = { pdf: FileText, interactive: Box };

function CheckoutContent() {
  const searchParams = useSearchParams();
  const [loadingTier, setLoadingTier] = useState<TotePlanTier | null>(null);
  const [error, setError] = useState("");
  const [freeAccess, setFreeAccess] = useState<{ hasFreeAccess: boolean; reason?: "pro" | "admin" } | null>(null);

  const config = useMemo(() => decodeTotePlanConfig(searchParams.get("config")), [searchParams]);
  const cancelled = searchParams.get("cancelled") === "1";

  useEffect(() => {
    checkDIYPlanAccess().then(setFreeAccess);
  }, []);

  const dims = useMemo(
    () =>
      config
        ? generateCutList({ ...config, unitType: "standard", orientation: "standard" }).dimensions
        : null,
    [config],
  );

  if (!config || !dims) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-bold text-white">Plans aren&apos;t available for this design</h1>
          <p className="mt-2 text-sm text-stone-400">
            DIY plans cover a single front-loading tote unit up to {TOTE_PLAN_LIMITS.maxCols} wide ×{" "}
            {TOTE_PLAN_LIMITS.maxRows} tall. Bigger walls are built from several of these side by side.
          </p>
          <Link
            href="/design"
            className="mt-5 inline-block rounded-xl bg-yellow-400 px-5 py-3 text-sm font-bold text-gray-950 transition hover:bg-yellow-300"
          >
            Back to the Designer
          </Link>
        </div>
      </main>
    );
  }

  const hasFree = freeAccess?.hasFreeAccess === true;

  const handleBuy = async (tier: TotePlanTier) => {
    setLoadingTier(tier);
    setError("");
    const result = await createDIYPlanCheckout(config, tier);
    if (result.success && result.url) {
      window.location.href = result.url;
    } else {
      setError(result.error || "Something went wrong. Please try again.");
      setLoadingTier(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <a href="/plans">
            <Image src="/landing_page_logo.png" alt="Storage Network" width={36} height={36} className="rounded" />
          </a>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-white">DIY Build Plans</h1>
            <p className="text-[10px] text-stone-500">Instant access · Yours forever</p>
          </div>
          <Link
            href="/design"
            className="flex items-center gap-1 text-[11px] font-semibold text-stone-500 transition hover:text-stone-300"
          >
            <ArrowLeft className="h-3 w-3" />
            Designer
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        {cancelled && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
            Checkout was cancelled. You can pick up where you left off below.
          </div>
        )}

        {/* ── Unit summary ── */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-bold text-white">{totePlanName(config)}</h2>
          <p className="mt-0.5 text-xs text-stone-400">{totePlanSummary(config)}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ["Width", dims.totalWStr],
              ["Height", dims.totalHWithWheelsStr ?? dims.totalHStr],
              ["Depth", dims.depthStr],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-800/60 px-3 py-2.5 text-center">
                <div className="text-[10px] uppercase tracking-wider text-stone-500">{label}</div>
                <div className="font-mono text-sm font-bold text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</div>
        )}

        {/* ── Pro / admin ── */}
        {hasFree ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
            <div className="mb-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-400">
              <Crown className="h-4 w-4" />
              {freeAccess?.reason === "admin" ? "Admin access" : "Included with Pro"}
            </div>
            <p className="mb-4 text-xs text-stone-400">PDF plan and the interactive build guide, no charge.</p>
            <Link
              href={`/plans/build?access=pro&config=${encodeTotePlanConfig(config)}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-emerald-500"
            >
              Open My Build Plan
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(["pdf", "interactive"] as const).map((id) => {
              const tier = TOTE_PLAN_TIERS[id];
              const Icon = TIER_ICONS[id];
              const featured = id === "interactive";
              return (
                <div
                  key={id}
                  className={`relative flex flex-col overflow-hidden rounded-2xl border bg-slate-900 p-5 ${
                    featured ? "border-yellow-400/40" : "border-slate-800"
                  }`}
                >
                  {featured && <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />}
                  <div className="mb-1 flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${featured ? "text-yellow-400" : "text-stone-400"}`} />
                    <h3 className="text-sm font-bold text-white">{tier.name}</h3>
                    {featured && (
                      <span className="ml-auto rounded-full bg-yellow-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-yellow-400">
                        Best value
                      </span>
                    )}
                  </div>
                  <p className="mb-3 text-xs text-stone-500">{tier.tagline}</p>
                  <div className="mb-4 text-3xl font-black text-white">{formatPlanPrice(tier.price)}</div>
                  <ul className="mb-5 flex-1 space-y-2">
                    {tier.includes.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs text-stone-300">
                        <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleBuy(id)}
                    disabled={loadingTier !== null}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black uppercase tracking-wider transition disabled:opacity-60 ${
                      featured
                        ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-950 hover:from-amber-300 hover:to-yellow-400"
                        : "border border-slate-700 text-white hover:bg-slate-800"
                    }`}
                  >
                    {loadingTier === id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {loadingTier === id ? "Redirecting…" : `Get it — ${formatPlanPrice(tier.price)}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-[11px] text-stone-600">
          One-time purchase. We email you a permanent link — no account needed.
          Start with the PDF and you can upgrade to the interactive guide later.
        </p>
      </div>
    </main>
  );
}

export default function DIYCheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
        </main>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
