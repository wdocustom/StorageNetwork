import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Box, CheckCircle, ChevronDown, Infinity as InfinityIcon, ShieldCheck, Star } from "lucide-react";
import PlanSamplesRow from "@/components/plans/PlanSamplesRow";
import StickyPlanCta from "@/components/plans/StickyPlanCta";
import { estimatePlanMaterials } from "@/app/actions/plan-materials";
import { PUBLIC_PLANS } from "@/lib/plans-config";
import {
  BAY_OPENING_IN,
  MODULE_MAX_COLS,
  MODULE_MAX_ROWS,
  TOTE_PLAN_LIMITS,
  TOTE_PLAN_ALL_ACCESS,
  DEFAULT_TOTE_PLAN_DESIGN,
  UNIT_DEPTH_IN,
  formatPlanPrice,
} from "@/lib/tote-plans";
import { LADDER_JIG_NAME } from "@/lib/ladder-jig";
import { generateBreadcrumbJsonLd } from "@/lib/schema/breadcrumb";
import { planPageHref } from "@/lib/plan-pages";
import { PLAN_BESTSELLERS } from "@/lib/plan-bestsellers";
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
import { ResendLinkPanel } from "@/components/plans/PlansStorefront";

// ═══════════════════════════════════════════════════════════════════════════
// DIY PLANS STOREFRONT — /plans
//
// The landing page for plan ads (≈90% phones, mostly Facebook). It has one
// job: get the visitor into the designer. Order: promise + price + button
// above the fold, one-tap bestsellers, how it works, what $19 buys (with
// the lumber-cost anchor), samples + proof, the five questions buyers
// hesitate on, a last call. Everything that isn't the sale lives in the
// footer, and a sticky bar keeps the button in reach once the hero's
// scrolls away. Server-rendered for SEO; every FAQ stays in the page and
// the structured data. Prices and dimensions come from the plan constants.
// ═══════════════════════════════════════════════════════════════════════════

const TITLE = "DIY Tote Rack Plans for 27-Gal HDX & Greenmade Totes | Storage Network";
const DESCRIPTION = `Tote rack plans sized to your wall: a 2×4 build for 27-gallon HDX and Greenmade totes with a cut list, shopping list and every step in 3D. ${PLANS_PRICES.allAccess} once for unlimited plans, every size you design, for life: 3D guide + printable PDF.`;

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

// ── Proof ────────────────────────────────────────────────────────────────────
// Paid jobs completed by Storage Network installers with the same build
// system (73 on Nov 12, 2026: leads paid/completed). A floor, rounded down
// so it stays true; raise it as the network grows.
const PRO_INSTALLS = "70+";

// ── At a glance ──────────────────────────────────────────────────────────────
// A plain spec table: the format answer engines quote most readily. Shown
// collapsed under the FAQ.

const AT_A_GLANCE: [string, string][] = [
  ["Totes", "27-gal HDX (Home Depot) or Greenmade (Costco)"],
  ["Build", `2×4s · ${BAY_OPENING_IN}" bays · ${UNIT_DEPTH_IN}" deep`],
  ["Size", `Up to ${TOTE_PLAN_LIMITS.maxCols} wide × ${TOTE_PLAN_LIMITS.maxRows} high, ${TOTE_PLAN_LIMITS.maxUnits} units; split into ${MODULE_MAX_COLS}×${MODULE_MAX_ROWS} modules`],
  ["Options", "Casters · plywood worktop"],
  ["Includes", "Cut list · shopping list · every step in 3D"],
];

// The questions buyers actually hesitate on, shown open to read; the rest
// (still in the FAQ structured data) sit under "More questions".
const TOP_FAQ_QUESTIONS = [
  "What does All-Access include?",
  "Can I make plans for more than one size?",
  "What totes do these tote rack plans fit?",
  "What tools do I need to build it?",
  "How do I get my plans after I buy?",
];

const STEPS = [
  { n: 1, title: "Design it free", text: "Pick how many totes wide and tall, HDX or Greenmade, casters and a worktop. See it in 3D." },
  { n: 2, title: `Get your plan — ${PLANS_PRICES.allAccess}`, text: "Cut list, shopping list and every step, generated for your exact size. Instant." },
  { n: 3, title: "Build it", text: "Follow the 3D guide on your phone in the garage, or print the PDF. Need another size later? Free." },
];

const VALUE: [string, string][] = [
  ["Unlimited plans, any size", "Every tote organizer you design, now or years from now"],
  ["Interactive 3D build guide", "Rotate, zoom and step through each module on your phone"],
  ["Printable PDF", "Shopping list, board-by-board cut diagrams, every step"],
  ["Lifetime access", "One payment. No subscription, no per-plan fees"],
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function PlansPage() {
  // What lumber for the default 4×4 costs at retail: the price anchor.
  const materials = await estimatePlanMaterials(DEFAULT_TOTE_PLAN_DESIGN).catch(() => null);
  const materialsLine = materials
    ? `Lumber and hardware for a 4×4 rack run about $${Math.round(materials.materialsTotal / 10) * 10}.`
    : "Lumber and hardware are the real cost of the build.";

  const otherPlans = [
    { href: "/plans/jig", title: `${LADDER_JIG_NAME} Plans`, line: `${PLANS_PRICES.jig}, or ${PLANS_PRICES.jigOwner} with tote plans` },
    ...PUBLIC_PLANS.map((plan) => ({
      href: planPageHref(plan.id) ?? "/plans",
      title: `${plan.name} Plans`,
      line: formatPlanPrice(plan.price),
    })),
  ];
  const topFaqs = TOP_FAQ_QUESTIONS.map((q) => PLANS_FAQS.find((f) => f.question === q)).filter(
    (f): f is (typeof PLANS_FAQS)[number] => !!f
  );
  const moreFaqs = PLANS_FAQS.filter((f) => !TOP_FAQ_QUESTIONS.includes(f.question));

  const primaryCta =
    "flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-4 text-base font-black uppercase tracking-wide text-gray-950 shadow-lg shadow-yellow-500/20 transition hover:from-amber-300 hover:to-yellow-400";

  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <header className="border-b border-slate-800 bg-slate-950 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link href="/" className="shrink-0">
            <Image src="/landing_page_logo.png" alt="Storage Network home" width={84} height={32} className="h-8 w-auto" />
          </Link>
          <nav aria-label="Breadcrumb" className="sr-only">
            <ol>
              <li><Link href="/">Home</Link></li>
              <li aria-current="page">DIY Build Plans</li>
            </ol>
          </nav>
          <span className="flex-1" />
          <a href="#my-plans" className="text-xs font-semibold text-stone-400 hover:text-white">
            Already bought? My plans
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4">
        {/* ── Hero: one promise, one price, one button ───────────────── */}
        <section className="pb-8 pt-6">
          <p className="text-[11px] font-black uppercase tracking-widest text-yellow-400">
            DIY tote rack plans · 27-gal HDX &amp; Greenmade
          </p>
          <h1 className="mt-2 text-[28px] font-black leading-[1.1] text-white sm:text-4xl">
            Build any size tote rack. Every plan, {PLANS_PRICES.allAccess} for life.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-stone-300">
            Design it free in 3D. Get the cut list, shopping list and a step-by-step 3D guide for your exact size, plus
            a free plan for every rack you build after it.
          </p>

          <div className="relative mt-5 aspect-[16/10] w-full overflow-hidden rounded-2xl border border-slate-800">
            <Image
              src="/hero-rack.webp"
              alt="Rolling 2×4 tote storage rack, 4 totes wide by 4 high, holding 27-gallon yellow-lid totes on casters"
              fill
              priority
              sizes="(max-width: 672px) 100vw, 640px"
              className="object-cover object-left"
            />
          </div>

          <div id="hero-cta" className="mt-5">
            <Link href="/plans/checkout" className={primaryCta}>
              Design yours free <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
            <p className="mt-2 text-center text-xs text-stone-400">
              Free to design · <strong className="text-white">{PLANS_PRICES.allAccess} once</strong> for unlimited
              plans · instant access
            </p>
          </div>

          <ul className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              [InfinityIcon, "Unlimited plans"],
              [Box, "3D guide + PDF"],
              [ShieldCheck, `${PRO_INSTALLS} pro installs`],
            ].map(([Icon, label]) => {
              const I = Icon as typeof Box;
              return (
                <li key={label as string} className="rounded-xl border border-slate-800 bg-slate-900 px-2 py-2.5">
                  <I className="mx-auto h-4 w-4 text-yellow-400" aria-hidden />
                  <p className="mt-1 text-[11px] font-semibold leading-tight text-stone-200">{label as string}</p>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Bestsellers: the fastest way in ─────────────────────────── */}
        {PLAN_BESTSELLERS.length > 0 && (
          <section className="border-t border-slate-800/80 py-8">
            <h2 className="flex items-center gap-1.5 text-lg font-black text-white">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" aria-hidden />
              Start from a bestseller
            </h2>
            <p className="mt-1 text-sm text-stone-400">One tap opens it in the designer. Change anything you like.</p>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {PLAN_BESTSELLERS.map((b) => (
                <li key={b.preset.id}>
                  <Link
                    href={b.href}
                    className="flex h-full flex-col rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 transition hover:border-yellow-400/60"
                  >
                    <span className="text-sm font-bold text-white">{b.preset.name}</span>
                    <span className="text-xs text-stone-400">{b.totes} totes</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── How it works ─────────────────────────────────────────── */}
        <section className="border-t border-slate-800/80 py-8">
          <h2 className="text-lg font-black text-white">How it works</h2>
          <ol className="mt-4 space-y-4">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-sm font-black text-gray-950">
                  {s.n}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">{s.title}</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-stone-400">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── What you get + the anchor ────────────────────────────── */}
        <section className="border-t border-slate-800/80 py-8">
          <div className="relative overflow-hidden rounded-2xl border border-yellow-400/40 bg-slate-900 p-5">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-yellow-400">{TOTE_PLAN_ALL_ACCESS.name}</p>
                <h2 className="mt-1 text-xl font-black text-white">Everything, for one price</h2>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black leading-none text-white">{PLANS_PRICES.allAccess}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-yellow-400">Once, for life</p>
              </div>
            </div>
            <ul className="mt-4 space-y-3">
              {VALUE.map(([title, text]) => (
                <li key={title} className="flex gap-2.5">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
                  <span>
                    <span className="block text-sm font-bold text-white">{title}</span>
                    <span className="block text-xs text-stone-400">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-xl bg-slate-950/70 px-4 py-3 text-sm leading-relaxed text-stone-300">
              {materialsLine} The plan that gets every cut right is {PLANS_PRICES.allAccess}, and it covers every rack
              after this one too. Most plans cover a single size.
            </p>
            <Link href="/plans/checkout" className={`${primaryCta} mt-4`}>
              Design yours free <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
          </div>
        </section>

        {/* ── See it ───────────────────────────────────────────────── */}
        <section className="border-t border-slate-800/80 py-8">
          <h2 className="text-lg font-black text-white">See exactly what you get</h2>
          <p className="mb-3 mt-1 text-sm text-stone-400">
            The same 3D guide and cut plans our pro installers build from, behind {PRO_INSTALLS} paid installs.
          </p>
          <PlanSamplesRow />
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────── */}
        <section className="border-t border-slate-800/80 py-8">
          <h2 className="mb-3 text-lg font-black text-white">Questions</h2>
          <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900">
            {topFaqs.map((faq) => (
              <details key={faq.question} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-white">
                  <h3>{faq.question}</h3>
                  <ChevronDown className="h-4 w-4 shrink-0 text-stone-500 transition group-open:rotate-180" aria-hidden />
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-stone-400">{faq.answer}</p>
              </details>
            ))}
            <details className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-stone-400">
                <span>More questions and plan specs</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-stone-500 transition group-open:rotate-180" aria-hidden />
              </summary>
              <div className="mt-3 space-y-4">
                {moreFaqs.map((faq) => (
                  <div key={faq.question}>
                    <h3 className="text-sm font-bold text-white">{faq.question}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-stone-400">{faq.answer}</p>
                  </div>
                ))}
                <table className="w-full text-left text-xs">
                  <caption className="mb-2 text-left text-sm font-bold text-white">Tote rack plans at a glance</caption>
                  <tbody className="divide-y divide-slate-800">
                    {AT_A_GLANCE.map(([label, value]) => (
                      <tr key={label}>
                        <th scope="row" className="w-20 py-2 pr-3 align-top font-semibold text-stone-500">{label}</th>
                        <td className="py-2 text-stone-300">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </section>

        {/* ── Last call ────────────────────────────────────────────── */}
        <section className="border-t border-slate-800/80 py-8 text-center">
          <h2 className="text-2xl font-black text-white">Your wall, your size, your plan.</h2>
          <p className="mt-2 text-sm text-stone-400">
            Design it free. {PLANS_PRICES.allAccess} once when you&apos;re ready, and every plan after is on us.
          </p>
          <Link href="/plans/checkout" className={`${primaryCta} mt-5`}>
            Design yours free <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        </section>

        {/* ── Footer: everything that isn't the sale ───────────────── */}
        <footer className="space-y-5 border-t border-slate-800/80 pb-6 pt-8">
          <div id="my-plans" className="scroll-mt-6">
            <ResendLinkPanel />
          </div>
          <div className="text-xs text-stone-500">
            <p className="font-semibold text-stone-400">More DIY plans</p>
            <ul className="mt-1.5 space-y-1">
              {otherPlans.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} className="hover:text-stone-200">
                    <span className="font-semibold text-stone-300">{p.title}</span> · {p.line}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-stone-500">
            <span className="font-semibold text-stone-400">Build these for a living?</span> Storage Network installers get
            pre-sold jobs and instant payouts.{" "}
            <Link href="/join?src=plans" className="font-semibold text-yellow-400 hover:underline">See how installers earn</Link>
          </p>
          <p className="text-[11px] text-stone-600">
            Rather have it built?{" "}
            <Link href="/installer-network" className="text-stone-400 underline hover:text-stone-200">Find a tote rack installer</Link>
            {" · "}Updated{" "}
            <time dateTime={PLANS_UPDATED}>
              {new Date(`${PLANS_UPDATED}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
            </time>
          </p>
        </footer>
      </main>

      <StickyPlanCta
        watchId="hero-cta"
        price={`${PLANS_PRICES.allAccess} for life`}
        note="Unlimited plans · free to design"
        label="Design free"
        href="/plans/checkout"
      />
    </div>
  );
}
