import Image from "next/image";
import type { Metadata } from "next";
import {
  Shield, Flag, Weight, Truck, Star,
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

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* ══════════════════════════════════════════════════════════════════
          HERO SECTION — Logo + Hero Rack Image + ZIP Entry
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

        {/* Hero rack image — positioned left on desktop, centered behind on mobile */}
        <div className="pointer-events-none absolute inset-0">
          <Image
            src="/images/hero-rack.png"
            alt=""
            fill
            priority
            className="object-contain object-center opacity-30 md:object-left md:opacity-40 lg:opacity-50"
            sizes="100vw"
          />
          {/* Fade overlay to keep text readable */}
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950/30 via-gray-950/60 to-gray-950/90 md:from-transparent md:via-gray-950/40 md:to-gray-950/95" />
        </div>

        {/* Content — shifted right on desktop to complement left-positioned rack */}
        <div className="relative z-10 mx-auto w-full max-w-5xl">
          <div className="md:ml-auto md:max-w-xl lg:max-w-2xl">
            <div className="text-center">
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

              {/* ── ZIP Entry → Installer → 3D Configurator ──────── */}
              <InlineConfigurator />
            </div>
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
