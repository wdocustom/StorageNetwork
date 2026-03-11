import type { Metadata } from "next";
import Link from "next/link";
import {
  MapPin,
  Shield,
  ArrowRight,
  Wrench,
  Truck,
  Star,
  CheckCircle2,
} from "lucide-react";
import { getMapInstallers } from "@/app/actions/installer-map";
import InstallerNetworkMap from "@/components/map/InstallerNetworkMap";

// ═══════════════════════════════════════════════════════════════════════════
// Installer Network — Public map page showing coverage areas
//
// ISR with 5 min revalidation. Fetches all active installers server-side,
// geocodes from ZIP, renders interactive SVG map client-side.
// ═══════════════════════════════════════════════════════════════════════════

export const revalidate = 300; // 5 min ISR

export const metadata: Metadata = {
  title: "Our Installer Network | Storage Network",
  description:
    "Find certified tote storage installers near you. Our growing network of professional installers covers communities across the United States.",
  openGraph: {
    title: "Our Installer Network | Storage Network",
    description:
      "Find certified tote storage installers near you. Professional installation in your area.",
  },
};

export default async function InstallerNetworkPage() {
  const installers = await getMapInstallers();

  const proCount = installers.filter((i) => i.isPro).length;
  const statesCovered = new Set(installers.map((i) => i.state).filter(Boolean)).size;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-bold text-white transition-colors hover:text-yellow-400"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Header_avatar_logo.png"
              alt="Storage Network"
              className="h-7 w-7 rounded-full"
            />
            Storage Network
          </Link>
          <Link
            href="/design"
            className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-400 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-zinc-900 transition-colors hover:bg-yellow-300"
          >
            Design Yours
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* ── Hero Section ───────────────────────────────────────────── */}
        <div className="relative mb-8 text-center sm:mb-12">
          {/* Decorative glow */}
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
            <div className="h-32 w-64 rounded-full bg-yellow-400/8 blur-3xl" />
          </div>

          <div className="relative">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/5 px-3 py-1">
              <MapPin className="h-3 w-3 text-yellow-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">
                Nationwide Coverage
              </span>
            </div>

            <h1 className="mb-3 text-2xl font-black text-white sm:text-4xl">
              Our Installer Network
            </h1>
            <p className="mx-auto max-w-lg text-sm text-stone-400 sm:text-base">
              Certified professionals across the country, ready to design, build,
              and install custom tote storage systems in your garage, basement, or
              shed.
            </p>

            {/* Stats */}
            <div className="mt-6 flex justify-center gap-6 sm:gap-10">
              <Stat value={installers.length} label="Installers" />
              <Stat value={statesCovered} label="States" />
              <Stat value={proCount} label="Pro Tier" />
            </div>
          </div>
        </div>

        {/* ── Map Section ────────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
          {/* Top accent bar */}
          <div className="h-1 bg-gradient-to-r from-yellow-400/0 via-yellow-400 to-yellow-400/0" />

          <div className="p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-yellow-400" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400">
                Coverage Map
              </h2>
              <span className="ml-auto text-[10px] text-stone-600">
                Hover or tap pins for details
              </span>
            </div>

            <InstallerNetworkMap installers={installers} />
          </div>
        </section>

        {/* ── Value Props ────────────────────────────────────────────── */}
        <section className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-3 sm:gap-6">
          <ValueCard
            icon={<Shield className="h-5 w-5 text-yellow-400" />}
            title="Certified Pros"
            description="Every installer is vetted, trained, and backed by our platform. Pro tier members get priority leads and advanced tools."
          />
          <ValueCard
            icon={<Wrench className="h-5 w-5 text-yellow-400" />}
            title="Full-Service Install"
            description="From 3D design to cut plans to final installation — our network handles everything so you don't have to."
          />
          <ValueCard
            icon={<Truck className="h-5 w-5 text-yellow-400" />}
            title="Local Service"
            description="Each installer covers their local area. Find the pro nearest you and get a quote tailored to your space."
          />
        </section>

        {/* ── CTA Section ────────────────────────────────────────────── */}
        <section className="mt-10 rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/5 to-transparent p-6 text-center sm:mt-14 sm:p-10">
          <Star className="mx-auto mb-3 h-6 w-6 text-yellow-400" />
          <h2 className="mb-2 text-lg font-black text-white sm:text-xl">
            Ready to Get Started?
          </h2>
          <p className="mx-auto mb-5 max-w-md text-sm text-stone-400">
            Design your custom tote storage system in 30 seconds with our free
            3D configurator. A local installer will handle the rest.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/design"
              className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-6 py-3 text-sm font-black uppercase tracking-wider text-zinc-900 transition-colors hover:bg-yellow-300"
            >
              Launch Configurator
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-6 py-3 text-sm font-bold text-stone-300 transition-colors hover:bg-slate-700 hover:text-white"
            >
              Learn More
            </Link>
          </div>
        </section>

        {/* ── Become an Installer CTA ────────────────────────────────── */}
        <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:mt-14 sm:p-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 ring-1 ring-yellow-400/20">
              <CheckCircle2 className="h-6 w-6 text-yellow-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white sm:text-lg">
                Become an Installer
              </h3>
              <p className="mt-1 text-sm text-stone-400">
                Join our growing network. Get leads, tools, and support to build
                a thriving storage installation business.
              </p>
            </div>
            <Link
              href="/join"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-xs font-bold text-yellow-400 transition-colors hover:bg-yellow-400/20"
            >
              Apply Now
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="mt-10 border-t border-slate-800 py-6 text-center">
        <p className="text-[11px] text-stone-600">
          &copy; {new Date().getFullYear()} Storage Network. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-black text-yellow-400 sm:text-3xl">
        {value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
        {label}
      </div>
    </div>
  );
}

function ValueCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 ring-1 ring-slate-700">
        {icon}
      </div>
      <h3 className="mb-1.5 text-sm font-bold text-white">{title}</h3>
      <p className="text-xs leading-relaxed text-stone-400">{description}</p>
    </div>
  );
}
