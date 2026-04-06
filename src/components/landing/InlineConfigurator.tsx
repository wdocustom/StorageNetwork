"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  MapPin, Loader2, ChevronRight, CheckCircle2, Star,
  Package, Hammer, Flower2, ArrowUp, Layers, ShoppingCart,
  Check, ArrowRight,
} from "lucide-react";
import { checkAvailability, type AvailabilityResult } from "@/app/actions/customer";
import { calculateBuild } from "@/app/actions/calculator";
import { calculateCompoundBuild } from "@/app/actions/calculator";
import { BESTSELLER_PRESETS, type BestsellerPreset } from "@/lib/presets";
import type { InstallerPricing } from "@/types/viewModels";

// ═══════════════════════════════════════════════════════════════════════════
// Inline Configurator — Guided Customer Journey
//
// Replaces the ZIP search + Pro Found modal with an inline, conversational
// step-by-step flow. Lives in the hero section of the landing page.
//
// Flow:
//   1. ZIP code entry
//   2. Installer reveal (animated)
//   3. Service selection (based on what this installer offers)
//   4. Tote rack configuration questions (if selected)
//   5. Summary + "View in 3D" CTA → /design with pre-filled config
// ═══════════════════════════════════════════════════════════════════════════

type Step =
  | "zip"
  | "installer-reveal"
  | "services"
  | "tote-bring-or-buy"
  | "tote-color"
  | "build-type"
  | "custom-cols"
  | "custom-rows"
  | "custom-wheels"
  | "custom-top"
  | "summary";

interface ServiceOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
}

interface ConfigState {
  hasTotes: boolean;
  toteColor: "black" | "clear";
  buildType: "preset" | "custom";
  presetId: string | null;
  cols: number;
  rows: number;
  hasWheels: boolean;
  hasTop: boolean;
  selectedServices: string[];
}

// ── Message Bubble ──────────────────────────────────────────────────────

function BotMessage({ children, animate = true }: { children: React.ReactNode; animate?: boolean }) {
  return (
    <div className={`flex justify-start ${animate ? "animate-fadeInUp" : ""}`}>
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
  const [summaryPrice, setSummaryPrice] = useState<number | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [config, setConfig] = useState<ConfigState>({
    hasTotes: true,
    toteColor: "black",
    buildType: "preset",
    presetId: null,
    cols: 4,
    rows: 4,
    hasWheels: true,
    hasTop: true,
    selectedServices: [],
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on step change
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
  }, [step]);

  // ── Derived: available services based on installer pricing toggles ──
  const availableServices = useCallback((): ServiceOption[] => {
    const p = pricing;
    const services: ServiceOption[] = [
      {
        id: "tote_storage",
        label: "Tote Storage Racks",
        description: "27-gallon heavy-duty tote shelving system",
        icon: <Package className="h-5 w-5" />,
        enabled: true, // Always available
      },
    ];

    if (p?.open_shelving_enabled) {
      services.push({
        id: "open_shelving",
        label: "Open Shelving",
        description: "Garage/utility shelving units",
        icon: <Layers className="h-5 w-5" />,
        enabled: true,
      });
    }

    if (p?.overhead_storage_enabled) {
      services.push({
        id: "overhead_storage",
        label: "Overhead Ceiling Storage",
        description: "Ceiling-mounted tote grid system",
        icon: <ArrowUp className="h-5 w-5" />,
        enabled: true,
      });
    }

    if (p?.raised_bed_enabled) {
      services.push({
        id: "raised_beds",
        label: "Raised Bed Planters",
        description: "Custom cedar garden beds",
        icon: <Flower2 className="h-5 w-5" />,
        enabled: true,
      });
    }

    return services;
  }, [pricing]);

  // ── Derived: available presets (filtered by installer disabled flags) ──
  const availablePresets = useCallback((): BestsellerPreset[] => {
    const p = pricing;
    if (!p) return BESTSELLER_PRESETS;
    return BESTSELLER_PRESETS.filter((preset) => {
      const key = `bestseller_${preset.id.replace(/-/g, "_")}_disabled` as keyof InstallerPricing;
      return p[key] !== true;
    });
  }, [pricing]);

  // ── ZIP Search ──
  async function handleSearch() {
    const trimmed = zip.trim();
    if (trimmed.length < 5) {
      setError("Enter a valid 5-digit ZIP code.");
      return;
    }
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

  // ── Service selection handler ──
  function handleServiceToggle(serviceId: string) {
    setConfig((prev) => {
      const selected = prev.selectedServices.includes(serviceId)
        ? prev.selectedServices.filter((s) => s !== serviceId)
        : [...prev.selectedServices, serviceId];
      return { ...prev, selectedServices: selected };
    });
  }

  function handleServicesContinue() {
    if (config.selectedServices.includes("tote_storage")) {
      setStep("tote-bring-or-buy");
    } else {
      // No tote storage selected — go straight to design page with selected services
      goToDesign();
    }
  }

  // ── Price calculation for summary ──
  async function calculateSummaryPrice() {
    setSummaryLoading(true);
    try {
      if (config.buildType === "preset" && config.presetId) {
        const result = await calculateCompoundBuild({
          presetId: config.presetId,
          hasTotes: config.hasTotes,
          installerPricing: pricing || undefined,
        });
        if ("totalPrice" in result) {
          setSummaryPrice(result.totalPrice);
        }
      } else {
        const result = await calculateBuild({
          cols: config.cols,
          rows: config.rows,
          toteModel: "HDX",
          toteColor: config.toteColor,
          unitType: "standard",
          orientation: "standard",
          addOns: {
            totes: config.hasTotes,
            wheels: config.hasWheels,
            top: config.hasTop,
          },
          mode: "manual",
          installerPricing: pricing || undefined,
        });
        if ("price" in result) {
          setSummaryPrice(result.price);
        }
      }
    } catch {
      // Price calc failed — still show summary without price
    }
    setSummaryLoading(false);
  }

  // ── Navigate to /design with pre-filled config ──
  function goToDesign() {
    if (!installer?.installer_id) return;

    const configPayload: Record<string, unknown> = {
      cols: config.cols,
      rows: config.rows,
      toteType: "HDX",
      toteColor: config.toteColor,
      unitType: "standard",
      orientation: "standard",
      hasTotes: config.hasTotes,
      hasWheels: config.hasWheels,
      hasTop: config.hasTop,
    };

    if (config.buildType === "preset" && config.presetId) {
      configPayload.preset = config.presetId;
    }

    const params = new URLSearchParams();
    params.set("installer", installer.installer_id);
    params.set("from", "network");
    params.set("config", btoa(JSON.stringify(configPayload)));

    router.push(`/design?${params.toString()}`);
  }

  // ── Preset label for summary ──
  const selectedPreset = config.presetId
    ? BESTSELLER_PRESETS.find((p) => p.id === config.presetId)
    : null;

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="space-y-4">

        {/* ── Step: ZIP Code ────────────────────────────────────────── */}
        {step === "zip" && (
          <div className="space-y-4 animate-fadeInUp">
            <BotMessage animate={false}>
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
                onChange={(e) => {
                  setZip(e.target.value.replace(/\D/g, "").slice(0, 5));
                  setError("");
                }}
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
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Find
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>

            {error && <p className="text-sm font-medium text-red-400">{error}</p>}
            <p className="text-xs text-stone-600">
              We&apos;ll match you with a certified installer in your area.
            </p>
          </div>
        )}

        {/* ── Step: Installer Reveal ───────────────────────────────── */}
        {step === "installer-reveal" && installer && (
          <>
            <UserBubble>{zip}</UserBubble>

            <div className="animate-fadeInUp">
              <BotMessage>
                Great news! We found a certified pro in your area.
              </BotMessage>
            </div>

            <div className="animate-fadeInUp rounded-2xl border border-stone-700 bg-gray-900/80 p-6 text-center" style={{ animationDelay: "300ms" }}>
              {/* Avatar */}
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-3 border-yellow-400 bg-gradient-to-br from-yellow-400 to-yellow-500 shadow-lg shadow-yellow-400/30">
                {installer.installer_avatar_url ? (
                  <Image
                    src={installer.installer_avatar_url}
                    alt={installer.installer_name || "Installer"}
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <Image
                    src="/Header_avatar_logo.png"
                    alt="Storage Network"
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Verified Pro
              </div>

              <h3 className="mb-1 text-xl font-black uppercase text-white">
                {installer.installer_name}
              </h3>

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

        {/* ── Step: Service Selection ──────────────────────────────── */}
        {step === "services" && (
          <>
            <BotMessage>
              What are you looking to get built? Select everything that interests you.
            </BotMessage>

            <div className="space-y-2 animate-fadeInUp">
              {availableServices().map((service) => {
                const selected = config.selectedServices.includes(service.id);
                return (
                  <button
                    key={service.id}
                    onClick={() => handleServiceToggle(service.id)}
                    className={`flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                      selected
                        ? "border-yellow-400 bg-yellow-400/10"
                        : "border-stone-700 bg-gray-900/50 hover:border-stone-600"
                    }`}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      selected ? "bg-yellow-400 text-gray-950" : "bg-slate-800 text-stone-400"
                    }`}>
                      {service.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${selected ? "text-yellow-400" : "text-white"}`}>
                        {service.label}
                      </p>
                      <p className="text-xs text-stone-500">{service.description}</p>
                    </div>
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                      selected ? "border-yellow-400 bg-yellow-400" : "border-stone-600"
                    }`}>
                      {selected && <Check className="h-4 w-4 text-gray-950" />}
                    </div>
                  </button>
                );
              })}

              <button
                onClick={handleServicesContinue}
                disabled={config.selectedServices.length === 0}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-40"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {/* ── Step: Bring totes or installer provides? ─────────────── */}
        {step === "tote-bring-or-buy" && (
          <>
            <UserBubble>Tote Storage Racks</UserBubble>
            <BotMessage>
              Will you be bringing your own 27-gallon HDX totes, or would you like {installer?.installer_name} to provide them?
            </BotMessage>

            <div className="space-y-2 animate-fadeInUp">
              <button
                onClick={() => {
                  setConfig((prev) => ({ ...prev, hasTotes: true }));
                  setStep("tote-color");
                }}
                className="flex w-full items-center gap-4 rounded-xl border-2 border-stone-700 bg-gray-900/50 p-4 text-left transition-all hover:border-yellow-400"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-400/10 text-yellow-400">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Include totes</p>
                  <p className="text-xs text-stone-500">
                    HDX 27-gallon totes from Home Depot — ${pricing?.standard_tote ?? 12}/each
                  </p>
                </div>
              </button>

              <button
                onClick={() => {
                  setConfig((prev) => ({ ...prev, hasTotes: false, toteColor: "black" }));
                  setStep("build-type");
                }}
                className="flex w-full items-center gap-4 rounded-xl border-2 border-stone-700 bg-gray-900/50 p-4 text-left transition-all hover:border-yellow-400"
              >
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

        {/* ── Step: Tote Color ────────────────────────────────────── */}
        {step === "tote-color" && (
          <>
            <UserBubble>Include totes</UserBubble>
            <BotMessage>
              HDX totes come in two options. Which do you prefer?
            </BotMessage>

            <div className="space-y-2 animate-fadeInUp">
              <button
                onClick={() => {
                  setConfig((prev) => ({ ...prev, toteColor: "black" }));
                  setStep("build-type");
                }}
                className="flex w-full items-center gap-4 rounded-xl border-2 border-stone-700 bg-gray-900/50 p-4 text-left transition-all hover:border-yellow-400"
              >
                <div className="h-10 w-10 shrink-0 rounded-lg bg-gray-800 border-2 border-stone-600" />
                <div>
                  <p className="text-sm font-bold text-white">Black with Yellow Lid</p>
                  <p className="text-xs text-stone-500">${pricing?.standard_tote ?? 12}/tote — most popular</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setConfig((prev) => ({ ...prev, toteColor: "clear" }));
                  setStep("build-type");
                }}
                className="flex w-full items-center gap-4 rounded-xl border-2 border-stone-700 bg-gray-900/50 p-4 text-left transition-all hover:border-yellow-400"
              >
                <div className="h-10 w-10 shrink-0 rounded-lg bg-blue-100/20 border-2 border-blue-300/30" />
                <div>
                  <p className="text-sm font-bold text-white">Clear with Yellow Lid</p>
                  <p className="text-xs text-stone-500">${pricing?.standard_tote_clear ?? 20}/tote — see what&apos;s inside</p>
                </div>
              </button>
            </div>
          </>
        )}

        {/* ── Step: Build Type — Preset or Custom ─────────────────── */}
        {step === "build-type" && (
          <>
            <UserBubble>
              {config.hasTotes ? `${config.toteColor === "clear" ? "Clear" : "Black"} totes` : "Bringing my own totes"}
            </UserBubble>
            <BotMessage>
              Want to start with one of our bestselling designs, or build a custom size?
            </BotMessage>

            <div className="space-y-2 animate-fadeInUp">
              {/* Presets */}
              {availablePresets().map((preset) => {
                const totalSlots = preset.units.reduce((sum, u) => sum + u.cols * u.rows, 0);
                const unitDesc = preset.units.map((u) => `${u.cols}×${u.rows}`).join(" + ");
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setConfig((prev) => ({ ...prev, buildType: "preset", presetId: preset.id }));
                      // Calculate price then go to summary
                      setStep("summary");
                    }}
                    className="flex w-full items-center gap-4 rounded-xl border-2 border-stone-700 bg-gray-900/50 p-4 text-left transition-all hover:border-yellow-400"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-400/10 text-yellow-400">
                      <Hammer className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white">{preset.name}</p>
                        <span className="rounded-full bg-yellow-400/15 px-2 py-0.5 text-[10px] font-bold text-yellow-400">{preset.label}</span>
                      </div>
                      <p className="text-xs text-stone-500">{unitDesc} — {totalSlots} totes</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-stone-500" />
                  </button>
                );
              })}

              {/* Custom option */}
              <button
                onClick={() => {
                  setConfig((prev) => ({ ...prev, buildType: "custom", presetId: null }));
                  setStep("custom-cols");
                }}
                className="flex w-full items-center gap-4 rounded-xl border-2 border-stone-700 bg-gray-900/50 p-4 text-left transition-all hover:border-yellow-400"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-stone-400">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Custom Size</p>
                  <p className="text-xs text-stone-500">Choose exact columns and rows</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-stone-500" />
              </button>
            </div>
          </>
        )}

        {/* ── Step: Custom Columns ─────────────────────────────────── */}
        {step === "custom-cols" && (
          <>
            <UserBubble>Custom size</UserBubble>
            <BotMessage>
              How many columns wide? Each column is about 20 inches. An 8-foot wall fits 4 columns.
            </BotMessage>

            <div className="grid grid-cols-5 gap-2 animate-fadeInUp">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setConfig((prev) => ({ ...prev, cols: n }));
                    setStep("custom-rows");
                  }}
                  className="flex h-14 items-center justify-center rounded-xl border-2 border-stone-700 bg-gray-900/50 text-lg font-black text-white transition-all hover:border-yellow-400 hover:bg-yellow-400/10"
                >
                  {n}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Step: Custom Rows ────────────────────────────────────── */}
        {step === "custom-rows" && (
          <>
            <UserBubble>{config.cols} columns wide</UserBubble>
            <BotMessage>
              How many rows tall? Each row is about 16 inches. Most popular is 4 rows (~68&quot; tall).
            </BotMessage>

            <div className="grid grid-cols-5 gap-2 animate-fadeInUp">
              {[2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setConfig((prev) => ({ ...prev, rows: n }));
                    setStep("custom-wheels");
                  }}
                  className={`flex h-14 flex-col items-center justify-center rounded-xl border-2 border-stone-700 bg-gray-900/50 transition-all hover:border-yellow-400 hover:bg-yellow-400/10 ${n === 4 ? "ring-1 ring-yellow-400/30" : ""}`}
                >
                  <span className="text-lg font-black text-white">{n}</span>
                  {n === 4 && <span className="text-[9px] text-yellow-400/70">Popular</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Step: Wheels ─────────────────────────────────────────── */}
        {step === "custom-wheels" && (
          <>
            <UserBubble>{config.rows} rows tall</UserBubble>
            <BotMessage>
              Want industrial casters so you can roll it out? Great for cleaning behind or accessing both sides.
            </BotMessage>

            <div className="space-y-2 animate-fadeInUp">
              <button
                onClick={() => { setConfig((prev) => ({ ...prev, hasWheels: true })); setStep("custom-top"); }}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-stone-700 bg-gray-900/50 p-4 text-left transition-all hover:border-yellow-400"
              >
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">Yes, add wheels</p>
                  <p className="text-xs text-stone-500">+${pricing?.standard_wheels ?? 65}</p>
                </div>
              </button>
              <button
                onClick={() => { setConfig((prev) => ({ ...prev, hasWheels: false })); setStep("custom-top"); }}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-stone-700 bg-gray-900/50 p-4 text-left transition-all hover:border-yellow-400"
              >
                <p className="text-sm font-bold text-white">No wheels — wall-mounted is fine</p>
              </button>
            </div>
          </>
        )}

        {/* ── Step: Plywood Top ────────────────────────────────────── */}
        {step === "custom-top" && (
          <>
            <UserBubble>{config.hasWheels ? "Yes, add wheels" : "No wheels"}</UserBubble>
            <BotMessage>
              Want a plywood top surface? Makes a great workbench or folding station.
            </BotMessage>

            <div className="space-y-2 animate-fadeInUp">
              <button
                onClick={() => { setConfig((prev) => ({ ...prev, hasTop: true })); setStep("summary"); }}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-stone-700 bg-gray-900/50 p-4 text-left transition-all hover:border-yellow-400"
              >
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">Yes, add a top</p>
                  <p className="text-xs text-stone-500">+${pricing?.plywood_top ?? 95}</p>
                </div>
              </button>
              <button
                onClick={() => { setConfig((prev) => ({ ...prev, hasTop: false })); setStep("summary"); }}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-stone-700 bg-gray-900/50 p-4 text-left transition-all hover:border-yellow-400"
              >
                <p className="text-sm font-bold text-white">No top needed</p>
              </button>
            </div>
          </>
        )}

        {/* ── Step: Summary ────────────────────────────────────────── */}
        {step === "summary" && (
          <SummaryStep
            config={config}
            installer={installer}
            pricing={pricing}
            selectedPreset={selectedPreset}
            summaryPrice={summaryPrice}
            summaryLoading={summaryLoading}
            onCalculate={calculateSummaryPrice}
            onGoToDesign={goToDesign}
          />
        )}

        <div ref={scrollRef} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Summary Step — separated for readability
// ═══════════════════════════════════════════════════════════════════════════

function SummaryStep({
  config,
  installer,
  pricing,
  selectedPreset,
  summaryPrice,
  summaryLoading,
  onCalculate,
  onGoToDesign,
}: {
  config: ConfigState;
  installer: AvailabilityResult | null;
  pricing: InstallerPricing | null;
  selectedPreset: BestsellerPreset | null | undefined;
  summaryPrice: number | null;
  summaryLoading: boolean;
  onCalculate: () => void;
  onGoToDesign: () => void;
}) {
  // Auto-calculate price on mount
  useEffect(() => {
    if (summaryPrice === null && !summaryLoading) {
      onCalculate();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buildLabel = selectedPreset
    ? selectedPreset.name
    : `${config.cols}×${config.rows} Custom`;

  const totalSlots = selectedPreset
    ? selectedPreset.units.reduce((sum, u) => sum + u.cols * u.rows, 0)
    : config.cols * config.rows;

  return (
    <>
      <UserBubble>{config.hasTop ? "Yes, add a top" : selectedPreset ? selectedPreset.name : "No top needed"}</UserBubble>
      <BotMessage>
        Here&apos;s your build! Review everything, then see it in 3D.
      </BotMessage>

      <div className="animate-fadeInUp rounded-2xl border border-stone-700 bg-gray-900/80 p-5">
        {/* Build name + installer */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Your Build</p>
            <p className="text-lg font-black text-white">{buildLabel}</p>
          </div>
          {summaryLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
          ) : summaryPrice !== null ? (
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Est. Price</p>
              <p className="text-2xl font-black text-yellow-400">${summaryPrice}</p>
            </div>
          ) : null}
        </div>

        {/* Config details */}
        <div className="space-y-2 border-t border-stone-800 pt-3">
          <SummaryRow label="Size" value={selectedPreset ? selectedPreset.units.map((u) => `${u.cols}×${u.rows}`).join(" + ") : `${config.cols} columns × ${config.rows} rows`} />
          <SummaryRow label="Totes" value={config.hasTotes ? `${totalSlots}× HDX ${config.toteColor}` : "Bringing my own"} />
          {config.buildType === "custom" && (
            <>
              <SummaryRow label="Wheels" value={config.hasWheels ? "Yes" : "No"} />
              <SummaryRow label="Top" value={config.hasTop ? "Plywood top" : "No"} />
            </>
          )}
          <SummaryRow label="Installer" value={installer?.installer_name || "—"} highlight />
        </div>

        <p className="mt-3 text-[11px] text-stone-600">
          Final pricing calculated in the 3D designer with your installer&apos;s exact rates.
        </p>

        <button
          onClick={onGoToDesign}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-4 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/30 transition-all hover:bg-yellow-300 hover:-translate-y-0.5"
        >
          View My Design in 3D
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-stone-500">{label}</span>
      <span className={`text-xs font-semibold ${highlight ? "text-yellow-400" : "text-white"}`}>{value}</span>
    </div>
  );
}
