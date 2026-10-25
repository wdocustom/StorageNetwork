"use client";

// ═══════════════════════════════════════════════════════════════════════════
// DIY PLANS — design a tote organizer system and buy its plans on one page
//
// Customers size each unit (any size the designer allows — big walls are
// split into 8'-stock modules automatically) against a live 3D preview and
// a module map, with the two plan tiers right underneath.
//
// Arrives pre-filled from every hand-off point:
//   ?design=H2x4t.H2x2t.H2x4t&name=Indiana%20Joe   designer / quote / email
//   ?config={…}                                     legacy single-unit links
//   &utm_source=designer|quote_page|quote_email…    carried to Stripe metadata
//
// Pro subscribers and admins skip Stripe; /plans/build re-verifies them.
// ═══════════════════════════════════════════════════════════════════════════

import { useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect, Suspense, lazy } from "react";
import Image from "next/image";
import Link from "next/link";
import { Box, CheckCircle, Crown, FileText, Layers, Loader2, Minus, Plus, Ruler, Trash2 } from "lucide-react";
import { createDIYPlanCheckout, checkDIYPlanAccess } from "@/app/actions/diy-plan-checkout";
import { toFraction } from "@/lib/utils";
import SystemMap from "@/components/plans/SystemMap";
import {
  DEFAULT_TOTE_PLAN_DESIGN,
  DEFAULT_TOTE_PLAN_UNIT,
  TOTE_PLAN_LIMITS,
  TOTE_PLAN_TIERS,
  designFromSearchParams,
  designModules,
  designOuterSize,
  encodeTotePlanDesign,
  fitTotePlanToWall,
  formatPlanPrice,
  splitHeight,
  splitWidth,
  totePlanDesignHref,
  totePlanName,
  totePlanSummary,
  type TotePlanDesign,
  type TotePlanTier,
  type TotePlanUnit,
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
  unit,
  onFit,
}: {
  unit: TotePlanUnit;
  onFit: (size: { cols: number; rows: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [msg, setMsg] = useState("");

  const fit = () => {
    const result = fitTotePlanToWall(Number(w), Number(h), unit);
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

function moduleNote(unit: TotePlanUnit): string | null {
  const widths = splitWidth(unit.cols);
  const tiers = splitHeight(unit.rows);
  if (widths.length === 1 && tiers.length === 1) return null;
  const parts: string[] = [];
  if (widths.length > 1) parts.push(`${widths.length} modules side by side (${widths.join(" + ")} wide)`);
  if (tiers.length > 1) parts.push(`${tiers.length} stacked tiers (${tiers.join(" + ")} tall)`);
  return `Built as ${parts.join(" and ")} so every part fits an 8' board. Your plan walks you through each module.`;
}

// ── Page ─────────────────────────────────────────────────────────────────

function PlansDesigner() {
  const searchParams = useSearchParams();
  const [design, setDesign] = useState<TotePlanDesign>(
    () => designFromSearchParams(searchParams) ?? DEFAULT_TOTE_PLAN_DESIGN,
  );
  const [selected, setSelected] = useState(0);
  const [loadingTier, setLoadingTier] = useState<TotePlanTier | null>(null);
  const [error, setError] = useState("");
  const [freeAccess, setFreeAccess] = useState<{ hasFreeAccess: boolean; reason?: "pro" | "admin" } | null>(null);
  // Read once: the URL is rewritten as the design changes
  const [cancelled] = useState(() => searchParams.get("cancelled") === "1");
  const [source] = useState(() => searchParams.get("utm_source") ?? undefined);

  useEffect(() => {
    checkDIYPlanAccess().then(setFreeAccess);
  }, []);

  // Keep the URL in step with the design so a refresh or shared link keeps it.
  useEffect(() => {
    window.history.replaceState(null, "", totePlanDesignHref(design, source));
  }, [design, source]);

  const unitIndex = Math.min(selected, design.units.length - 1);
  const unit = design.units[unitIndex];

  // Any edit makes it the customer's own design, so a bestseller name no longer applies.
  const updateUnit = (patch: Partial<TotePlanUnit>) =>
    setDesign((d) => ({ units: d.units.map((u, i) => (i === unitIndex ? { ...u, ...patch } : u)) }));
  const addUnit = () => {
    setDesign((d) => ({ units: [...d.units, { ...(d.units[d.units.length - 1] ?? DEFAULT_TOTE_PLAN_UNIT) }] }));
    setSelected(design.units.length);
  };
  const removeUnit = () => {
    setDesign((d) => ({ units: d.units.filter((_, i) => i !== unitIndex) }));
    setSelected(Math.max(0, unitIndex - 1));
  };

  const size = useMemo(() => designOuterSize(design), [design]);
  const moduleCount = useMemo(() => designModules(design).modules.length, [design]);
  const hasFree = freeAccess?.hasFreeAccess === true;
  const note = moduleNote(unit);

  const handleBuy = async (tier: TotePlanTier) => {
    setLoadingTier(tier);
    setError("");
    const result = await createDIYPlanCheckout(design, tier, source);
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
                cols={unit.cols}
                rows={unit.rows}
                toteType={unit.toteType}
                toteColor="black"
                unitType="standard"
                orientation="standard"
                hasTotes={false}
                hasWheels={unit.hasWheels}
                hasTop={unit.hasTop}
              />
            </Suspense>
            <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-slate-900/85 px-3 py-1.5 backdrop-blur">
              <p className="text-xs font-bold text-white">
                {design.units.length > 1 ? `Unit ${unitIndex + 1}: ` : ""}
                {unit.cols}×{unit.rows}
              </p>
              <p className="font-mono text-[11px] text-stone-300">
                {(() => {
                  const s = designOuterSize({ units: [unit] });
                  return `${toFraction(s.widthIn)}" W × ${toFraction(s.heightIn)}" H × 30" D`;
                })()}
              </p>
            </div>
          </div>

          {/* Whole system */}
          <div className="border-b border-slate-800 bg-slate-950/40 px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Layers className="h-3.5 w-3.5 text-yellow-400" />
                {totePlanName(design)}
              </p>
              <p className="font-mono text-[11px] text-stone-400">
                {toFraction(size.widthIn)}&quot; × {toFraction(size.heightIn)}&quot; · {moduleCount} module{moduleCount === 1 ? "" : "s"}
              </p>
            </div>
            <SystemMap
              design={design}
              highlight={(m) => design.units.length > 1 && m.unitIndex === unitIndex}
              className="h-24 w-full"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {design.units.map((u, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-pressed={i === unitIndex}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                    i === unitIndex
                      ? "border-yellow-400/60 bg-yellow-400/10 text-white"
                      : "border-slate-700 text-stone-400 hover:border-slate-600"
                  }`}
                >
                  Unit {i + 1} · {u.cols}×{u.rows}
                </button>
              ))}
              {design.units.length < TOTE_PLAN_LIMITS.maxUnits && (
                <button
                  type="button"
                  onClick={addUnit}
                  className="flex items-center gap-1 rounded-lg border border-dashed border-slate-600 px-3 py-1.5 text-xs font-semibold text-stone-400 transition hover:border-yellow-400/50 hover:text-yellow-400"
                >
                  <Plus className="h-3 w-3" />
                  Add a unit
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4 p-4">
            {design.units.length > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-white">Editing Unit {unitIndex + 1}</p>
                <button
                  type="button"
                  onClick={removeUnit}
                  className="flex items-center gap-1 text-[11px] font-semibold text-stone-500 transition hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove unit
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Stepper
                label="Totes wide"
                value={unit.cols}
                min={TOTE_PLAN_LIMITS.minCols}
                max={TOTE_PLAN_LIMITS.maxCols}
                onChange={(cols) => updateUnit({ cols })}
              />
              <Stepper
                label="Totes tall"
                value={unit.rows}
                min={TOTE_PLAN_LIMITS.minRows}
                max={TOTE_PLAN_LIMITS.maxRows}
                onChange={(rows) => updateUnit({ rows })}
              />
            </div>
            {note && <p className="rounded-xl bg-yellow-400/5 px-3 py-2 text-[11px] text-yellow-200/80">{note}</p>}
            <WallFit unit={unit} onFit={updateUnit} />
            <Segmented
              label="Totes (27 gallon)"
              value={unit.toteType}
              onChange={(toteType) => updateUnit({ toteType })}
              options={[
                { value: "HDX", label: "HDX", hint: "Home Depot, Walmart, Menards" },
                { value: "GM", label: "Greenmade", hint: "Costco" },
              ]}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Segmented
                label="Casters"
                value={unit.hasWheels}
                onChange={(hasWheels) => updateUnit({ hasWheels })}
                options={[
                  { value: true, label: "Rolling" },
                  { value: false, label: "Stationary" },
                ]}
              />
              <Segmented
                label="Top"
                value={unit.hasTop}
                onChange={(hasTop) => updateUnit({ hasTop })}
                options={[
                  { value: true, label: "Plywood worktop" },
                  { value: false, label: "Open" },
                ]}
              />
            </div>
            <p className="text-[11px] text-stone-600">{totePlanSummary(design)}</p>
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
              href={`/plans/build?access=pro&design=${encodeTotePlanDesign(design)}${design.name ? `&name=${encodeURIComponent(design.name)}` : ""}`}
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
          One price for your whole design, any size. One-time purchase — we email you a permanent link, no account needed.
          Start with the PDF and you can upgrade to the interactive guide later for {formatPlanPrice(TOTE_PLAN_TIERS.interactive.price - TOTE_PLAN_TIERS.pdf.price)}.
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
