"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Loader2, ArrowRight, Check,
  Paintbrush, Wrench, ShieldCheck,
} from "lucide-react";
import { checkAvailability, type AvailabilityResult } from "@/app/actions/customer";

type Step = "zip" | "reveal";

const PLACEHOLDERS = [
  "Enter your ZIP code",
  "e.g. 90210",
  "See pricing in your area",
  "e.g. 43016",
  "Find your local pro",
];

const VALUE_PROPS = [
  { icon: Paintbrush, text: "Free 3D design — see your system before you buy" },
  { icon: Wrench, text: "Professional installation included in every order" },
  { icon: ShieldCheck, text: "Lifetime structural warranty on every build" },
];

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
    if (step === "reveal" && revealRef.current) {
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
        setInstaller(result); setStep("reveal");
      } else { setError(result.message || "No installer found in this area yet."); }
    } catch { setError("Unable to check availability. Please try again."); }
    finally { setSearching(false); }
  }

  function goToDesign() {
    if (!installer?.installer_id) return;
    router.push(`/design?installer=${installer.installer_id}&from=network`);
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <AnimatePresence mode="wait">
        {/* ── ZIP Entry ────────────────────────────────────── */}
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
                  : <><span>See My Options</span><ArrowRight className="h-4 w-4" /></>
                }
              </button>
            </motion.div>

            {error && <p className="mt-3 text-sm font-medium text-red-400">{error}</p>}
            <p className="mt-4 text-xs text-stone-500">
              Free 3D design tool — no sign-up required
            </p>
          </motion.div>
        )}

        {/* ── The Reveal — customer-focused, outcome-driven ── */}
        {step === "reveal" && installer && (
          <motion.div
            key="reveal-step"
            ref={revealRef}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="rounded-2xl border border-stone-700/50 bg-gray-900/60 p-8 backdrop-blur-sm"
          >
            {/* Success check */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.05, type: "spring", stiffness: 400, damping: 20 }}
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15"
            >
              <Check className="h-7 w-7 text-emerald-400" strokeWidth={3} />
            </motion.div>

            {/* Headline */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="text-center"
            >
              <h3 className="mb-1 text-xl font-black uppercase tracking-tight text-white sm:text-2xl">
                You&apos;re in luck!
              </h3>
              <p className="mb-5 text-sm text-stone-400">
                Professional installation is available in <span className="font-semibold text-white">{zip}</span>.
                Your local pro has openings this month.
              </p>
            </motion.div>

            {/* Value prop stack */}
            <div className="mb-6 space-y-3">
              {VALUE_PROPS.map((prop, i) => (
                <motion.div
                  key={prop.text}
                  initial={{ x: -16, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.25 + i * 0.1, duration: 0.35 }}
                  className="flex items-start gap-3 rounded-lg border border-stone-800/60 bg-gray-950/40 px-4 py-3"
                >
                  <prop.icon className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
                  <p className="text-sm text-stone-300">{prop.text}</p>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
            >
              <motion.button
                onClick={goToDesign}
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ delay: 1, duration: 0.6, repeat: 2 }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-4 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/30 transition-all hover:bg-yellow-300 hover:-translate-y-0.5"
              >
                See What Yours Would Cost
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ArrowRight className="h-4 w-4" />
                </motion.span>
              </motion.button>
              <p className="mt-3 text-center text-[11px] text-stone-500">
                30 seconds. No account. No commitment.
              </p>
            </motion.div>

            {/* Installer footnote */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="mt-4 text-center text-[10px] text-stone-600"
            >
              Your certified pro: {installer.installer_name}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
