"use client";

// ═══════════════════════════════════════════════════════════════════════════
// DIY PLANS — design a tote organizer and buy its plans on one page
//
// Retail buyers never touch the installer configurator: size, tote brand,
// casters and worktop are picked here against a live 3D preview, with the
// two plan tiers right underneath. ?config=… (from the /design CTA or a
// cancelled Stripe checkout) pre-fills the design.
//
// Pro subscribers and admins skip Stripe; /plans/build re-verifies them.
// ═══════════════════════════════════════════════════════════════════════════

import { useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect, Suspense, lazy } from "react";
import Image from "next/image";
import Link from "next/link";
import { Box, CheckCircle, Crown, FileText, Loader2, Minus, Plus, Ruler } from "lucide-react";
import { createDIYPlanCheckout, checkDIYPlanAccess } from "@/app/actions/diy-plan-checkout";
import { toFraction } from "@/lib/utils";
import {
  DEFAULT_TOTE_PLAN_CONFIG,
  TOTE_PLAN_LIMITS,
  TOTE_PLAN_TIERS,
  decodeTotePlanConfig,
  encodeTotePlanConfig,
  fitTotePlanToWall,
  formatPlanPrice,
  totePlanName,
  totePlanOuterSize,
  type TotePlanConfig,
  type TotePlanTier,
} from "@/lib/tote-plans";

const Rack3D = lazy(() => import("@/components/visualizer/Rack3D"));

const TIER_ICONS: Record<TotePlanTier, typeof Box> = { pdf: FileText, interactive: Box };

// ── Controls ─────────────────────────────────────────────────────────────

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="rounded-xl bg-slate-800/60 p-3">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">{label}</div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={`Fewer — ${label}`}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700 text-white transition hover:bg-slate-600 disabled:opacity-30"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="text-2xl font-black text-white">{value}</span>
        <button
          type="button"
          aria-label={`More — ${label}`}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700 text-white transition hover:bg-slate-600 disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Segmented<T extends string | boolean>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              className={`rounded-xl border px-3 py-2.5 text-left transition ${
                active
                  ? "border-yellow-400/60 bg-yellow-400/10 text-white"
                  : "border-slate-700 bg-slate-800/40 text-stone-400 hover:border-slate-600"
              }`}
            >
              <div className="text-sm font-bold">{opt.label}</div>
              {opt.hint && <div className="text-[10px] text-stone-500">{opt.hint}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WallFit({
  config,
  onFit,
}: {
  config: TotePlanConfig;
  onFit: (size: { cols: number; rows: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [msg, setMsg] = useState("");

  const fit = () => {
    const result = fitTotePlanToWall(Number(w), Number(h), config);
    if (!result) {
      setMsg("That space is too small for even one tote.");
      return;
    }
    onFit(result);
    setMsg(`Fits ${result.cols} wide × ${result.rows} tall.`);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-yellow-400 hover:text-yellow-300"
      >
        <Ruler className="h-3.5 w-3.5" />
        Not sure? Fit it to my wall
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3">
      <div className="mb-2 text-xs text-stone-400">Measure the space you have, in inches.</div>
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          value={w}
          onChange={(e) => setW(e.target.value)}
          placeholder="Width"
          aria-label="Wall width in inches"
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-stone-600 focus:border-yellow-400"
        />
        <input
          inputMode="decimal"
          value={h}
          onChange={(e) => setH(e.target.value)}
          placeholder="Height"
          aria-label="Wall height in inches"
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-stone-600 focus:border-yellow-400"
        />
        <button
          type="button"
          onClick={fit}
          disabled={!w || !h}
          className="shrink-0 rounded-lg bg-yellow-400 px-4 text-sm font-bold text-gray-950 transition hover:bg-yellow-300 disabled:opacity-50"
        >
          Fit
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-stone-400">{msg}</p>}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

function PlansDesigner() {
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<TotePlanConfig>(
    () => decodeTotePlanConfig(searchParams.get("config")) ?? DEFAULT_TOTE_PLAN_CONFIG,
  );
  const [loadingTier, setLoadingTier] = useState<TotePlanTier | null>(null);
  const [error, setError] = useState("");
  const [freeAccess, setFreeAccess] = useState<{ hasFreeAccess: boolean; reason?: "pro" | "admin" } | null>(null);
  const cancelled = searchParams.get("cancelled") === "1";

  useEffect(() => {
    checkDIYPlanAccess().then(setFreeAccess);
  }, []);

  // Keep the URL in step with the design so a refresh or shared link keeps it.
  useEffect(() => {
    const url = `/plans/checkout?config=${encodeTotePlanConfig(config)}`;
    window.history.replaceState(null, "", url);
  }, [config]);

  const update = (patch: Partial<TotePlanConfig>) => setConfig((c) => ({ ...c, ...patch }));

  const size = useMemo(() => totePlanOuterSize(config), [config]);
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
            <h1 className="text-sm font-bold text-white">Tote Organizer Plans</h1>
            <p className="text-[10px] text-stone-500">Design it · Get the plans · Build it yourself</p>
          </div>
          <Link href="/plans" className="text-[11px] font-semibold text-stone-500 transition hover:text-stone-300">
            All plans
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        {cancelled && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
            Checkout was cancelled. Your design is still here.
          </div>
        )}

        {/* ── Step 1: design ── */}
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="relative h-64 bg-white sm:h-80">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
                </div>
              }
            >
              <Rack3D
                cols={config.cols}
                rows={config.rows}
                toteType={config.toteType}
                toteColor="black"
                unitType="standard"
                orientation="standard"
                hasTotes={false}
                hasWheels={config.hasWheels}
                hasTop={config.hasTop}
              />
            </Suspense>
            <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-slate-900/85 px-3 py-1.5 backdrop-blur">
              <p className="text-xs font-bold text-white">{totePlanName(config)}</p>
              <p className="font-mono text-[11px] text-stone-300">
                {toFraction(size.widthIn)}&quot; W × {toFraction(size.heightIn)}&quot; H × 30&quot; D
              </p>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Stepper
                label="Totes wide"
                value={config.cols}
                min={TOTE_PLAN_LIMITS.minCols}
                max={TOTE_PLAN_LIMITS.maxCols}
                onChange={(cols) => update({ cols })}
              />
              <Stepper
                label="Totes tall"
                value={config.rows}
                min={TOTE_PLAN_LIMITS.minRows}
                max={TOTE_PLAN_LIMITS.maxRows}
                onChange={(rows) => update({ rows })}
              />
            </div>
            <WallFit config={config} onFit={update} />
            <Segmented
              label="Your totes (27 gallon)"
              value={config.toteType}
              onChange={(toteType) => update({ toteType })}
              options={[
                { value: "HDX", label: "HDX", hint: "Home Depot, Walmart, Menards" },
                { value: "GM", label: "Greenmade", hint: "Costco" },
              ]}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Segmented
                label="Casters"
                value={config.hasWheels}
                onChange={(hasWheels) => update({ hasWheels })}
                options={[
                  { value: true, label: "Rolling" },
                  { value: false, label: "Stationary" },
                ]}
              />
              <Segmented
                label="Top"
                value={config.hasTop}
                onChange={(hasTop) => update({ hasTop })}
                options={[
                  { value: true, label: "Plywood worktop" },
                  { value: false, label: "Open" },
                ]}
              />
            </div>
            <p className="text-[11px] text-stone-600">
              {config.cols * config.rows} totes. Need more storage? Build two of the same unit side by side from one plan.
            </p>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</div>
        )}

        {/* ── Step 2: pick a plan ── */}
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
            {(["interactive", "pdf"] as const).map((id) => {
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
                    <span className="ml-auto text-xl font-black text-white">{formatPlanPrice(tier.price)}</span>
                  </div>
                  <p className="mb-3 text-xs text-stone-500">{tier.tagline}</p>
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
                    {loadingTier === id && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loadingTier === id ? "Redirecting…" : `Get ${featured ? "the Guide" : "the PDF"} — ${formatPlanPrice(tier.price)}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <p className="pb-4 text-center text-[11px] text-stone-600">
          One-time purchase. We email you a permanent link — no account needed.
          Start with the PDF and you can upgrade to the interactive guide later.
        </p>
      </div>
    </main>
  );
}

export default function PlansDesignerPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
        </main>
      }
    >
      <PlansDesigner />
    </Suspense>
  );
}
