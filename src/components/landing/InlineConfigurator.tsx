"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  MapPin, Loader2, ChevronRight, CheckCircle2, Star,
  Package, Flower2, ArrowUp, Layers, ShoppingCart,
  Check, ArrowRight, Plus, Ruler, ArrowLeft,
} from "lucide-react";
import { checkAvailability, type AvailabilityResult } from "@/app/actions/customer";
import { calculateBuild } from "@/app/actions/calculator";
import type { InstallerPricing } from "@/types/viewModels";

// ═══════════════════════════════════════════════════════════════════════════
// Inline Configurator — Apple-style Guided Customer Journey
//
// Clean, centered card-based flow. No chat bubbles.
// Each step is a full-width card with a heading, options, and continue.
// ═══════════════════════════════════════════════════════════════════════════

type Step =
  | "zip"
  | "installer-reveal"
  | "services"
  | "wall-width"
  | "wall-height"
  | "tote-bring-or-buy"
  | "tote-color"
  | "wheels"
  | "top"
  | "another-unit"
  | "summary";

const STEP_ORDER: Step[] = [
  "zip", "installer-reveal", "services", "wall-width", "wall-height",
  "tote-bring-or-buy", "tote-color", "wheels", "top", "another-unit", "summary",
];


// Map each step to its previous step for back navigation
const PREV_STEP: Partial<Record<Step, Step>> = {
  "services": "installer-reveal",
  "wall-width": "services",
  "wall-height": "wall-width",
  "tote-bring-or-buy": "wall-height",
  "tote-color": "tote-bring-or-buy",
  "wheels": "tote-bring-or-buy",
  "top": "wheels",
  "another-unit": "top",
  "summary": "another-unit",
};

interface UnitBuild {
  cols: number;
  rows: number;
  hasTotes: boolean;
  toteColor: "black" | "clear";
  hasWheels: boolean;
  hasTop: boolean;
  wallWidthFt: number;
}

const SLOT_WIDTH = 20;
const POST_WIDTH = 1.5;

function feetToMaxCols(feet: number): number {
  const inches = feet * 12;
  return Math.max(1, Math.floor((inches - POST_WIDTH) / (SLOT_WIDTH + POST_WIDTH)));
}

const HEIGHT_OPTIONS = [
  { label: "~3 ft", desc: "2 tiers — 36\" tall", rows: 2 },
  { label: "~4.5 ft", desc: "3 tiers — 52\" tall", rows: 3 },
  { label: "~5.5 ft", desc: "4 tiers — 68\" tall", rows: 4, popular: true },
  { label: "~7 ft", desc: "5 tiers — 84\" tall", rows: 5 },
];

// ── Step Card Shell ─────────────────────────────────────────────────────

function StepCard({ title, subtitle, children, onBack }: { title: string; subtitle?: string; children: React.ReactNode; onBack?: () => void }) {
  return (
    <div className="animate-fadeInUp">
      {onBack && (
        <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-stone-500 transition-colors hover:text-yellow-400">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      )}
      <div className="mb-5 text-center">
        <h2 className="text-xl font-black uppercase tracking-tight text-white sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-stone-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function OptionCard({
  selected, onClick, children, highlight,
}: {
  selected?: boolean; onClick: () => void; children: React.ReactNode; highlight?: boolean;
}) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
      selected ? "border-yellow-400 bg-yellow-400/10" : highlight ? "border-yellow-400/30 bg-yellow-400/5 hover:border-yellow-400" : "border-stone-700/50 bg-gray-900/40 hover:border-stone-500"
    }`}>
      {children}
    </button>
  );
}

// ── Progress Dots ───────────────────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
          i < current ? "w-6 bg-yellow-400" : i === current ? "w-6 bg-yellow-400/60" : "w-1.5 bg-stone-700"
        }`} />
      ))}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export default function InlineConfigurator() {
  const router = useRouter();
  const [zip, setZip] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<Step>("zip");
  const [installer, setInstaller] = useState<AvailabilityResult | null>(null);
  const [pricing, setPricing] = useState<InstallerPricing | null>(null);

  const [wallWidthFt, setWallWidthFt] = useState(8);
  const [maxCols, setMaxCols] = useState(4);
  const [selectedRows, setSelectedRows] = useState(4);
  const [hasTotes, setHasTotes] = useState(true);
  const [toteColor, setToteColor] = useState<"black" | "clear">("black");
  const [hasWheels, setHasWheels] = useState(true);
  const [hasTop, setHasTop] = useState(true);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [units, setUnits] = useState<UnitBuild[]>([]);
  const [totalPrice, setTotalPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stepIndex = STEP_ORDER.indexOf(step);
  // Progress: ZIP doesn't count, start from installer-reveal
  const progressIndex = Math.max(0, stepIndex - 1);
  const progressTotal = STEP_ORDER.length - 2; // exclude zip & summary

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 100);
  }, [step]);

  const availableServices = useCallback(() => {
    const p = pricing;
    const svc = [{ id: "tote_storage", label: "Tote Storage Racks", desc: "27-gallon heavy-duty tote shelving", icon: <Package className="h-5 w-5" /> }];
    if (p?.open_shelving_enabled) svc.push({ id: "open_shelving", label: "Open Shelving", desc: "Garage/utility shelving units", icon: <Layers className="h-5 w-5" /> });
    if (p?.overhead_storage_enabled) svc.push({ id: "overhead_storage", label: "Overhead Ceiling Storage", desc: "Ceiling-mounted tote grid", icon: <ArrowUp className="h-5 w-5" /> });
    if (p?.raised_bed_enabled) svc.push({ id: "raised_beds", label: "Raised Bed Planters", desc: "Custom cedar garden beds", icon: <Flower2 className="h-5 w-5" /> });
    return svc;
  }, [pricing]);

  async function handleSearch() {
    const trimmed = zip.trim();
    if (trimmed.length < 5) { setError("Enter a valid 5-digit ZIP code."); return; }
    setError(""); setSearching(true);
    try {
      const result = await checkAvailability(trimmed);
      if (result.available && result.installer_id) {
        setInstaller(result); setPricing(result.installer_pricing); setStep("installer-reveal");
      } else { setError(result.message || "No installer found in this area yet."); }
    } catch { setError("Unable to check availability. Please try again."); }
    finally { setSearching(false); }
  }

  function finalizeUnit() {
    setUnits((prev) => [...prev, { cols: maxCols, rows: selectedRows, hasTotes, toteColor, hasWheels, hasTop, wallWidthFt }]);
    setStep("another-unit");
  }

  function startAnotherUnit() {
    setWallWidthFt(8); setMaxCols(4); setSelectedRows(4); setHasTotes(true); setToteColor("black"); setHasWheels(true); setHasTop(true);
    setStep("wall-width");
  }

  async function calculateTotalPrice(allUnits: UnitBuild[]) {
    setPriceLoading(true); let total = 0;
    try {
      for (const u of allUnits) {
        const r = await calculateBuild({ cols: u.cols, rows: u.rows, toteModel: "HDX", toteColor: u.toteColor, unitType: "standard", orientation: "standard", addOns: { totes: u.hasTotes, wheels: u.hasWheels, top: u.hasTop }, mode: "manual", installerPricing: pricing || undefined });
        if ("price" in r) total += r.price;
      }
      setTotalPrice(total);
    } catch {} setPriceLoading(false);
  }

  function goToSummary() { setStep("summary"); calculateTotalPrice([...units]); }

  function goBack() {
    const prev = PREV_STEP[step];
    if (prev) setStep(prev);
  }

  function goToDesign() {
    if (!installer?.installer_id) return;
    const params = new URLSearchParams();
    params.set("installer", installer.installer_id);
    params.set("from", "network");

    if (units.length === 1) {
      const u = units[0];
      params.set("config", btoa(JSON.stringify({ cols: u.cols, rows: u.rows, toteType: "HDX", toteColor: u.toteColor, unitType: "standard", orientation: "standard", hasTotes: u.hasTotes, hasWheels: u.hasWheels, hasTop: u.hasTop })));
    } else if (units.length > 1) {
      params.set("config", btoa(JSON.stringify({
        units: units.map((u) => ({ cols: u.cols, rows: u.rows, toteType: "HDX", toteColor: u.toteColor, unitType: "standard", orientation: "standard", hasTotes: u.hasTotes, hasWheels: u.hasWheels, hasTop: u.hasTop })),
      })));
    }
    router.push("/design?" + params.toString());
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      {step !== "zip" && step !== "installer-reveal" && (
        <ProgressDots current={progressIndex} total={progressTotal} />
      )}

      {/* ── ZIP ──────────────────────────────────────────────── */}
      {step === "zip" && (
        <div className="animate-fadeInUp">
          <div className="flex overflow-hidden rounded-xl border-2 border-yellow-400/30 bg-gray-900 shadow-2xl shadow-yellow-400/10 transition-all focus-within:border-yellow-400">
            <div className="flex items-center pl-4 text-yellow-400"><MapPin className="h-5 w-5" /></div>
            <input type="text" inputMode="numeric" maxLength={5} value={zip}
              onChange={(e) => { setZip(e.target.value.replace(/\D/g, "").slice(0, 5)); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="Enter your ZIP code"
              className="w-full bg-transparent px-3 py-4 text-lg font-medium text-white placeholder-stone-500 outline-none" autoFocus />
            <button onClick={handleSearch} disabled={searching || zip.length < 5}
              className="m-1.5 flex shrink-0 items-center gap-2 rounded-lg bg-yellow-400 px-6 py-3 text-sm font-bold uppercase tracking-wider text-black transition-all hover:bg-yellow-300 disabled:opacity-50">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Find</span><ChevronRight className="h-4 w-4" /></>}
            </button>
          </div>
          {error && <p className="mt-3 text-sm font-medium text-red-400">{error}</p>}
          <p className="mt-4 text-xs text-stone-600">We&apos;ll match you with a certified installer in your area.</p>
        </div>
      )}

      {/* ── Installer Reveal ─────────────────────────────────── */}
      {step === "installer-reveal" && installer && (
        <div className="animate-fadeInUp rounded-2xl border border-stone-700/50 bg-gray-900/60 p-8 text-center backdrop-blur-sm">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-yellow-400 bg-gradient-to-br from-yellow-400 to-yellow-500 shadow-lg shadow-yellow-400/30">
            {installer.installer_avatar_url ? (
              <Image src={installer.installer_avatar_url} alt={installer.installer_name || ""} width={80} height={80} className="h-full w-full object-cover" unoptimized />
            ) : (
              <Image src="/Header_avatar_logo.png" alt="Storage Network" width={80} height={80} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Verified Pro
          </div>
          <h3 className="mb-1 text-2xl font-black uppercase text-white">{installer.installer_name}</h3>
          <div className="mb-4 flex items-center justify-center gap-0.5">
            {[1,2,3,4,5].map((i) => <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}
          </div>
          <p className="mb-6 text-sm text-stone-400">Your certified pro is ready to design, build &amp; install your custom storage system.</p>
          <button onClick={() => setStep("services")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-4 text-sm font-black uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300">
            Get Started <ArrowRight className="h-4 w-4" />
          </button>
          <a
            href={`/design?installer=${installer.installer_id}&from=network`}
            className="mt-3 flex items-center justify-center text-xs text-stone-600 transition-colors hover:text-stone-400"
          >
            Skip — go straight to the 3D designer
          </a>
        </div>
      )}

      {/* ── Services ─────────────────────────────────────────── */}
      {step === "services" && (
        <StepCard title="What do you need?" subtitle="Select everything that interests you." onBack={() => setStep("installer-reveal")}>
          <div className="space-y-2">
            {availableServices().map((svc) => {
              const sel = selectedServices.includes(svc.id);
              return (
                <OptionCard key={svc.id} selected={sel} onClick={() => setSelectedServices((p) => p.includes(svc.id) ? p.filter((s) => s !== svc.id) : [...p, svc.id])}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${sel ? "bg-yellow-400 text-gray-950" : "bg-slate-800 text-stone-400"}`}>{svc.icon}</div>
                  <div className="flex-1"><p className={`text-sm font-bold ${sel ? "text-yellow-400" : "text-white"}`}>{svc.label}</p><p className="text-xs text-stone-500">{svc.desc}</p></div>
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${sel ? "border-yellow-400 bg-yellow-400" : "border-stone-600"}`}>{sel && <Check className="h-4 w-4 text-gray-950" />}</div>
                </OptionCard>
              );
            })}
            <button onClick={() => { if (selectedServices.includes("tote_storage")) setStep("wall-width"); else goToDesign(); }}
              disabled={selectedServices.length === 0}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 hover:bg-yellow-300 disabled:opacity-40 transition-all">
              Continue <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </StepCard>
      )}

      {/* ── Wall Width ───────────────────────────────────────── */}
      {step === "wall-width" && (
        <StepCard title="How wide is the wall?" subtitle="Measure the open space where you want the unit." onBack={goBack}>
          <div className="space-y-2">
            {[
              { ft: 4, label: "~4 feet", desc: "Small nook — 2 columns wide", cols: 2 },
              { ft: 6, label: "~6 feet", desc: "Half wall — 3 columns wide", cols: 3 },
              { ft: 8, label: "~8 feet", desc: "Standard wall — 4 columns wide", cols: 4 },
              { ft: 10, label: "~10 feet", desc: "Wide wall — 5 columns wide", cols: 5 },
              { ft: 12, label: "~12 feet", desc: "Full bay — 6 columns wide", cols: 6 },
            ].map((opt) => (
              <OptionCard key={opt.ft} onClick={() => { setWallWidthFt(opt.ft); setMaxCols(feetToMaxCols(opt.ft)); setStep("wall-height"); }} highlight={opt.ft === 8}>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{opt.label}</p>
                  <p className="text-xs text-stone-500">{opt.desc}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-yellow-400">{opt.cols} wide</span>
              </OptionCard>
            ))}
          </div>
        </StepCard>
      )}

      {/* ── Wall Height ──────────────────────────────────────── */}
      {step === "wall-height" && (
        <StepCard title="How tall?" subtitle={`Your ${maxCols}-column unit. Pick a height that works for your space.`} onBack={goBack}>
          <div className="space-y-2">
            {HEIGHT_OPTIONS.map((opt) => (
              <OptionCard key={opt.rows} onClick={() => { setSelectedRows(opt.rows); setStep("tote-bring-or-buy"); }} highlight={opt.popular}>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{opt.label} tall</p>
                  <p className="text-xs text-stone-500">{opt.desc}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-yellow-400">{opt.rows} tiers</span>
              </OptionCard>
            ))}
          </div>
        </StepCard>
      )}

      {/* ── Totes ────────────────────────────────────────────── */}
      {step === "tote-bring-or-buy" && (
        <StepCard title="Totes" subtitle={`Your ${maxCols}×${selectedRows} holds ${maxCols * selectedRows} totes. Include them or bring your own?`} onBack={goBack}>
          <div className="space-y-2">
            <OptionCard onClick={() => { setHasTotes(true); setStep("tote-color"); }}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-400/10 text-yellow-400"><ShoppingCart className="h-5 w-5" /></div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">Include HDX totes</p>
                <p className="text-xs text-stone-500">${pricing?.standard_tote ?? 12}/each — 27-gallon from Home Depot</p>
              </div>
            </OptionCard>
            <OptionCard onClick={() => { setHasTotes(false); setToteColor("black"); setStep("wheels"); }}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-stone-400"><Package className="h-5 w-5" /></div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">I&apos;ll bring my own</p>
                <p className="text-xs text-stone-500">I already have or will buy totes separately</p>
              </div>
            </OptionCard>
          </div>
        </StepCard>
      )}

      {/* ── Tote Color ───────────────────────────────────────── */}
      {step === "tote-color" && (
        <StepCard title="Tote style" subtitle="Choose your HDX 27-gallon tote color." onBack={goBack}>
          <div className="space-y-2">
            <OptionCard onClick={() => { setToteColor("black"); setStep("wheels"); }} highlight>
              <div className="h-10 w-10 shrink-0 rounded-lg bg-gray-800 border-2 border-stone-600" />
              <div className="flex-1">
                <p className="text-sm font-bold text-white">Black / Yellow Lid</p>
                <p className="text-xs text-stone-500">${pricing?.standard_tote ?? 12}/tote — most popular</p>
              </div>
            </OptionCard>
            <OptionCard onClick={() => { setToteColor("clear"); setStep("wheels"); }}>
              <div className="h-10 w-10 shrink-0 rounded-lg bg-blue-100/20 border-2 border-blue-300/30" />
              <div className="flex-1">
                <p className="text-sm font-bold text-white">Clear / Yellow Lid</p>
                <p className="text-xs text-stone-500">${pricing?.standard_tote_clear ?? 20}/tote — see contents</p>
              </div>
            </OptionCard>
          </div>
        </StepCard>
      )}

      {/* ── Wheels ───────────────────────────────────────────── */}
      {step === "wheels" && (
        <StepCard title="Wheels" subtitle="Industrial casters let you roll the unit out for cleaning or access." onBack={goBack}>
          <div className="space-y-2">
            <OptionCard onClick={() => { setHasWheels(true); setStep("top"); }}>
              <div className="flex-1"><p className="text-sm font-bold text-white">Add casters</p><p className="text-xs text-stone-500">+${pricing?.standard_wheels ?? 65}</p></div>
            </OptionCard>
            <OptionCard onClick={() => { setHasWheels(false); setStep("top"); }}>
              <div className="flex-1"><p className="text-sm font-bold text-white">No wheels</p><p className="text-xs text-stone-500">Wall-mounted or freestanding</p></div>
            </OptionCard>
          </div>
        </StepCard>
      )}

      {/* ── Top ──────────────────────────────────────────────── */}
      {step === "top" && (
        <StepCard title="Countertop" subtitle="A plywood top makes a workbench or folding station." onBack={goBack}>
          <div className="space-y-2">
            <OptionCard onClick={() => { setHasTop(true); finalizeUnit(); }}>
              <div className="flex-1"><p className="text-sm font-bold text-white">Add plywood top</p><p className="text-xs text-stone-500">+${pricing?.plywood_top ?? 95}</p></div>
            </OptionCard>
            <OptionCard onClick={() => { setHasTop(false); finalizeUnit(); }}>
              <div className="flex-1"><p className="text-sm font-bold text-white">No top</p><p className="text-xs text-stone-500">Open frame</p></div>
            </OptionCard>
          </div>
        </StepCard>
      )}

      {/* ── Another Unit ─────────────────────────────────────── */}
      {step === "another-unit" && (
        <StepCard title={`Unit ${units.length} saved`} subtitle="Need another unit for a different wall or space?" onBack={goBack}>
          <div className="space-y-3">
            <div className="rounded-xl bg-slate-800/50 p-4">
              {units.map((u, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-stone-400">Unit {i + 1}</span>
                  <span className="text-xs font-bold text-white">{u.cols}×{u.rows} — ~{u.wallWidthFt}ft wall</span>
                </div>
              ))}
            </div>
            <button onClick={startAnotherUnit}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-yellow-400/30 bg-yellow-400/5 py-3.5 text-sm font-bold text-yellow-400 transition-all hover:border-yellow-400 hover:bg-yellow-400/10">
              <Plus className="h-4 w-4" /> Add Another Unit
            </button>
            <button onClick={goToSummary}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300">
              Review &amp; Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </StepCard>
      )}

      {/* ── Summary ──────────────────────────────────────────── */}
      {step === "summary" && (
        <div className="animate-fadeInUp">
          <div className="rounded-2xl border border-stone-700/50 bg-gray-900/60 p-6 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black uppercase text-white">Your Build</h2>
              {priceLoading ? <Loader2 className="h-5 w-5 animate-spin text-yellow-400" /> : totalPrice !== null ? (
                <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Est. Total</p><p className="text-2xl font-black text-yellow-400">${totalPrice}</p></div>
              ) : null}
            </div>

            {units.map((u, i) => (
              <div key={i} className="rounded-xl bg-slate-800/40 p-4 mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Unit {i + 1}</span>
                  <span className="text-sm font-black text-white">{u.cols}×{u.rows}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                  <span className="text-stone-500">Wall</span><span className="text-right text-white">~{u.wallWidthFt}ft</span>
                  <span className="text-stone-500">Totes</span><span className="text-right text-white">{u.hasTotes ? `${u.cols*u.rows}× ${u.toteColor}` : "Own"}</span>
                  <span className="text-stone-500">Wheels</span><span className="text-right text-white">{u.hasWheels ? "Yes" : "No"}</span>
                  <span className="text-stone-500">Top</span><span className="text-right text-white">{u.hasTop ? "Yes" : "No"}</span>
                </div>
              </div>
            ))}

            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-stone-500">Installer</span>
              <span className="font-bold text-yellow-400">{installer?.installer_name}</span>
            </div>

            <p className="mt-3 text-[11px] text-stone-600">Final pricing with your installer&apos;s exact rates in the 3D designer.</p>

            <button onClick={goToDesign}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-4 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/30 transition-all hover:bg-yellow-300 hover:-translate-y-0.5">
              View My Design in 3D <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div ref={scrollRef} />
    </div>
  );
}
