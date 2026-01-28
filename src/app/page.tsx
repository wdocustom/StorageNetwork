"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkAvailability } from "@/app/actions/customer";
import {
  MapPin,
  Loader2,
  Shield,
  Flag,
  Weight,
  ChevronRight,
  Truck,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Landing Page — High-Converting "Shelf Dude" Hero
// ═══════════════════════════════════════════════════════════════════════════

export default function LandingPage() {
  const router = useRouter();
  const [zip, setZip] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

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

      if (result.available) {
        // Installer found → send to configurator
        router.push(`/design?zip=${trimmed}`);
      } else {
        // No local installer → configurator in shipping mode
        router.push(`/design?zip=${trimmed}&mode=shipping`);
      }
    } catch {
      // On error, still let them design — just go to configurator
      router.push(`/design?zip=${trimmed}&mode=shipping`);
    } finally {
      setSearching(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
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
              className="h-28 w-28 sm:h-36 sm:w-36"
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
                placeholder="Enter your ZIP code"
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
              className="h-8 w-8"
            />
          </div>
          <p className="text-xs text-stone-700">
            &copy; {new Date().getFullYear()} WDO Custom. All rights reserved.
          </p>
        </div>
      </footer>
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
