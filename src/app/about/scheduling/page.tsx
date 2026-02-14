import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Automated Scheduling & Capacity | Storage Network",
  description:
    "How Storage Network's built-in scheduler calculates earliest available dates, respects installer blackout days, manages daily capacity, and collects secure deposits to eliminate tire-kicker leads.",
  openGraph: {
    title: "Automated Scheduling & Capacity | Storage Network",
    description:
      "Smart scheduling for tote rack installers: capacity limits, blackout dates, deposit gating, and earliest-available-date logic.",
  },
};

const schedulerSchema = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "How Storage Network's Automated Scheduler Works",
  url: "https://storage-network.app/about/scheduling",
  author: { "@id": "https://storage-network.app/#founder" },
  publisher: { "@id": "https://storage-network.app/#organization" },
  about: {
    "@type": "SoftwareApplication",
    "@id": "https://storage-network.app/#app",
  },
  description:
    "Technical overview of the automated scheduling system: max daily capacity, blackout dates, order-size-aware booking, and deposit-secured reservations.",
};

export default function SchedulingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schedulerSchema) }}
      />

      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold text-white">
            Storage Network
          </Link>
          <Link
            href="/about"
            className="text-sm font-medium text-stone-400 transition-colors hover:text-white"
          >
            About
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-yellow-400">
          Platform Features
        </p>
        <h1 className="mb-6 text-4xl font-black leading-tight text-white sm:text-5xl">
          Automated Scheduling{" "}
          <span className="text-yellow-400">& Capacity</span>
        </h1>
        <p className="mb-12 max-w-2xl text-lg leading-relaxed text-stone-400">
          Every Storage Network installer gets a smart scheduler that manages
          daily capacity, respects personal time, and only books jobs backed by
          a deposit. Here&apos;s how it works under the hood.
        </p>

        {/* ── Max Daily Capacity ────────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="mb-4 text-2xl font-bold text-white">
            Max Daily Capacity
          </h2>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <div className="space-y-4 text-base leading-relaxed">
              <p>
                Each installer sets a <strong className="text-white">maximum daily
                slot count</strong>&mdash;the number of tote slots they can realistically
                build in a single workday. When a customer submits an order, the
                scheduler calculates the total slot count and divides it across
                available workdays.
              </p>
              <p>
                For example, an installer with a capacity of 40 slots/day
                receiving a 100-slot order will see the system allocate 3
                workdays (40 + 40 + 20). The{" "}
                <strong className="text-white">earliest available date</strong> is
                the first block of consecutive open workdays that fits the full
                build.
              </p>
              <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">
                  How It Calculates
                </p>
                <ol className="list-inside list-decimal space-y-1 text-sm text-stone-400">
                  <li>Customer configures rack (columns &times; rows = total slots)</li>
                  <li>System divides total slots by installer&apos;s daily max capacity</li>
                  <li>Rounds up to determine required workdays</li>
                  <li>Scans the installer&apos;s calendar for the first available block of consecutive workdays</li>
                  <li>Skips blackout dates and off-days automatically</li>
                  <li>Presents the earliest available start date to the customer</li>
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* ── Blackout Dates & Availability ─────────────────────────── */}
        <section className="mb-12">
          <h2 className="mb-4 text-2xl font-bold text-white">
            Blackout Dates & Availability Controls
          </h2>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <div className="space-y-4 text-base leading-relaxed">
              <p>
                Installers control their schedule with two layers of
                availability management:
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <h3 className="mb-2 text-sm font-bold text-yellow-400">
                    Recurring Off-Days
                  </h3>
                  <p className="text-sm text-stone-400">
                    Toggle specific days of the week on or off. For example, an
                    installer can mark <strong className="text-stone-300">Mondays and
                    Tuesdays</strong> as unavailable every week. The scheduler
                    will never book jobs on those days.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <h3 className="mb-2 text-sm font-bold text-yellow-400">
                    Specific Blackout Dates
                  </h3>
                  <p className="text-sm text-stone-400">
                    Block out individual dates for vacations, holidays, personal
                    days, or equipment maintenance. These override the weekly
                    schedule and protect the installer&apos;s personal time.
                  </p>
                </div>
              </div>

              <p>
                Both layers combine to produce the installer&apos;s true availability
                window. When a customer books, they only see dates that the
                installer has actually made available. No double-bookings, no
                surprise conflicts.
              </p>
            </div>
          </div>
        </section>

        {/* ── Deposit-Secured Booking ───────────────────────────────── */}
        <section className="mb-12">
          <h2 className="mb-4 text-2xl font-bold text-white">
            Deposit-Secured Booking
          </h2>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <div className="space-y-4 text-base leading-relaxed">
              <p>
                Every booking requires a <strong className="text-white">15%
                deposit</strong> paid upfront through Stripe. This serves two
                purposes:
              </p>
              <ul className="list-inside list-disc space-y-2 text-stone-400">
                <li>
                  <strong className="text-stone-300">Filters out tire-kickers</strong>:
                  Customers who pay a deposit are committed. Installers stop
                  wasting time on leads that go nowhere.
                </li>
                <li>
                  <strong className="text-stone-300">Secures the installer&apos;s time</strong>:
                  The deposit locks the build date. If the customer cancels, the
                  installer&apos;s calendar reopens automatically for new bookings.
                </li>
              </ul>
              <p>
                The balance is collected on the day of installation. The
                platform handles all payment processing, invoicing, and receipt
                generation.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-8 text-center">
          <h2 className="mb-2 text-xl font-bold text-white">
            Ready to Stop Chasing Leads?
          </h2>
          <p className="mb-6 text-stone-400">
            Join the network and let the scheduler work for you.
          </p>
          <Link
            href="/partner/join"
            className="rounded-lg bg-yellow-400 px-6 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
          >
            Join as an Installer
          </Link>
        </section>
      </main>
    </div>
  );
}
