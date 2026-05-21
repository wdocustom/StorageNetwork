import Image from "next/image";
import type { Metadata } from "next";
import {
  Shield, Flag, Weight, Truck, Star,
} from "lucide-react";
import InlineConfigurator from "@/components/landing/InlineConfigurator";
import { AnimatedBadge } from "@/components/landing/AnimatedTrustBadges";

export const metadata: Metadata = {
  title: "Storage Network | Tote Storage Systems — Custom Design, Build & Install",
  description:
    "Design your custom tote storage system in 30 seconds. Heavy-duty tote racks, tote shelving, and built-in storage for garages, basements, sheds, and pantries. Free 3D configurator with instant pricing. Professional storage installation by certified local pros. Lifetime warranty.",
  keywords: [
    "tote storage system", "tote storage rack", "tote racks", "tote shelving",
    "tote organizers", "garage storage", "garage organization", "garage shelving installation",
    "27 gallon tote rack", "HDX tote storage", "custom storage", "custom storage system",
    "storage systems", "storage design", "storage installation", "shelf installation",
    "shelf system", "built in storage", "build storage", "tool storage system",
    "professional garage storage", "tote storage near me",
  ],
  openGraph: {
    title: "Storage Network | Tote Storage Systems — Custom Design, Build & Install",
    description: "Design your custom tote storage system in 30 seconds. Free 3D configurator. Professional storage installation by certified local pros.",
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
            src="/hero-rack.webp"
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
                Custom tote storage — designed in 3D, built &amp; installed
                by your local pro.
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
          <p className="mb-2 text-center text-sm font-semibold text-yellow-400">
            2,400+ systems designed and counting
          </p>
          <p className="mb-10 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-stone-600">
            Why Homeowners Trust Us
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            <AnimatedBadge index={0}>
              <TrustBadge
                icon={<Shield className="h-7 w-7" />}
                title="Lifetime Warranty"
                desc="Built to last. Every shelf system is backed by our lifetime structural warranty."
              />
            </AnimatedBadge>
            <AnimatedBadge index={1}>
              <TrustBadge
                icon={<Flag className="h-7 w-7" />}
                title="Made in USA"
                desc="Designed and assembled in America using domestically sourced lumber."
              />
            </AnimatedBadge>
            <AnimatedBadge index={2}>
              <TrustBadge
                icon={<Weight className="h-7 w-7" />}
                title="2,000 lb Capacity"
                desc="Heavy-duty construction rated for up to 2,000 lbs per unit."
              />
            </AnimatedBadge>
            <AnimatedBadge index={3}>
              <TrustBadge
                icon={<Truck className="h-7 w-7" />}
                title="Pro Installation"
                desc="Certified local installers handle everything. You don't lift a finger."
              />
            </AnimatedBadge>
            <AnimatedBadge index={4}>
              <TrustBadge
                icon={<Star className="h-7 w-7" />}
                title="Verified Reviews"
                desc="Real reviews from real customers, verified by the platform. Read before you book."
              />
            </AnimatedBadge>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          WHAT WE BUILD — SEO content block
          Plain, scannable copy that gives search engines + first-time
          visitors a clear summary of the product surface. The phrasing
          intentionally folds in the long-tail terms our Google Ads
          campaigns validate (tote storage systems, custom storage
          installation, tote racks, shelf system, etc.) so the page
          ranks for what people actually search.
      ══════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-stone-800 bg-gray-950 px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <p className="mb-10 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-stone-600">
            What We Build
          </p>

          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <h2 className="mb-3 text-lg font-extrabold text-white">
                Custom Tote Storage Systems
              </h2>
              <p className="text-sm leading-relaxed text-stone-400">
                Heavy-duty tote storage racks built around the 27-gallon
                HDX and Greenmade totes you can buy at any home center. A
                4&times;5 unit fits 20 totes against a single wall &mdash;
                bigger walls run 5&times;6 or 6&times;6. Same lumber, same
                hardware, sized to your room.
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-lg font-extrabold text-white">
                Built-In Storage & Shelf Systems
              </h2>
              <p className="text-sm leading-relaxed text-stone-400">
                Tote shelving and built-in storage for garages, basements,
                pantries, mudrooms, and sheds. Anchored into wall studs and
                rated to 2,000 lb per unit, our shelf system replaces
                wire racks and plastic-bin chaos with one clean
                wall-to-ceiling install.
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-lg font-extrabold text-white">
                Tool Storage & Workshop Organizers
              </h2>
              <p className="text-sm leading-relaxed text-stone-400">
                The same frame doubles as a tool storage system &mdash;
                drop in mini-tote shelves for fasteners and parts, or
                full-depth totes for power tools and consumables. Every
                slot is labeled, every bin lifts straight out, every
                workshop turns over in an afternoon.
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-lg font-extrabold text-white">
                Professional Storage Design & Installation
              </h2>
              <p className="text-sm leading-relaxed text-stone-400">
                Use our{" "}
                <a href="/design" className="font-semibold text-yellow-400 hover:underline">
                  free 3D storage designer
                </a>{" "}
                to lay out your wall in 30 seconds, then route the build
                to a certified pro in your area through the{" "}
                <a href="/installer-network" className="font-semibold text-yellow-400 hover:underline">
                  installer network
                </a>
                . Custom storage installation, shelf installation, and
                full system builds &mdash; you don&apos;t touch a tool.
              </p>
            </div>
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
              href="/invite"
              className="text-[11px] font-semibold text-stone-600 transition-colors hover:text-yellow-400"
            >
              Become a Builder
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
