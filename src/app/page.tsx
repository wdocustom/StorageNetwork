"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gatekeeperCheck, joinWaitlist } from "@/app/actions/gatekeeper";
import {
  MapPin,
  Loader2,
  Shield,
  Flag,
  Weight,
  ChevronRight,
  Truck,
  X,
  CheckCircle2,
  Mail,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Landing Page — Smart Gatekeeper with Waitlist Modal
// ═══════════════════════════════════════════════════════════════════════════

export default function LandingPage() {
  const router = useRouter();
  const [zip, setZip] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  // Waitlist modal state
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [waitlistZip, setWaitlistZip] = useState("");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistDone, setWaitlistDone] = useState(false);
  const [waitlistError, setWaitlistError] = useState("");

  async function handleSearch() {
    const trimmed = zip.trim();
    if (trimmed.length < 5) {
      setError("Enter a valid 5-digit ZIP code.");
      return;
    }

    setError("");
    setSearching(true);

    try {
      const result = await gatekeeperCheck(trimmed);

      if (result.available && result.installer_id) {
        // Match found → configurator with installer context
        router.push(
          `/design?zip=${trimmed}&installer=${result.installer_id}`
        );
      } else {
        // No match → show waitlist modal
        setWaitlistZip(trimmed);
        setWaitlistDone(false);
        setWaitlistEmail("");
        setWaitlistError("");
        setShowWaitlist(true);
      }
    } catch {
      // On error, show waitlist modal as fallback
      setWaitlistZip(trimmed);
      setWaitlistDone(false);
      setWaitlistEmail("");
      setWaitlistError("");
      setShowWaitlist(true);
    } finally {
      setSearching(false);
    }
  }

  async function handleWaitlistSubmit() {
    if (!waitlistEmail.trim()) {
      setWaitlistError("Email is required.");
      return;
    }

    setWaitlistSubmitting(true);
    setWaitlistError("");

    try {
      const res = await joinWaitlist(waitlistEmail, waitlistZip);
      if (res.success) {
        setWaitlistDone(true);
      } else {
        setWaitlistError(res.error || "Something went wrong.");
      }
    } catch {
      setWaitlistError("Failed to join waitlist. Please try again.");
    } finally {
      setWaitlistSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  function handleSkipToDesign() {
    router.push(`/design?zip=${waitlistZip}&mode=shipping`);
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* ══════════════════════════════════════════════════════════════════
          HERO SECTION — Full-screen dark industrial
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
        {/* Radial gradient background */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(250,204,21,0.08) 0%, transparent 60%), radial-gradient(ellipse at 50% 100%, rgba(250,204,21,0.04) 0%, transparent 50%)",
          }}
        />

        {/* Grid texture overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          {/* Logo mark */}
          <div className="mb-8 inline-block">
            <img
              src="/logo.png"
              alt="The Shelf Dude"
              className="h-40 w-40 sm:h-52 sm:w-52 md:h-64 md:w-64"
            />
          </div>

          {/* Headline */}
          <h1 className="mb-4 text-4xl font-black uppercase leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Professional
            <br />
            Grade{" "}
            <span className="text-yellow-400">Storage.</span>
          </h1>

          {/* Sub-headline */}
          <p className="mx-auto mb-10 max-w-lg text-lg font-medium text-stone-400 sm:text-xl">
            Heavy-duty tote shelving designed, built &amp; installed by
            certified local pros.
          </p>

          {/* ── Search Box (The Centerpiece) ───────────────────────── */}
          <div className="mx-auto max-w-md">
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
                onKeyDown={handleKeyDown}
                placeholder="ZIP Code"
                className="w-full bg-transparent px-3 py-4 text-lg font-medium text-white placeholder-stone-500 outline-none"
              />
              <button
                onClick={handleSearch}
                disabled={searching || zip.length < 5}
                className="m-1.5 flex shrink-0 items-center gap-2 rounded-lg bg-yellow-400 px-6 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Find My Installer
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>

            {error && (
              <p className="mt-3 text-sm font-medium text-red-400">{error}</p>
            )}

            <p className="mt-4 text-xs text-stone-600">
              We&apos;ll match you with a certified installer in your area
              &mdash; or ship directly to you.
            </p>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="flex flex-col items-center gap-2 text-stone-600">
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Learn More
            </span>
            <div className="h-8 w-[1px] bg-gradient-to-b from-stone-600 to-transparent" />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SOCIAL PROOF — Trust Badges
      ══════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-stone-800 bg-gray-950 px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <p className="mb-10 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-stone-600">
            Why Homeowners Trust Us
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <TrustBadge
              icon={<Shield className="h-7 w-7" />}
              title="Lifetime Warranty"
              desc="Built to last. Every shelf system is backed by our lifetime structural warranty."
            />
            <TrustBadge
              icon={<Flag className="h-7 w-7" />}
              title="Made in USA"
              desc="Designed and assembled in America using domestically sourced lumber."
            />
            <TrustBadge
              icon={<Weight className="h-7 w-7" />}
              title="2,000 lb Capacity"
              desc="Heavy-duty construction rated for up to 2,000 lbs per unit."
            />
            <TrustBadge
              icon={<Truck className="h-7 w-7" />}
              title="Pro Installation"
              desc="Certified local installers handle everything. You don't lift a finger."
            />
          </div>
        </div>
      </section>

      {/* ── CTA repeat ────────────────────────────────────────────────── */}
      <section className="border-t border-stone-800 bg-gray-900 px-4 py-16">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="mb-3 text-2xl font-black uppercase text-white sm:text-3xl">
            Ready to get started?
          </h2>
          <p className="mb-6 text-sm text-stone-400">
            Design your custom storage unit in minutes. No commitment required.
          </p>
          <a
            href="/design"
            className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-8 py-4 text-sm font-bold uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:-translate-y-0.5"
          >
            Open Build Configurator
            <ChevronRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-stone-800 bg-gray-950 px-4 py-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="The Shelf Dude"
              className="h-10 w-10"
            />
          </div>
          <p className="text-xs text-stone-700">
            &copy; {new Date().getFullYear()} WDO Custom. All rights reserved.
          </p>
          <a
            href="/login"
            className="mt-2 inline-block text-[11px] font-semibold text-stone-600 transition-colors hover:text-yellow-400"
          >
            Partner Login
          </a>
        </div>
      </footer>

      {/* ══════════════════════════════════════════════════════════════════
          WAITLIST MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {showWaitlist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-stone-700 bg-gray-900 p-6 shadow-2xl">
            {/* Close button */}
            <button
              onClick={() => setShowWaitlist(false)}
              className="absolute right-4 top-4 text-stone-500 transition-colors hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {!waitlistDone ? (
              <>
                {/* Icon */}
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-400/10">
                  <MapPin className="h-8 w-8 text-yellow-400" />
                </div>

                <h3 className="mb-2 text-center text-xl font-black uppercase text-white">
                  We Haven&apos;t Reached{" "}
                  <span className="text-yellow-400">{waitlistZip}</span> Yet
                </h3>
                <p className="mb-6 text-center text-sm text-stone-400">
                  Join our waitlist and we&apos;ll notify you as soon as a
                  certified installer is available in your area.
                </p>

                {/* Email input */}
                <div className="flex overflow-hidden rounded-lg border border-stone-600 bg-gray-800 focus-within:border-yellow-400">
                  <div className="flex items-center pl-3 text-stone-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    value={waitlistEmail}
                    onChange={(e) => {
                      setWaitlistEmail(e.target.value);
                      setWaitlistError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleWaitlistSubmit();
                    }}
                    placeholder="Enter your email"
                    className="w-full bg-transparent px-3 py-3 text-sm text-white placeholder-stone-500 outline-none"
                  />
                </div>

                {waitlistError && (
                  <p className="mt-2 text-xs font-medium text-red-400">
                    {waitlistError}
                  </p>
                )}

                <button
                  onClick={handleWaitlistSubmit}
                  disabled={waitlistSubmitting}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
                >
                  {waitlistSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Notify Me"
                  )}
                </button>

                {/* Skip to design option */}
                <div className="mt-4 border-t border-stone-800 pt-4 text-center">
                  <button
                    onClick={handleSkipToDesign}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-400 transition-colors hover:text-yellow-300"
                  >
                    <Truck className="h-3 w-3" />
                    Continue with Shipping
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </>
            ) : (
              /* Success state */
              <div className="py-4 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/10">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <h3 className="mb-2 text-xl font-black uppercase text-white">
                  You&apos;re on the List!
                </h3>
                <p className="mb-6 text-sm text-stone-400">
                  We&apos;ll email you at{" "}
                  <span className="font-semibold text-white">
                    {waitlistEmail}
                  </span>{" "}
                  when an installer is available near{" "}
                  <span className="font-semibold text-yellow-400">
                    {waitlistZip}
                  </span>
                  .
                </p>
                <button
                  onClick={handleSkipToDesign}
                  className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-6 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300"
                >
                  <Truck className="h-4 w-4" />
                  Design My Unit Now
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Trust Badge Component
// ═══════════════════════════════════════════════════════════════════════════
function TrustBadge({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-stone-800 bg-gray-900 p-6 text-center transition-colors hover:border-stone-700">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400/10 text-yellow-400">
        {icon}
      </div>
      <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-white">
        {title}
      </h3>
      <p className="text-xs leading-relaxed text-stone-500">{desc}</p>
    </div>
  );
}
