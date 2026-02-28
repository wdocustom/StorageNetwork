"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { checkAvailability, type AvailabilityResult } from "@/app/actions/customer";
import { joinWaitlist } from "@/app/actions/gatekeeper";
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
  User,
  Star,
  Wrench,
  ArrowRight,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Landing Page — Smart Gatekeeper with Pro Found / Waitlist Modals
// ═══════════════════════════════════════════════════════════════════════════

export default function LandingPage() {
  const router = useRouter();
  const [zip, setZip] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  // Pro Found modal state
  const [showProFound, setShowProFound] = useState(false);
  const [foundInstaller, setFoundInstaller] = useState<AvailabilityResult | null>(null);

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
      const result = await checkAvailability(trimmed);

      if (result.available && result.installer_id) {
        // Pro found → show sales modal
        setFoundInstaller(result);
        setShowProFound(true);
      } else {
        // No match → show waitlist modal
        setWaitlistZip(trimmed);
        setWaitlistDone(false);
        setWaitlistEmail("");
        setWaitlistError("");
        setShowWaitlist(true);
      }
    } catch {
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

  function handleStartDesigning() {
    if (!foundInstaller?.installer_id) return;
    // Add from=network to indicate this came from platform ZIP lookup (not installer's direct link)
    router.push(`/design?installer=${foundInstaller.installer_id}&from=network`);
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* ══════════════════════════════════════════════════════════════════
          HERO SECTION
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
          <div className="mb-8 inline-block">
            <Image
              src="/landing_page_logo.png"
              alt="Storage Network"
              width={256}
              height={256}
              priority
              className="h-40 w-auto object-contain sm:h-52 md:h-64"
            />
          </div>

          <h1 className="mb-4 text-4xl font-black uppercase leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Professional
            <br />
            Grade{" "}
            <span className="text-yellow-400">Storage.</span>
          </h1>

          <p className="mx-auto mb-10 max-w-lg text-lg font-medium text-stone-400 sm:text-xl">
            Heavy-duty tote shelving designed, built &amp; installed by
            certified local pros.
          </p>

          {/* ── Search Box ───────────────────────────────────────── */}
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
                className="m-1.5 flex shrink-0 items-center gap-2 rounded-lg bg-yellow-400 px-6 py-3 text-sm font-bold uppercase tracking-wider text-black transition-all hover:bg-yellow-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
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
              We&apos;ll match you with a certified installer in your area.
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

      {/* ══════════════════════════════════════════════════════════════════
          INSTALLER CTA BANNER — Join the Network
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-t border-stone-800 bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900 px-4 py-20">
        {/* Subtle accent glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 50%, rgba(250,204,21,0.06) 0%, transparent 60%)",
          }}
        />

        <div className="relative z-10 mx-auto max-w-3xl">
          <div className="flex flex-col items-center gap-8 md:flex-row md:gap-12">
            {/* Icon */}
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-yellow-400/10 ring-1 ring-yellow-400/20">
              <Wrench className="h-10 w-10 text-yellow-400" />
            </div>

            {/* Copy */}
            <div className="flex-1 text-center md:text-left">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-yellow-400">
                Installer Network
              </p>
              <h2 className="mb-3 text-2xl font-black uppercase leading-tight text-white sm:text-3xl">
                Build Storage.{" "}
                <span className="text-yellow-400">Get Paid.</span>
              </h2>
              <p className="max-w-md text-sm leading-relaxed text-stone-400">
                Pre-sold jobs, cut lists, and instant payouts. No selling. No
                bidding. Just build.
              </p>
            </div>

            {/* CTA */}
            <div className="shrink-0">
              <a
                href="/join"
                className="group inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-8 py-4 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:-translate-y-0.5"
              >
                Join the Network
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <p className="mt-2 text-center text-[10px] text-stone-600">
                Pro trial included
              </p>
              <a
                href="/demo"
                className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-yellow-400/70 transition-colors hover:text-yellow-400"
              >
                or book a free demo call first
                <ArrowRight className="h-3 w-3" />
              </a>
            </div>
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
            <Image
              src="/Header_avatar_logo.png"
              alt="Storage Network"
              width={40}
              height={40}
              className="h-10 w-auto object-contain"
            />
          </div>
          <p className="text-xs text-stone-700">
            &copy; {new Date().getFullYear()} Storage-Network.app. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="/demo"
              className="text-[11px] font-semibold text-stone-600 transition-colors hover:text-yellow-400"
            >
              Book a Demo
            </a>
            <a
              href="/login"
              className="text-[11px] font-semibold text-stone-600 transition-colors hover:text-yellow-400"
            >
              Partner Login
            </a>
          </div>
        </div>
      </footer>

      {/* ══════════════════════════════════════════════════════════════════
          PRO FOUND MODAL — Sales conversion
      ══════════════════════════════════════════════════════════════════ */}
      {showProFound && foundInstaller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-stone-700 bg-gray-900 shadow-2xl">
            {/* Close button */}
            <button
              onClick={() => setShowProFound(false)}
              className="absolute right-4 top-4 z-10 text-stone-500 transition-colors hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Gold accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400" />

            <div className="px-6 pb-6 pt-8 text-center">
              {/* Avatar */}
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-yellow-400 bg-gradient-to-br from-yellow-400 to-yellow-500 shadow-lg shadow-yellow-400/30">
                {foundInstaller.installer_avatar_url ? (
                  <Image
                    src={foundInstaller.installer_avatar_url}
                    alt={foundInstaller.installer_name || "Installer"}
                    width={80}
                    height={80}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <Image
                    src="/Header_avatar_logo.png"
                    alt="Storage Network"
                    width={80}
                    height={80}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              {/* Verified badge */}
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Verified Pro Found
              </div>

              {/* Installer name */}
              <h3 className="mb-1 text-2xl font-black uppercase text-white">
                {foundInstaller.installer_name}
              </h3>

              {/* Stars */}
              <div className="mb-4 flex items-center justify-center gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-yellow-400 text-yellow-400"
                  />
                ))}
                <span className="ml-2 text-xs font-semibold text-stone-400">
                  Certified Installer
                </span>
              </div>

              <p className="mb-6 text-sm text-stone-400">
                A certified pro is ready to design, build &amp; install your
                custom storage system.
              </p>

              {/* CTA Button */}
              <button
                onClick={handleStartDesigning}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-4 text-base font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/30 transition-all hover:bg-yellow-300 hover:-translate-y-0.5"
              >
                Start Designing
                <ChevronRight className="h-5 w-5" />
              </button>

              <p className="mt-3 text-[11px] text-stone-600">
                No commitment &mdash; design your unit and see pricing instantly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          WAITLIST MODAL — No Pro in area
      ══════════════════════════════════════════════════════════════════ */}
      {showWaitlist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-stone-700 bg-gray-900 p-6 shadow-2xl">
            <button
              onClick={() => setShowWaitlist(false)}
              className="absolute right-4 top-4 text-stone-500 transition-colors hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {!waitlistDone ? (
              <>
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
              </>
            ) : (
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
                  onClick={() => setShowWaitlist(false)}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
                >
                  Done
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
