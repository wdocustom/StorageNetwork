"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  MapPin, Loader2, ChevronRight, CheckCircle2, Star,
  Package, Flower2, ArrowUp, Layers, ShoppingCart,
  Check, ArrowRight, Plus, Ruler,
} from "lucide-react";
import { checkAvailability, type AvailabilityResult } from "@/app/actions/customer";
import { calculateBuild } from "@/app/actions/calculator";
import type { InstallerPricing } from "@/types/viewModels";

// ═══════════════════════════════════════════════════════════════════════════
// Inline Configurator — Guided Customer Journey
//
// Flow:
//   1. ZIP code entry
//   2. Installer reveal
//   3. Service selection (installer-specific)
//   4. Wall width (feet) → auto-calculate max columns
//   5. Wall height → auto-calculate rows
//   6. Tote questions (bring own vs included, color)
//   7. Wheels, plywood top
//   8. "Want to add another unit?" → loop or continue
//   9. Summary → "View in 3D" CTA
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

interface ServiceOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface UnitBuild {
  cols: number;
  rows: number;
  hasTotes: boolean;
  toteColor: "black" | "clear";
  hasWheels: boolean;
  hasTop: boolean;
  wallWidthFt: number;
  wallHeightLabel: string;
}

// Slot width in inches (standard HDX)
const SLOT_WIDTH = 20;
const POST_WIDTH = 1.5;
// Tier height in inches (standard)
const TIER_HEIGHT = 16;

function feetToMaxCols(feet: number): number {
  const inches = feet * 12;
  return Math.max(1, Math.floor((inches - POST_WIDTH) / (SLOT_WIDTH + POST_WIDTH)));
}

const HEIGHT_OPTIONS = [
  { label: "3 ft", description: "~36\" — 2 tiers", rows: 2, inches: 36 },
  { label: "4.5 ft", description: "~52\" — 3 tiers", rows: 3, inches: 52 },
  { label: "5.5 ft", description: "~68\" — 4 tiers (most popular)", rows: 4, inches: 68 },
  { label: "7 ft", description: "~84\" — 5 tiers (max height)", rows: 5, inches: 84 },
];

// ── Message Bubble ──────────────────────────────────────────────────────

function BotMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start animate-fadeInUp">
      <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-slate-800 px-5 py-3.5 text-sm leading-relaxed text-slate-200">
        {children}
      </div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end animate-fadeInUp">
      <div className="rounded-2xl rounded-br-md bg-yellow-400 px-5 py-3 text-sm font-semibold text-slate-900">
        {children}
      </div>
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

  // Current unit being configured
  const [wallWidthFt, setWallWidthFt] = useState(8);
  const [maxCols, setMaxCols] = useState(4);
  const [selectedRows, setSelectedRows] = useState(4);
  const [selectedHeightLabel, setSelectedHeightLabel] = useState("");
  const [hasTotes, setHasTotes] = useState(true);
  const [toteColor, setToteColor] = useState<"black" | "clear">("black");
  const [hasWheels, setHasWheels] = useState(true);
  const [hasTop, setHasTop] = useState(true);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  // All completed units
  const [units, setUnits] = useState<UnitBuild[]>([]);

  // Price calculation
  const [totalPrice, setTotalPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
  }, [step]);

  // ── Available services based on installer ──
  const availableServices = useCallback((): ServiceOption[] => {
    const p = pricing;
    const services: ServiceOption[] = [
      { id: "tote_storage", label: "Tote Storage Racks", description: "27-gallon heavy-duty tote shelving", icon: <Package className="h-5 w-5" /> },
    ];
    if (p?.open_shelving_enabled) {
      services.push({ id: "open_shelving", label: "Open Shelving", description: "Garage/utility shelving units", icon: <Layers className="h-5 w-5" /> });
    }
    if (p?.overhead_storage_enabled) {
      services.push({ id: "overhead_storage", label: "Overhead Ceiling Storage", description: "Ceiling-mounted tote grid", icon: <ArrowUp className="h-5 w-5" /> });
    }
    if (p?.raised_bed_enabled) {
      services.push({ id: "raised_beds", label: "Raised Bed Planters", description: "Custom cedar garden beds", icon: <Flower2 className="h-5 w-5" /> });
    }
    return services;
  }, [pricing]);

  // ── ZIP Search ──
  async function handleSearch() {
    const trimmed = zip.trim();
    if (trimmed.length < 5) { setError("Enter a valid 5-digit ZIP code."); return; }
    setError("");
    setSearching(true);
    try {
      const result = await checkAvailability(trimmed);
      if (result.available && result.installer_id) {
        setInstaller(result);
        setPricing(result.installer_pricing);
        setStep("installer-reveal");
      } else {
        setError(result.message || "No installer found in this area yet.");
      }
    } catch {
      setError("Unable to check availability. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  function handleServiceToggle(serviceId: string) {
    setSelectedServices((prev) =>
      prev.includes(serviceId) ? prev.filter((s) => s !== serviceId) : [...prev, serviceId]
    );
  }

  function handleServicesContinue() {
    if (selectedServices.includes("tote_storage")) {
      setStep("wall-width");
    } else {
      goToDesign();
    }
  }

  function handleWallWidth(feet: number) {
    setWallWidthFt(feet);
    const cols = feetToMaxCols(feet);
    setMaxCols(cols);
    setStep("wall-height");
  }

  function handleHeight(opt: typeof HEIGHT_OPTIONS[number]) {
    setSelectedRows(opt.rows);
    setSelectedHeightLabel(opt.label);
    setStep("tote-bring-or-buy");
  }

  // Finalize current unit and ask about more
  function finalizeUnit() {
    const unit: UnitBuild = {
      cols: maxCols,
      rows: selectedRows,
      hasTotes,
      toteColor,
      hasWheels,
      hasTop,
      wallWidthFt,
      wallHeightLabel: selectedHeightLabel,
    };
    setUnits((prev) => [...prev, unit]);
    setStep("another-unit");
  }

  function startAnotherUnit() {
    // Reset current config for new unit
    setWallWidthFt(8);
    setMaxCols(4);
    setSelectedRows(4);
    setSelectedHeightLabel("");
    setHasTotes(true);
    setToteColor("black");
    setHasWheels(true);
    setHasTop(true);
    setStep("wall-width");
  }

  // Calculate total price for all units
  async function calculateTotalPrice(allUnits: UnitBuild[]) {
    setPriceLoading(true);
    let total = 0;
    try {
      for (const u of allUnits) {
        const result = await calculateBuild({
          cols: u.cols,
          rows: u.rows,
          toteModel: "HDX",
          toteColor: u.toteColor,
          unitType: "standard",
          orientation: "standard",
          addOns: { totes: u.hasTotes, wheels: u.hasWheels, top: u.hasTop },
          mode: "manual",
          installerPricing: pricing || undefined,
        });
        if ("price" in result) total += result.price;
      }
      setTotalPrice(total);
    } catch {}
    setPriceLoading(false);
  }

  function goToSummary() {
    const allUnits = [...units];
    setStep("summary");
    calculateTotalPrice(allUnits);
  }

  function goToDesign() {
    if (!installer?.installer_id) return;
    const allUnits = units.length > 0 ? units : [{
      cols: maxCols, rows: selectedRows, hasTotes, toteColor,
      hasWheels, hasTop, wallWidthFt, wallHeightLabel: selectedHeightLabel,
    }];

    // Encode first unit as config, pass all units count
    const first = allUnits[0];
    const configPayload: Record<string, unknown> = {
      cols: first.cols,
      rows: first.rows,
      toteType: "HDX",
      toteColor: first.toteColor,
      unitType: "standard",
      orientation: "standard",
      hasTotes: first.hasTotes,
      hasWheels: first.hasWheels,
      hasTop: first.hasTop,
    };

    const params = new URLSearchParams();
    params.set("installer", installer.installer_id);
    params.set("from", "network");
    params.set("config", btoa(JSON.stringify(configPayload)));
    router.push("/design?" + params.toString());
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="space-y-4">

        {/* ── ZIP ───────────────────────────────────────────────── */}
        {step === "zip" && (
          <div className="space-y-4 animate-fadeInUp">
            <BotMessage>
              Let&apos;s find your local installer and build your perfect storage system. What&apos;s your ZIP code?
            </BotMessage>
            <div className="flex overflow-hidden rounded-xl border-2 border-yellow-400/30 bg-gray-900 shadow-2xl shadow-yellow-400/10 transition-all focus-within:border-yellow-400 focus-within:shadow-yellow-400/20">
              <div className="flex items-center pl-4 text-yellow-400">
                <MapPin className="h-5 w-5" />
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={zip}
                onChange={(e) => { setZip(e.target.value.replace(/\D/g, "").slice(0, 5)); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                placeholder="ZIP Code"
                className="w-full bg-transparent px-3 py-4 text-lg font-medium text-white placeholder-stone-500 outline-none"
                autoFocus
              />
              <button
                onClick={handleSearch}
                disabled={searching || zip.length < 5}
                className="m-1.5 flex shrink-0 items-center gap-2 rounded-lg bg-yellow-400 px-6 py-3 text-sm font-bold uppercase tracking-wider text-black transition-all hover:bg-yellow-300 disabled:opacity-50"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Find</span><ChevronRight className="h-4 w-4" /></>}
              </button>
            </div>
            {error && <p className="text-sm font-medium text-red-400">{error}</p>}
            <p className="text-xs text-stone-600">We&apos;ll match you with a certified installer in your area.</p>
          </div>
        )}

        {/* ── Installer Reveal ─────────────────────────────────── */}
        {step === "installer-reveal" && installer && (
          <>
            <UserBubble>{zip}</UserBubble>
            <BotMessage>Great news! We found a certified pro in your area.</BotMessage>
            <div className="animate-fadeInUp rounded-2xl border border-stone-700 bg-gray-900/80 p-6 text-center" style={{ animationDelay: "300ms" }}>
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-3 border-yellow-400 bg-gradient-to-br from-yellow-400 to-yellow-500 shadow-lg shadow-yellow-400/30">
                {installer.installer_avatar_url ? (
                  <Image src={installer.installer_avatar_url} alt={installer.installer_name || "Installer"} width={64} height={64} className="h-full w-full object-cover" unoptimized />
                ) : (
                  <Image src="/Header_avatar_logo.png" alt="Storage Network" width={64} height={64} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Verified Pro
              </div>
              <h3 className="mb-1 text-xl font-black uppercase text-white">{installer.installer_name}</h3>
              <div className="mb-3 flex items-center justify-center gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                ))}
                <span className="ml-2 text-xs text-stone-400">Certified Installer</span>
              </div>
              <button
                onClick={() => setStep("services")}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300"
              >
                Let&apos;s Build Something
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {/* ── Services ─────────────────────────────────────────── */}
        {step === "services" && (
          <>
            <BotMessage>What are you looking to get built? Select everything that interests you.</BotMessage>
            <div className="space-y-2 animate-fadeInUp">
              {availableServices().map((svc) => {
                const selected = selectedServices.includes(svc.id);
                return (
                  <button key={svc.id} onClick={() => handleServiceToggle(svc.id)}
                    className={`flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${selected ? "border-yellow-400 bg-yellow-400/10" : "border-stone-700 bg-gray-900/50 hover:border-stone-600"}`}>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-yellow-400 text-gray-950" : "bg-slate-800 text-stone-400"}`}>{svc.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${selected ? "text-yellow-400" : "text-white"}`}>{svc.label}</p>
                      <p className="text-xs text-stone-500">{svc.description}</p>
                    </div>
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${selected ? "border-yellow-400 bg-yellow-400" : "border-stone-600"}`}>
                      {selected && <Check className="h-4 w-4 text-gray-950" />}
                    </div>
                  </button>
                );
              })}
              <button onClick={handleServicesContinue} disabled={selectedServices.length === 0}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-40">
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {/* ── Wall Width ───────────────────────────────────────── */}
        {step === "wall-width" && (
          <>
            <UserBubble>Tote Storage Racks</UserBubble>
            <BotMessage>
              <div className="flex items-center gap-2 mb-1">
                <Ruler className="h-4 w-4 text-yellow-400" />
                <strong>How wide is the wall space?</strong>
              </div>
              Measure the open wall where you want the unit. Don&apos;t worry about being exact — we&apos;ll build to fit.
            </BotMessage>
            <div className="space-y-2 animate-fadeInUp">
              {[
                { ft: 4, label: "~4 feet", desc: "Small nook — fits 2 columns", cols: 2 },
                { ft: 6, label: "~6 feet", desc: "Half wall — fits 3 columns", cols: 3 },
                { ft: 8, label: "~8 feet", desc: "Standard wall — fits 4 columns", cols: 4 },
                { ft: 10, label: "~10 feet", desc: "Wide wall — fits 5 columns", cols: 5 },
                { ft: 12, label: "~12 feet", desc: "Full bay — fits 6 columns", cols: 6 },
              ].map((opt) => (
                <button key={opt.ft} onClick={() => handleWallWidth(opt.ft)}
                  className="flex w-full items-center justify-between rounded-xl border-2 border-stone-700 bg-gray-900/50 p-4 text-left transition-all hover:border-yellow-400">
                  <div>
                    <p className="text-sm font-bold text-white">{opt.label}</p>
                    <p className="text-xs text-stone-500">{opt.desc}</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-yellow-400">
                    {opt.cols} wide
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Wall Height ──────────────────────────────────────── */}
        {step === "wall-height" && (
          <>
            <UserBubble>~{wallWidthFt} feet wide ({maxCols} columns)</UserBubble>
            <BotMessage>
              How tall do you want it? Most people go with 4 tiers — fits under most shelving and leaves room above.
            </BotMessage>
            <div className="space-y-2 animate-fadeInUp">
              {HEIGHT_OPTIONS.map((opt) => (
                <button key={opt.rows} onClick={() => handleHeight(opt)}
                  className={`flex w-full items-center justify-between rounded-xl border-2 p-4 text-left transition-all hover:border-yellow-400 ${opt.rows === 4 ? "border-yellow-400/30 bg-yellow-400/5" : "border-stone-700 bg-gray-900/50"}`}>
                  <div>
                    <p className="text-sm font-bold text-white">{opt.label} tall</p>
                    <p className="text-xs text-stone-500">{opt.description}</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-yellow-400">
                    {opt.rows} tiers
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Totes: bring or buy ──────────────────────────────── */}
        {step === "tote-bring-or-buy" && (
          <>
            <UserBubble>{selectedHeightLabel} tall ({selectedRows} tiers)</UserBubble>
            <BotMessage>
              That&apos;s a {maxCols}&times;{selectedRows} — {maxCols * selectedRows} totes total.
              Would you like {installer?.installer_name} to provide HDX 27-gallon totes, or will you bring your own?
            </BotMessage>
            <div className="space-y-2 animate-fadeInUp">
              <button onClick={() => { setHasTotes(true); setStep("tote-color"); }}
                className="flex w-full items-center gap-4 rounded-xl border-2 border-stone-700 bg-gray-900/50 p-4 text-left transition-all hover:border-yellow-400">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-400/10 text-yellow-400">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Include totes</p>
                  <p className="text-xs text-stone-500">HDX 27-gallon from Home Depot — ${pricing?.standard_tote ?? 12}/each</p>
                </div>
              </button>
              <button onClick={() => { setHasTotes(false); setToteColor("black"); setStep("wheels"); }}
                className="flex w-full items-center gap-4 rounded-xl border-2 border-stone-700 bg-gray-900/50 p-4 text-left transition-all hover:border-yellow-400">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-stone-400">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">I&apos;ll bring my own</p>
                  <p className="text-xs text-stone-500">I already have or will buy totes separately</p>
                </div>
              </button>
            </div>
          </>
        )}

        {/* ── Tote Color ───────────────────────────────────────── */}
        {step === "tote-color" && (
          <>
            <UserBubble>Include totes</UserBubble>
            <BotMessage>HDX totes come in two options:</BotMessage>
            <div className="space-y-2 animate-fadeInUp">
              <button onClick={() => { setToteColor("black"); setStep("wheels"); }}
                className="flex w-full items-center gap-4 rounded-xl border-2 border-stone-700 bg-gray-900/50 p-4 text-left transition-all hover:border-yellow-400">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-gray-800 border-2 border-stone-600" />
                <div>
                  <p className="text-sm font-bold text-white">Black with Yellow Lid</p>
                  <p className="text-xs text-stone-500">${pricing?.standard_tote ?? 12}/tote — most popular</p>
                </div>
              </button>
              <button onClick={() => { setToteColor("clear"); setStep("wheels"); }}
                className="flex w-full items-center gap-4 rounded-xl border-2 border-stone-700 bg-gray-900/50 p-4 text-left transition-all hover:border-yellow-400">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-blue-100/20 border-2 border-blue-300/30" />
                <div>
                  <p className="text-sm font-bold text-white">Clear with Yellow Lid</p>
                  <p className="text-xs text-stone-500">${pricing?.standard_tote_clear ?? 20}/tote — see what&apos;s inside</p>
                </div>
              </button>
            </div>
          </>
        )}

        {/* ── Wheels ────────────────────────────────────────────── */}
        {step === "wheels" && (
          <>
            <UserBubble>{hasTotes ? (toteColor === "clear" ? "Clear totes" : "Black totes") : "Bringing my own totes"}</UserBubble>
            <BotMessage>
              Want industrial casters so you can roll the unit out? Great for cleaning behind or accessing both sides.
            </BotMessage>
            <div className="space-y-2 animate-fadeInUp">
              <button onClick={() => { setHasWheels(true); setStep("top"); }}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-stone-700 bg-gray-900/50 p-4 text-left transition-all hover:border-yellow-400">
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">Yes, add wheels</p>
                  <p className="text-xs text-stone-500">+${pricing?.standard_wheels ?? 65}</p>
                </div>
              </button>
              <button onClick={() => { setHasWheels(false); setStep("top"); }}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-stone-700 bg-gray-900/50 p-4 text-left transition-all hover:border-yellow-400">
                <p className="text-sm font-bold text-white">No wheels</p>
              </button>
            </div>
          </>
        )}

        {/* ── Plywood Top ──────────────────────────────────────── */}
        {step === "top" && (
          <>
            <UserBubble>{hasWheels ? "Yes, add wheels" : "No wheels"}</UserBubble>
            <BotMessage>
              Want a plywood top surface? Makes a great workbench or folding station.
            </BotMessage>
            <div className="space-y-2 animate-fadeInUp">
              <button onClick={() => { setHasTop(true); finalizeUnit(); }}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-stone-700 bg-gray-900/50 p-4 text-left transition-all hover:border-yellow-400">
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">Yes, add a top</p>
                  <p className="text-xs text-stone-500">+${pricing?.plywood_top ?? 95}</p>
                </div>
              </button>
              <button onClick={() => { setHasTop(false); finalizeUnit(); }}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-stone-700 bg-gray-900/50 p-4 text-left transition-all hover:border-yellow-400">
                <p className="text-sm font-bold text-white">No top needed</p>
              </button>
            </div>
          </>
        )}

        {/* ── Another Unit? ────────────────────────────────────── */}
        {step === "another-unit" && (
          <>
            <UserBubble>{maxCols}&times;{selectedRows} unit added</UserBubble>
            <BotMessage>
              Unit #{units.length} saved! Want to add another unit for a different wall or spot?
            </BotMessage>
            <div className="space-y-2 animate-fadeInUp">
              <button onClick={startAnotherUnit}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-yellow-400/30 bg-yellow-400/5 p-4 text-sm font-bold text-yellow-400 transition-all hover:border-yellow-400 hover:bg-yellow-400/10">
                <Plus className="h-4 w-4" />
                Add Another Unit
              </button>
              <button onClick={goToSummary}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300">
                Continue to Summary
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {/* ── Summary ──────────────────────────────────────────── */}
        {step === "summary" && (
          <>
            <BotMessage>
              Here&apos;s everything. Review your build, then see it in 3D with your installer&apos;s exact pricing.
            </BotMessage>
            <div className="animate-fadeInUp rounded-2xl border border-stone-700 bg-gray-900/80 p-5 space-y-4">
              {units.map((u, i) => (
                <div key={i} className="rounded-xl bg-slate-800/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Unit {i + 1}</p>
                    <p className="text-sm font-black text-white">{u.cols}&times;{u.rows}</p>
                  </div>
                  <div className="space-y-1">
                    <SummaryRow label="Wall" value={`~${u.wallWidthFt}ft wide`} />
                    <SummaryRow label="Size" value={`${u.cols} columns × ${u.rows} tiers`} />
                    <SummaryRow label="Totes" value={u.hasTotes ? `${u.cols * u.rows}× HDX ${u.toteColor}` : "Bringing my own"} />
                    <SummaryRow label="Wheels" value={u.hasWheels ? "Yes" : "No"} />
                    <SummaryRow label="Top" value={u.hasTop ? "Plywood top" : "No"} />
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between border-t border-stone-800 pt-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                    {units.length} unit{units.length > 1 ? "s" : ""} total
                  </p>
                  <p className="text-sm font-bold text-white">{units.reduce((s, u) => s + u.cols * u.rows, 0)} tote slots</p>
                </div>
                {priceLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
                ) : totalPrice !== null ? (
                  <div className="text-right">
                    <p className="text-xs text-stone-500">Est. Price</p>
                    <p className="text-2xl font-black text-yellow-400">${totalPrice}</p>
                  </div>
                ) : null}
              </div>

              <SummaryRow label="Installer" value={installer?.installer_name || "—"} highlight />

              <p className="text-[11px] text-stone-600">
                Final pricing shown in the 3D designer with your installer&apos;s exact rates.
              </p>

              <button onClick={goToDesign}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-4 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/30 transition-all hover:bg-yellow-300 hover:-translate-y-0.5">
                View My Design in 3D
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        <div ref={scrollRef} />
      </div>
    </div>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-xs text-stone-500">{label}</span>
      <span className={`text-xs font-semibold ${highlight ? "text-yellow-400" : "text-white"}`}>{value}</span>
    </div>
  );
}
