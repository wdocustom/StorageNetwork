"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Loader2, CheckCircle2, Star,
  ArrowRight, Calendar, Hammer,
} from "lucide-react";
import { checkAvailability, type AvailabilityResult } from "@/app/actions/customer";

type Step = "zip" | "installer-reveal";

const PLACEHOLDERS = [
  "Enter your ZIP code",
  "e.g. 90210",
  "See pricing in your area",
  "e.g. 43016",
  "Find your local pro",
];

function getNextAvailableDate(leadTimeDays: number, workingDays: string[]): string {
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const workingSet = new Set(workingDays.map((d) => dayMap[d]));
  const date = new Date();
  let daysAdded = 0;
  while (daysAdded < leadTimeDays) {
    date.setDate(date.getDate() + 1);
    if (workingSet.has(date.getDay())) daysAdded++;
  }
  while (!workingSet.has(date.getDay())) date.setDate(date.getDate() + 1);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function InlineConfigurator() {
  const router = useRouter();
  const [zip, setZip] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<Step>("zip");
  const [installer, setInstaller] = useState<AvailabilityResult | null>(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const revealRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step !== "zip") return;
    const interval = setInterval(() => setPlaceholderIdx((i) => i + 1), 3000);
    return () => clearInterval(interval);
  }, [step]);

  useEffect(() => {
    if (step === "installer-reveal" && revealRef.current) {
      const t = setTimeout(() => {
        revealRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 400);
      return () => clearTimeout(t);
    }
  }, [step]);

  async function handleSearch() {
    const trimmed = zip.trim();
    if (trimmed.length < 5) { setError("Enter a valid 5-digit ZIP code."); return; }
    setError(""); setSearching(true);
    try {
      const result = await checkAvailability(trimmed);
      if (result.available && result.installer_id) {
        setInstaller(result); setStep("installer-reveal");
      } else { setError(result.message || "No installer found in this area yet."); }
    } catch { setError("Unable to check availability. Please try again."); }
    finally { setSearching(false); }
  }

  function goToDesign() {
    if (!installer?.installer_id) return;
    router.push(`/design?installer=${installer.installer_id}&from=network`);
  }

  const startingPrice = installer?.installer_pricing?.standard_slot
    ? installer.installer_pricing.standard_slot * 4
    : 120;

  const nextAvailable = installer
    ? getNextAvailableDate(installer.installer_lead_time, installer.installer_working_days)
    : "";

  return (
    <div className="mx-auto w-full max-w-lg">
      <AnimatePresence mode="wait">
        {/* ── ZIP ────────────────────────────────────────────── */}
        {step === "zip" && (
          <motion.div
            key="zip-step"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <motion.div
              className="flex overflow-hidden rounded-xl border-2 border-yellow-400/30 bg-gray-900 shadow-2xl shadow-yellow-400/10"
              animate={{
                boxShadow: [
                  "0 0 0 0 rgba(250,204,21,0)",
                  "0 0 24px 4px rgba(250,204,21,0.15)",
                  "0 0 0 0 rgba(250,204,21,0)",
                ],
              }}
              transition={{ duration: 2.5, repeat: 2, ease: "easeInOut" }}
            >
              <div className="flex items-center pl-4 text-yellow-400">
                <MapPin className="h-5 w-5" />
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={zip}
                aria-label="ZIP code"
                onChange={(e) => { setZip(e.target.value.replace(/\D/g, "").slice(0, 5)); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                placeholder={PLACEHOLDERS[placeholderIdx % PLACEHOLDERS.length]}
                className="w-full bg-transparent px-3 py-4 text-lg font-medium text-white placeholder-stone-500 outline-none"
                autoFocus
              />
              <button
                onClick={handleSearch}
                disabled={searching || zip.length < 5}
                className="m-1.5 flex shrink-0 items-center gap-2 rounded-lg bg-yellow-400 px-5 py-3 text-sm font-bold uppercase tracking-wider text-black transition-all hover:bg-yellow-300 disabled:opacity-50"
              >
                {searching
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <><span>Check Availability</span><ArrowRight className="h-4 w-4" /></>
                }
              </button>
            </motion.div>

            {error && <p className="mt-3 text-sm font-medium text-red-400">{error}</p>}
            <p className="mt-4 text-xs text-stone-500">
              Free 3D design tool — no sign-up required
            </p>
          </motion.div>
        )}

        {/* ── Installer Reveal + Price Teaser + Configurator Preview ── */}
        {step === "installer-reveal" && installer && (
          <motion.div
            key="reveal-step"
            ref={revealRef}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="rounded-2xl border border-stone-700/50 bg-gray-900/60 p-8 text-center backdrop-blur-sm"
          >
            {/* Avatar */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.05, type: "spring", stiffness: 300, damping: 24 }}
              className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-yellow-400 bg-gradient-to-br from-yellow-400 to-yellow-500 shadow-lg shadow-yellow-400/30"
            >
              {installer.installer_avatar_url ? (
                <Image src={installer.installer_avatar_url} alt={installer.installer_name || ""} width={80} height={80} className="h-full w-full object-cover" unoptimized />
              ) : (
                <Image src="/Header_avatar_logo.png" alt="Storage Network" width={80} height={80} className="h-full w-full object-cover" />
              )}
            </motion.div>

            {/* Badge + Name + Stars */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
            >
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Verified Pro
              </div>
              <h3 className="mb-1 text-2xl font-black uppercase text-white">{installer.installer_name}</h3>
              <div className="mb-3 flex items-center justify-center gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
            </motion.div>

            {/* Stats row */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="mb-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-stone-400"
            >
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-yellow-400/70" />
                Available as early as {nextAvailable}
              </span>
              {installer.installer_completed_jobs > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Hammer className="h-3.5 w-3.5 text-yellow-400/70" />
                  {installer.installer_completed_jobs} installs completed
                </span>
              )}
            </motion.div>

            {/* Price teaser */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.4 }}
              className="mb-5"
            >
              <div className="mx-auto max-w-xs rounded-lg border border-stone-700/40 bg-gray-950/50 px-4 py-3">
                <p className="text-sm text-stone-300">
                  Tote racks from{" "}
                  <span className="font-black text-yellow-400">${startingPrice}</span>{" "}
                  installed
                </p>
                <p className="mt-0.5 text-[10px] text-stone-500">Custom sizes, totes &amp; add-ons available</p>
              </div>
            </motion.div>

            {/* Configurator preview */}
            <motion.div
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.4 }}
              className="mb-5 hidden sm:block"
            >
              <button onClick={goToDesign} className="group relative mx-auto block w-full max-w-xs overflow-hidden rounded-xl">
                <Image
                  src="/feature-configurator.png"
                  alt="3D Configurator Preview"
                  width={400}
                  height={240}
                  className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 512px) 100vw, 400px"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-gray-950/50 backdrop-blur-[2px] transition-all group-hover:bg-gray-950/40">
                  <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur-sm">
                    Design yours in 3D <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.4 }}
            >
              <motion.button
                onClick={goToDesign}
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ delay: 0.8, duration: 0.6, repeat: 2 }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-4 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/30 transition-all hover:bg-yellow-300 hover:-translate-y-0.5"
              >
                Design Your System — Free
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ArrowRight className="h-4 w-4" />
                </motion.span>
              </motion.button>
              <p className="mt-3 text-[11px] text-stone-500">No account needed. No commitment.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
