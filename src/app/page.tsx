import Image from "next/image";
import type { Metadata } from "next";
import {
  Shield, Flag, Weight, ChevronRight, Truck,
  Star, Wrench, ArrowRight,
} from "lucide-react";
import InlineConfigurator from "@/components/landing/InlineConfigurator";

export const metadata: Metadata = {
  title: "Storage Network | Professional Tote Storage Systems — Design, Build & Install",
  description:
    "Design your custom 27-gallon tote storage system in 30 seconds. Heavy-duty shelving for garages, basements & sheds. Free 3D configurator with instant pricing. Professional installation by certified local pros. Lifetime warranty.",
  keywords: [
    "tote storage system", "garage storage", "tote rack", "tote shelving",
    "garage organization", "HDX tote storage", "27 gallon tote rack",
    "custom tote organizer", "garage shelving installation",
    "professional garage storage", "tote storage near me",
  ],
  openGraph: {
    title: "Storage Network | Professional Tote Storage Systems",
    description: "Design your custom tote storage system in 30 seconds. Free 3D configurator. Professional installation by certified local pros.",
    type: "website",
  },
  alternates: {
    canonical: "https://storage-network.app",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Landing Page — Guided Inline Configurator
//
// Hero section now contains the InlineConfigurator which walks customers
// through ZIP → installer reveal → service selection → build config
// entirely inline (no modals, no floating chatbot).
// ═══════════════════════════════════════════════════════════════════════════

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* ══════════════════════════════════════════════════════════════════
          HERO SECTION — Logo + Inline Configurator
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-20">
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
          <div className="mb-6 inline-block">
            <Image
              src="/landing_page_logo.png"
              alt="Storage Network"
              width={256}
              height={256}
              priority
              className="h-32 w-auto object-contain sm:h-40 md:h-48"
            />
          </div>

          <h1 className="mb-3 text-3xl font-black uppercase leading-[1.1] tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl">
            Professional
            <br />
            Grade{" "}
            <span className="text-yellow-400">Storage.</span>
          </h1>

          <p className="mx-auto mb-8 max-w-lg text-base font-medium text-stone-400 sm:text-lg">
            Heavy-duty tote shelving designed, built &amp; installed by
            certified local pros.
          </p>

          {/* ── Inline Configurator ─────────────────────────────── */}
          <InlineConfigurator />
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

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
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
            <TrustBadge
              icon={<Star className="h-7 w-7" />}
              title="Verified Reviews"
              desc="Real reviews from real customers, verified by the platform. Read before you book."
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          INSTALLER CTA BANNER — Join the Network
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-t border-stone-800 bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900 px-4 py-20">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 50%, rgba(250,204,21,0.06) 0%, transparent 60%)",
          }}
        />

        <div className="relative z-10 mx-auto max-w-3xl">
          <div className="flex flex-col items-center gap-8 md:flex-row md:gap-12">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-yellow-400/10 ring-1 ring-yellow-400/20">
              <Wrench className="h-10 w-10 text-yellow-400" />
            </div>

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

            <div className="shrink-0">
              <a
                href="/join"
                className="group inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-8 py-4 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:-translate-y-0.5"
              >
                Join the Network
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <p className="mt-2 text-center text-[10px] text-stone-600">
                Pro trial included — no credit card required
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
