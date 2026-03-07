import type { Metadata } from "next";
import Link from "next/link";
import { generateBreadcrumbJsonLd } from "@/lib/schema/breadcrumb";

export const metadata: Metadata = {
  title: "About Storage Network | Builder-Founded Garage Storage OS",
  description:
    "Storage Network was built on the garage floor, not in a boardroom. Learn how builder-turned-founder Skyler Camacho created the industry-standard operating system for professional tote rack installers.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Storage Network | Builder-Founded Garage Storage OS",
    description:
      "From manually measuring 2×4s on the garage floor to building an industry-standard OS for professional installers.",
  },
};

// About page JSON-LD — reinforces E-E-A-T signals
const aboutSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About Storage Network",
  url: "https://storage-network.app/about",
  mainEntity: {
    "@id": "https://storage-network.app/#organization",
  },
  author: {
    "@id": "https://storage-network.app/#founder",
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbJsonLd([{ name: "About", path: "/about" }])
          ),
        }}
      />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold text-white">
            Storage Network
          </Link>
          <Link
            href="/design"
            className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
          >
            Design Your Rack
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="mb-16">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-yellow-400">
            About Us
          </p>
          <h1 className="mb-6 text-4xl font-black leading-tight text-white sm:text-5xl">
            Built on the Garage Floor,{" "}
            <span className="text-yellow-400">Not in a Boardroom</span>
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-stone-400">
            Storage Network wasn&apos;t designed by someone who read about construction
            in a textbook. It was born from sawdust, speed squares, and hundreds
            of 2&times;4 tote racks built by hand in real garages across the
            country.
          </p>
        </section>

        {/* ── Builder-Turned-Founder Story ──────────────────────────── */}
        <section className="mb-16">
          <h2 className="mb-4 text-2xl font-bold text-white">
            The Builder-Turned-Founder Story
          </h2>
          <div className="space-y-4 text-base leading-relaxed">
            <p>
              Skyler Camacho started where every good builder starts&mdash;on the
              job site. Measuring 2&times;4 studs by hand, ripping plywood rails on
              a table saw, and screwing together storage racks one bay at a time.
              After building dozens of custom tote storage systems for garages,
              basements, and sheds, a pattern became clear: the construction was
              repeatable, but the business side was chaos.
            </p>
            <p>
              Every job meant re-doing the same math. Every customer call meant
              explaining dimensions from scratch. Every quote risked being wrong
              because mental math and scrap-paper sketches only go so far. The
              racks were professional-grade, but the workflow behind them was
              held together with duct tape.
            </p>
            <p>
              So Skyler built something that didn&apos;t exist: a complete operating
              system for tote rack builders. Not a generic project management
              tool. Not a cookie-cutter website builder. A purpose-built
              platform that speaks the language of 2&times;4 framing, plywood
              rail systems, and 27-gallon HDX totes&mdash;because that&apos;s what
              the work actually is.
            </p>
          </div>
        </section>

        {/* ── Problem / Solution ────────────────────────────────────── */}
        <section className="mb-16">
          <h2 className="mb-4 text-2xl font-bold text-white">
            The Problem We Solve
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-red-400">
                Before Storage Network
              </h3>
              <ul className="space-y-2 text-sm text-stone-400">
                <li>&bull; Manual scheduling over text messages and phone tag</li>
                <li>&bull; &quot;Tire-kicker&quot; leads that waste hours with no commitment</li>
                <li>&bull; No deposit security&mdash;cancellations eat into your bottom line</li>
                <li>&bull; Scrap-paper quotes that miss materials or undercount screws</li>
                <li>&bull; No way to show a customer what they&apos;re getting before you build it</li>
              </ul>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-emerald-400">
                With Storage Network
              </h3>
              <ul className="space-y-2 text-sm text-stone-400">
                <li>&bull; Automated scheduling with built-in capacity logic</li>
                <li>&bull; 15% deposit locks the build date&mdash;tire-kickers filter themselves</li>
                <li>&bull; Instant 3D visualization&mdash;customers see the exact rack before you cut a board</li>
                <li>&bull; Auto-generated cut plans with bin-packed lumber optimization</li>
                <li>&bull; Precise material lists and screw counts, every time</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── Verified Network ──────────────────────────────────────── */}
        <section className="mb-16">
          <h2 className="mb-4 text-2xl font-bold text-white">
            The Verified Installer Network
          </h2>
          <div className="space-y-4 text-base leading-relaxed">
            <p>
              Not every handyman with a drill qualifies. Storage Network is a
              filter for <strong className="text-white">Verified Pros</strong>&mdash;builders
              who use professional-grade construction standards, proper fastener
              specifications, and consistent build quality.
            </p>
            <p>
              Every installer in the network uses the same configurator, the
              same assembly process, and the same material standards. That means
              a rack built in Miami meets the same spec as one built in Omaha or
              Salt Lake City. The platform enforces consistency so the customer
              always gets a professional result.
            </p>
            <p>
              We&apos;re currently active in{" "}
              <strong className="text-white">Florida</strong> (Miami, Orlando),{" "}
              <strong className="text-white">Nebraska</strong> (Omaha),{" "}
              <strong className="text-white">Colorado</strong> (Denver),{" "}
              <strong className="text-white">Utah</strong> (Salt Lake City), and
              the{" "}
              <strong className="text-white">Northeast</strong> (NY / NJ / PA)&mdash;and
              growing.
            </p>
          </div>
        </section>

        {/* ── What Makes the Platform Different ─────────────────────── */}
        <section className="mb-16">
          <h2 className="mb-4 text-2xl font-bold text-white">
            The Configurator: 30 Seconds to a Complete Build Plan
          </h2>
          <div className="space-y-4 text-base leading-relaxed">
            <p>
              The core of Storage Network is a real-time 3D configurator built
              with React Three Fiber. Enter your wall width, pick your tote
              type, and the system instantly generates a to-scale 3D model, a
              complete cut plan with bin-packed lumber optimization, a material
              shopping list with screw counts, and a step-by-step interactive
              assembly guide.
            </p>
            <p>
              For installers, it eliminates the math. For customers, it
              eliminates the guesswork. For both, it eliminates the
              back-and-forth that kills deals.
            </p>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-8 text-center">
          <h2 className="mb-2 text-2xl font-bold text-white">
            Ready to See It in Action?
          </h2>
          <p className="mb-6 text-stone-400">
            Design your rack in 30 seconds. No signup required.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/design"
              className="rounded-lg bg-yellow-400 px-6 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
            >
              Launch the 3D Configurator
            </Link>
            <Link
              href="/partner/join"
              className="rounded-lg border border-slate-700 bg-slate-800 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-700"
            >
              Join as an Installer
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
