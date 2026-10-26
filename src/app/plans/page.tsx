import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Box, CheckCircle, ChevronDown, ExternalLink, FileText, Wrench } from "lucide-react";
import { PUBLIC_PLANS } from "@/lib/plans-config";
import {
  BAY_OPENING_IN,
  MODULE_MAX_COLS,
  MODULE_MAX_ROWS,
  TOTE_PLAN_LIMITS,
  TOTE_PLAN_TIERS,
  UNIT_DEPTH_IN,
  formatPlanPrice,
} from "@/lib/tote-plans";
import { LADDER_JIG_NAME, LADDER_JIG_TAGLINE } from "@/lib/ladder-jig";
import { generateBreadcrumbJsonLd } from "@/lib/schema/breadcrumb";
import { planPageHref } from "@/lib/plan-pages";
import {
  PLANS_FAQS,
  PLANS_PRICES,
  ladderJigProductJsonLd,
  PLANS_UPDATED,
  plansFaqJsonLd,
  plansWebPageJsonLd,
  publicPlanProductsJsonLd,
  totePlansProductJsonLd,
} from "@/lib/schema/plans";
import { BuyPlanButton, ResendLinkPanel } from "@/components/plans/PlansStorefront";

// ═══════════════════════════════════════════════════════════════════════════
// DIY PLANS STOREFRONT — /plans
//
// Server-rendered so search engines see the full copy, FAQ and structured
// data; only the buy button and resend form are client components.
// Prices and dimensions all come from the plan constants.
// ═══════════════════════════════════════════════════════════════════════════

const TITLE = "DIY Tote Rack Plans for 27-Gal HDX & Greenmade Totes | Storage Network";
const DESCRIPTION = `Tote rack plans sized to your wall: a 2×4 build for 27-gallon HDX and Greenmade totes with a cut list, shopping list and every step in 3D. PDF ${PLANS_PRICES.pdf}, or ${PLANS_PRICES.interactive} with the interactive 3D guide.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/plans",
  },
  keywords: [
    "tote rack plans",
    "27 gallon tote rack plans",
    "DIY tote rack plans",
    "tote storage rack plans",
    "HDX tote rack plans",
    "Greenmade tote rack plans",
    "2x4 tote rack plans",
    "rolling tote rack plans",
    "tote organizer plans",
    "tote rack cut list",
    "garage storage shelf plans",
  ],
  openGraph: {
    title: "DIY Tote Rack Plans, Sized to Your Wall",
    description: DESCRIPTION,
    url: "/plans",
    type: "website",
    siteName: "Storage Network",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "DIY Tote Rack Plans, Sized to Your Wall",
    description: DESCRIPTION,
  },
};

const jsonLd = [
  plansWebPageJsonLd(DESCRIPTION),
  generateBreadcrumbJsonLd([{ name: "DIY Build Plans", path: "/plans" }]),
  totePlansProductJsonLd(),
  ladderJigProductJsonLd(),
  ...publicPlanProductsJsonLd(),
  plansFaqJsonLd(),
];

// ── Tote Organizer Plans ─────────────────────────────────────────────────────
// Sized to the customer's own design, so the purchase starts in the
// configurator rather than here.

function TotePlansCard() {
  const tiers = [
    { tier: TOTE_PLAN_TIERS.pdf, Icon: FileText },
    { tier: TOTE_PLAN_TIERS.interactive, Icon: Box },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-yellow-400/30 bg-slate-900">
      <div className="h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />
      <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-yellow-400/5 blur-3xl" />

      <div className="relative p-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">Made to your measurements</p>
        <h2 className="mt-1 text-lg font-black text-white">Tote Organizer Plans: PDF or Interactive 3D Guide</h2>
        <p className="mt-1 text-sm text-stone-400">
          Pick your size, tote brand, casters and worktop, and get plans generated for exactly
          that build. The same cut lists and step-by-step guide our pro installers use.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {tiers.map(({ tier, Icon }) => (
            <div key={tier.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-yellow-400" aria-hidden />
                <h3 className="text-sm font-bold text-white">{tier.name}</h3>
                <span className="ml-auto text-base font-black text-yellow-400">{formatPlanPrice(tier.price)}</span>
              </div>
              <p className="mt-1.5 text-xs text-stone-500">{tier.tagline}</p>
              <ul className="mt-3 space-y-1.5">
                {tier.includes.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-stone-300">
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] text-stone-500">
          Bought the PDF? Upgrade to the interactive guide any time for {PLANS_PRICES.upgrade}.
        </p>

        <Link
          href="/plans/checkout"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:from-amber-300 hover:to-yellow-400"
        >
          Size Your Tote Rack &amp; Get Plans
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <p className="mt-2 text-center text-[11px] text-stone-600">
          Pick your size, see it in 3D for free, then choose PDF or interactive guide.
        </p>
      </div>
    </div>
  );
}

// ── What's in the plan ───────────────────────────────────────────────────────

const PLAN_DETAILS: { title: string; body: string }[] = [
  {
    title: "Fits HDX and Greenmade 27-gallon totes",
    body: `Every bay is a ${BAY_OPENING_IN}" opening between uprights, sized for both 27-gallon HDX totes (Home Depot) and Greenmade totes (Costco). Each tote hangs by its rim on two 2×4 rails and slides out like a drawer. No shelves to build.`,
  },
  {
    title: "Simple 2×4 construction",
    body: "Uprights, plates and rails all come from standard 2×4×8' boards. The rails are 2×4s ripped in half on a table saw, so every part is lumber you can buy at any home center.",
  },
  {
    title: "Any size, split into 8' modules",
    body: `Build anything from a single column to ${TOTE_PLAN_LIMITS.maxCols} totes wide and ${TOTE_PLAN_LIMITS.maxRows} high, up to ${TOTE_PLAN_LIMITS.maxUnits} units in one plan. Big walls are split into modules of up to ${MODULE_MAX_COLS} wide by ${MODULE_MAX_ROWS} high so every part fits an 8' board. Identical modules share a type: build it once, then repeat it.`,
  },
  {
    title: "Rolling tote rack or wall unit",
    body: "Add swivel casters to roll it across the garage. Racks up to 8' long ride on 4 casters, and longer racks get more, each set under an upright. Add an optional plywood worktop for a tote rack workbench.",
  },
  {
    title: "Cut list, shopping list and 3D steps",
    body: "Your plan includes a shopping list with exact quantities, board-by-board cut diagrams including the rail rips, fastener callouts, a tools checklist, and every assembly step rendered in 3D for your exact build.",
  },
  {
    title: "Skill level and tools",
    body: "If you can make square crosscuts and rip a 2×4 on a table saw, you can build it. You'll need a miter or circular saw, a table saw, a drill/driver, a speed square, a tape measure and clamps. The ladder jig makes every frame identical.",
  },
];

// ── At a glance ──────────────────────────────────────────────────────────────
// A plain spec table: the format answer engines quote most readily.

const AT_A_GLANCE: [string, string][] = [
  ["Totes", "27-gallon HDX (Home Depot) and Greenmade (Costco)"],
  ["Bay opening", `${BAY_OPENING_IN}" between uprights, one tote per bay`],
  ["Depth", `${UNIT_DEPTH_IN}"`],
  ["Lumber", "2×4×8' boards; rails ripped from 2×4s"],
  ["Size", `1×1 up to ${TOTE_PLAN_LIMITS.maxCols} wide × ${TOTE_PLAN_LIMITS.maxRows} high, up to ${TOTE_PLAN_LIMITS.maxUnits} units`],
  ["Modules", `Up to ${MODULE_MAX_COLS} wide × ${MODULE_MAX_ROWS} high, so every part fits an 8' board`],
  ["Options", "Swivel casters, plywood worktop"],
  ["Includes", "Cut list, shopping list, every assembly step in 3D, tools checklist"],
  ["Price", `PDF ${PLANS_PRICES.pdf} · Interactive 3D guide ${PLANS_PRICES.interactive} · Upgrade ${PLANS_PRICES.upgrade}`],
  ["Delivery", "Instant access, permanent link by email"],
];

// ── Fixed-price plans (e.g. Adirondack chair) ────────────────────────────────

function PlanCard({ plan }: { plan: (typeof PUBLIC_PLANS)[number] }) {
  const priceDisplay = formatPlanPrice(plan.price);
  const href = planPageHref(plan.id);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-slate-900">
      <div className="h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-400/5 blur-3xl" />

      <div className="relative p-6">
        <div className="flex items-start gap-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
            <Image
              src={plan.previewImage}
              alt={`${plan.name} build plan preview`}
              fill
              sizes="96px"
              className="object-cover"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-white">
              {href ? (
                <Link href={href} className="hover:text-yellow-300">
                  {plan.name} Plans
                </Link>
              ) : (
                `${plan.name} Plans`
              )}
            </h3>
            <p className="mt-0.5 text-sm text-stone-400">{plan.tagline}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-2xl font-black text-yellow-400">{priceDisplay}</span>
              <span className="text-xs text-stone-600">one-time · instant access</span>
            </div>
          </div>
        </div>

        <ul className="mt-5 space-y-2">
          {plan.includes.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
              <span className="text-sm text-stone-300">{item}</span>
            </li>
          ))}
        </ul>

        {href && (
          <Link
            href={href}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-yellow-400 hover:text-yellow-300"
          >
            {plan.name} plan details: materials, parts and steps
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}

        <BuyPlanButton planId={plan.id} priceDisplay={priceDisplay} />
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PlansPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link href="/">
            <Image
              src="/landing_page_logo.png"
              alt="Storage Network home"
              width={36}
              height={36}
              className="rounded"
            />
          </Link>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">DIY Build Plans</p>
            <p className="text-[10px] text-stone-500">Digital plans · Instant access · Yours forever</p>
          </div>
          <Link
            href="/"
            className="hidden items-center gap-1 text-[11px] font-semibold text-stone-500 transition hover:text-stone-300 sm:flex"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            Storage Network
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-4 py-8">
        <nav aria-label="Breadcrumb" className="text-[11px] text-stone-600">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-stone-300">Home</Link>
            </li>
            <li aria-hidden>›</li>
            <li aria-current="page" className="text-stone-400">DIY Build Plans</li>
          </ol>
        </nav>

        {/* ── Intro ──────────────────────────────────────────────── */}
        <section className="text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/5 px-4 py-1.5">
            <BookOpen className="h-3.5 w-3.5 text-amber-400" aria-hidden />
            <span className="text-xs font-bold text-amber-400">DIY build plans</span>
          </div>
          <h1 className="mb-3 text-2xl font-black text-white sm:text-3xl">
            DIY Tote Rack Plans, Sized to Your Wall
          </h1>
          <p className="text-sm leading-relaxed text-stone-400">
            Build a 2×4 tote storage rack for 27-gallon HDX or Greenmade totes, any size you need.
            Design it in 3D, then get a plan generated for exactly that build: cut list, shopping list
            and every assembly step. {PLANS_PRICES.pdf} for the PDF, {PLANS_PRICES.interactive} with the
            interactive 3D guide. Buy once, and we email you a permanent link.
          </p>
          <div className="relative mx-auto mt-6 aspect-[16/10] w-full overflow-hidden rounded-2xl border border-slate-800">
            <Image
              src="/hero-rack.webp"
              alt="Rolling 2×4 tote storage rack, 4 totes wide by 4 high, holding 27-gallon yellow-lid totes on casters"
              fill
              priority
              sizes="(max-width: 672px) 100vw, 640px"
              className="object-cover object-left"
            />
          </div>
        </section>

        {/* ── At a glance ────────────────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-xl font-black text-white">Tote Rack Plans at a Glance</h2>
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-slate-800">
                {AT_A_GLANCE.map(([label, value]) => (
                  <tr key={label}>
                    <th scope="row" className="w-28 bg-slate-900/60 px-4 py-2.5 align-top font-semibold text-stone-400">
                      {label}
                    </th>
                    <td className="px-4 py-2.5 text-stone-200">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-stone-600">
            Storage Network DIY plans · Updated{" "}
            <time dateTime={PLANS_UPDATED}>
              {new Date(`${PLANS_UPDATED}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
            </time>
          </p>
        </section>

        {/* ── Tote organizer plans ───────────────────────────────── */}
        <section>
          <TotePlansCard />
        </section>

        {/* ── What's in the plan ─────────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-xl font-black text-white">What You Get in Your Tote Rack Plan</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {PLAN_DETAILS.map((d) => (
              <div key={d.title} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="mb-1.5 text-sm font-bold text-white">{d.title}</h3>
                <p className="text-xs leading-relaxed text-stone-400">{d.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Ladder jig ─────────────────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-xl font-black text-white">Ladder Building Jig for Tote Racks</h2>
          <Link
            href="/plans/jig"
            className="group flex items-center gap-4 rounded-2xl border border-emerald-500/20 bg-slate-900 p-5 transition hover:border-emerald-400/50"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10">
              <Wrench className="h-6 w-6 text-emerald-400" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-white">{LADDER_JIG_NAME} Plans</h3>
              <p className="mt-0.5 text-xs text-stone-400">{LADDER_JIG_TAGLINE}</p>
              <p className="mt-1 text-[11px] text-stone-500">
                {PLANS_PRICES.jig} · {PLANS_PRICES.jigOwner} with any tote organizer plan
              </p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-emerald-400 transition group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </section>

        {/* ── More plans ─────────────────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-xl font-black text-white">More DIY Woodworking Plans</h2>
          <div className="space-y-4">
            {PUBLIC_PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
            <div className="rounded-2xl border border-dashed border-slate-700 p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-600">More plans coming soon</p>
              <p className="mt-1 text-xs text-stone-700">Workbenches, planter boxes, overhead storage, and more.</p>
            </div>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-xl font-black text-white">Tote Rack Plans FAQ</h2>
          <div className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900">
            {PLANS_FAQS.map((faq) => (
              <details key={faq.question} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-white">
                  <h3>{faq.question}</h3>
                  <ChevronDown className="h-4 w-4 shrink-0 text-stone-500 transition group-open:rotate-180" aria-hidden />
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-stone-400">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Resend link ────────────────────────────────────────── */}
        <ResendLinkPanel />

        {/* ── Pro installer CTA ──────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-center">
          <p className="mb-1 text-xs font-bold text-stone-500">Rather have a pro build it?</p>
          <p className="mb-3 text-xs text-stone-600">
            Design your system in the{" "}
            <Link href="/design" className="text-stone-400 underline hover:text-stone-200">
              free 3D tote storage designer
            </Link>{" "}
            and get it built by a local installer, or{" "}
            <Link href="/installer-network" className="text-stone-400 underline hover:text-stone-200">
              find a tote rack installer near you
            </Link>
            . Installers get plans included with their dashboard plus quoting tools, pay links, and job management.
          </p>
          <Link
            href="/invite"
            className="inline-block rounded-xl border border-yellow-400/30 px-5 py-2.5 text-xs font-bold text-yellow-400 transition hover:bg-yellow-400/10"
          >
            Join as an Installer
          </Link>
        </div>
      </main>
    </div>
  );
}
