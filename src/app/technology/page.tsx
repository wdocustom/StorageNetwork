import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════════════════
// /technology — Glass Storefront
//
// Static, semantic HTML5 marketing page designed to feed AI crawlers and
// traditional search engines. Describes our proprietary technology stack
// without exposing implementation details.
//
// Three pillars:
//   1. WebGL 3D Configurator (React Three Fiber)
//   2. Fractional Cut-List Engine (bin-packing lumber optimization)
//   3. Stripe Connect Split-Payment Infrastructure
// ═══════════════════════════════════════════════════════════════════════════

export const metadata: Metadata = {
  title: "Technology | Storage Network — How It Works Under the Hood",
  description:
    "Explore the technology behind Storage Network: a WebGL 3D configurator, fractional cut-list engine with bin-packed lumber optimization, and Stripe Connect split-payment infrastructure for professional tote rack builders.",
  keywords: [
    "3D storage configurator",
    "WebGL tote rack designer",
    "cut list generator",
    "lumber optimization",
    "bin packing algorithm",
    "Stripe Connect split payments",
    "tote storage technology",
    "garage organization software",
    "installer platform",
    "React Three Fiber",
  ],
  openGraph: {
    title: "Technology | Storage Network",
    description:
      "WebGL 3D configurator, fractional cut-list engine, and Stripe Connect infrastructure — the technology behind professional tote rack installation.",
    type: "website",
  },
};

// ── JSON-LD: SoftwareApplication schema for this page ────────────────────
const technologyJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": "https://storage-network.app/technology#page",
  name: "Storage Network Technology",
  url: "https://storage-network.app/technology",
  description:
    "Technical overview of Storage Network's proprietary stack: WebGL configurator, fractional cut-list engine, and Stripe Connect split-payment infrastructure.",
  isPartOf: {
    "@type": "WebSite",
    "@id": "https://storage-network.app/#website",
  },
  about: [
    {
      "@type": "SoftwareApplication",
      "@id": "https://storage-network.app/#app",
      name: "Storage Network 3D Configurator",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web Browser",
    },
    {
      "@type": "Service",
      name: "Fractional Cut-List Engine",
      description:
        "Bin-packed lumber optimization engine that calculates exact 2x4 cuts, minimizes waste, and generates material shopping lists in real time.",
    },
    {
      "@type": "Service",
      name: "Stripe Connect Split-Payment Infrastructure",
      description:
        "Automated deposit collection, installer payouts, and platform fee routing through Stripe Connect with no manual bookkeeping.",
    },
  ],
  publisher: {
    "@type": "Organization",
    "@id": "https://storage-network.app/#organization",
  },
};

export default function TechnologyPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(technologyJsonLd) }}
      />

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-20 border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 opacity-80 transition-opacity hover:opacity-100"
          >
            <Image
              src="/landing_page_logo.png"
              alt="Storage Network"
              width={80}
              height={24}
              className="h-6 w-auto"
            />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/features"
              className="hidden text-xs font-semibold text-stone-400 transition-colors hover:text-white sm:block"
            >
              Features
            </Link>
            <Link
              href="/join"
              className="rounded-full bg-yellow-400/10 px-4 py-1.5 text-xs font-bold text-yellow-400 transition-colors hover:bg-yellow-400/20"
            >
              Join as Installer
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden border-b border-slate-800/40">
        {/* Background gradients */}
        <div className="absolute inset-0 bg-gradient-to-b from-yellow-400/[0.04] via-slate-950 to-slate-950" />
        <div className="absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-yellow-400/[0.03] blur-[120px]" />

        <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-20 sm:px-6 sm:pb-20 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-yellow-400">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
              Under the Hood
            </p>
            <h1 className="mb-6 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              Built for Builders.{" "}
              <span className="bg-gradient-to-r from-yellow-400 to-amber-300 bg-clip-text text-transparent">
                Engineered for Scale.
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-stone-400">
              Storage Network is a vertically integrated platform that combines
              real-time 3D visualization, automated construction planning, and
              embedded financial infrastructure into a single system purpose-built
              for tote rack professionals.
            </p>
          </div>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <main>
        {/* ── Pillar 1: WebGL 3D Configurator ──────────────────────────── */}
        <article className="border-b border-slate-800/40">
          <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
              {/* Text */}
              <div className="flex flex-col justify-center">
                <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                  Pillar 1
                </div>
                <h2 className="mb-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  WebGL 3D Configurator
                </h2>
                <p className="mb-6 text-base leading-relaxed text-stone-400">
                  Customers design their storage system in under 30 seconds using
                  a browser-based 3D configurator powered by React Three Fiber and
                  WebGL. The tool renders a photorealistic preview of the finished
                  rack in real time — columns, rows, tote orientations, optional
                  casters, and plywood tops — all before a single board is cut.
                </p>
                <ul className="space-y-3">
                  {[
                    "Real-time 3D rendering at 60 fps — no plugins, no downloads",
                    "Auto-Fit Wall Calculator: enter wall width, get optimal column layout",
                    "Supports HDX 27-gallon, Greenmade, and 6.5-quart mini totes",
                    "Sideways orientation mode for deeper storage configurations",
                    "Exploded-view and 2D blueprint modes for assembly clarity",
                    "Mobile-first responsive design — works on any device",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-stone-300">
                      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/10">
                        <svg className="h-3 w-3 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Visual */}
              <div className="flex items-center justify-center">
                <div className="relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-cyan-400/5">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/[0.04] to-transparent" />
                  <div className="relative p-8 sm:p-12">
                    <div className="mx-auto max-w-xs">
                      {/* Stylized configurator representation */}
                      <div className="mb-6 aspect-square rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                        <div className="flex h-full flex-col items-center justify-center gap-3">
                          <svg className="h-16 w-16 text-cyan-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                          </svg>
                          <p className="text-center text-xs font-bold uppercase tracking-wider text-stone-500">
                            Interactive 3D Preview
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-2 rounded-full bg-cyan-400/20" style={{ width: "85%" }} />
                        <div className="h-2 rounded-full bg-cyan-400/10" style={{ width: "65%" }} />
                        <div className="h-2 rounded-full bg-cyan-400/10" style={{ width: "75%" }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </article>

        {/* ── Pillar 2: Fractional Cut-List Engine ─────────────────────── */}
        <article className="border-b border-slate-800/40 bg-slate-900/30">
          <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
              {/* Visual (left on desktop) */}
              <div className="flex items-center justify-center lg:order-1">
                <div className="relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-emerald-400/5">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/[0.04] to-transparent" />
                  <div className="relative p-8 sm:p-12">
                    <div className="mx-auto max-w-xs space-y-4">
                      {/* Stylized cut-list representation */}
                      {[
                        { label: '96" → 2×4 Stud', pct: "100%", color: "bg-emerald-400/30" },
                        { label: '73.5" Rail Cut', pct: "76.5%", color: "bg-emerald-400/20" },
                        { label: '48" Cross Brace', pct: "50%", color: "bg-emerald-400/15" },
                        { label: '14.5" Spacer', pct: "15%", color: "bg-yellow-400/20" },
                        { label: 'Waste: 8.5"', pct: "8.8%", color: "bg-red-400/15" },
                      ].map((cut) => (
                        <div key={cut.label} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono font-semibold text-stone-300">{cut.label}</span>
                            <span className="text-stone-500">{cut.pct}</span>
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                            <div className={`h-full rounded-full ${cut.color}`} style={{ width: cut.pct }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Text */}
              <div className="flex flex-col justify-center lg:order-2">
                <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                  Pillar 2
                </div>
                <h2 className="mb-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Fractional Cut-List Engine
                </h2>
                <p className="mb-6 text-base leading-relaxed text-stone-400">
                  Every configuration is transformed into a precise, fractional
                  cut plan using a proprietary bin-packing algorithm. The engine
                  calculates exact 2&times;4 cuts down to the sixteenth of an
                  inch, nests parts across standard 8-foot lumber to minimize
                  waste, and generates a complete material shopping list — screws,
                  brackets, and all.
                </p>
                <ul className="space-y-3">
                  {[
                    "Bin-packed lumber optimization — minimal waste per board",
                    "Fractional-inch precision for production-grade cut plans",
                    "Auto-generated shopping lists with screw counts by type",
                    "Smart Inventory Manager deducts existing stock automatically",
                    "Real-time cost estimation synced to installer pricing config",
                    "Supports custom rack dimensions, tote types, and add-ons",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-stone-300">
                      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/10">
                        <svg className="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </article>

        {/* ── Pillar 3: Stripe Connect Infrastructure ──────────────────── */}
        <article className="border-b border-slate-800/40">
          <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
              {/* Text */}
              <div className="flex flex-col justify-center">
                <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-yellow-400">
                  Pillar 3
                </div>
                <h2 className="mb-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Stripe Connect Split-Payment Infrastructure
                </h2>
                <p className="mb-6 text-base leading-relaxed text-stone-400">
                  Payments flow through Stripe Connect, splitting every
                  transaction between the installer and the platform
                  automatically. Customers pay a secure deposit to lock their
                  build date, and installers collect the balance on-site — no
                  invoicing, no manual bookkeeping, no chasing payments.
                </p>
                <ul className="space-y-3">
                  {[
                    "Automated deposit collection with real-time confirmation",
                    "Platform fee routing — 3% direct leads, 15% network leads",
                    "Installer payouts land directly in their Stripe account",
                    "Balance-due calculations displayed on every job ticket",
                    "Secure checkout pages with no stored card data on our servers",
                    "Webhook-driven status updates across the entire pipeline",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-stone-300">
                      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-400/10">
                        <svg className="h-3 w-3 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Visual */}
              <div className="flex items-center justify-center">
                <div className="relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-yellow-400/5">
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/[0.04] to-transparent" />
                  <div className="relative p-8 sm:p-12">
                    <div className="mx-auto max-w-xs space-y-5">
                      {/* Stylized payment flow */}
                      {[
                        { label: "Customer Deposit", icon: "↓", accent: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5" },
                        { label: "Platform Fee Split", icon: "÷", accent: "text-emerald-400 border-emerald-400/20 bg-emerald-400/5" },
                        { label: "Installer Payout", icon: "→", accent: "text-cyan-400 border-cyan-400/20 bg-cyan-400/5" },
                      ].map((step, i) => (
                        <div key={step.label} className="flex items-center gap-4">
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-lg font-bold ${step.accent}`}>
                            {step.icon}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{step.label}</p>
                            <p className="text-[11px] text-stone-500">
                              {i === 0 && "Secure Stripe Checkout"}
                              {i === 1 && "Automatic fee calculation"}
                              {i === 2 && "Direct to installer bank"}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div className="mt-4 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
                        <p className="text-center text-[10px] font-bold uppercase tracking-wider text-stone-500">
                          Zero manual bookkeeping
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </article>

        {/* ── Integration Summary ──────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
              One Platform. Every Step Covered.
            </h2>
            <p className="mb-12 text-base leading-relaxed text-stone-400">
              From the first 3D render to the final payout, every step of the
              tote rack lifecycle flows through a single system. Installers get a
              purpose-built operating system. Customers get a seamless experience.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "Design",
                description: "Customer builds their rack in the 3D configurator. Configuration flows to the installer as a pre-sold job.",
                accent: "border-cyan-400/20 bg-cyan-400/5 text-cyan-400",
                iconPath: "M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9",
              },
              {
                title: "Build",
                description: "Cut plans, material lists, and step-by-step assembly guides generated automatically from the design.",
                accent: "border-emerald-400/20 bg-emerald-400/5 text-emerald-400",
                iconPath: "M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085",
              },
              {
                title: "Pay",
                description: "Deposits collected automatically. Platform fees split. Installers paid out — no invoices, no chasing.",
                accent: "border-yellow-400/20 bg-yellow-400/5 text-yellow-400",
                iconPath: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z",
              },
            ].map((pillar) => (
              <div
                key={pillar.title}
                className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8"
              >
                <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border ${pillar.accent}`}>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={pillar.iconPath} />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-black text-white">{pillar.title}</h3>
                <p className="text-sm leading-relaxed text-stone-400">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA Section ──────────────────────────────────────────────── */}
        <section className="border-t border-slate-800/40 bg-gradient-to-b from-slate-950 to-slate-900/50">
          <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="mb-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Ready to Build Smarter?
              </h2>
              <p className="mb-8 text-base text-stone-400">
                Join the network of professionals who use Storage Network to
                design, price, and deliver tote rack installations — backed by
                technology that handles the rest.
              </p>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link
                  href="/join"
                  className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-8 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:shadow-yellow-400/30"
                >
                  Join as Installer
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-6 py-3.5 text-sm font-bold text-white transition-all hover:border-slate-600 hover:bg-slate-800"
                >
                  Find an Installer Near You
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/40 bg-[#070a13]">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 opacity-50 transition-opacity hover:opacity-80"
            >
              <Image
                src="/landing_page_logo.png"
                alt="Storage Network"
                width={68}
                height={20}
                className="h-5 w-auto"
              />
              <span className="text-xs text-stone-500">Storage Network</span>
            </Link>
            <div className="flex items-center gap-4 text-[11px] text-stone-600">
              <Link href="/legal/privacy" className="hover:text-stone-400">
                Privacy
              </Link>
              <Link href="/legal/terms" className="hover:text-stone-400">
                Terms
              </Link>
              <span>&copy; {new Date().getFullYear()} Storage-Network.app</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
