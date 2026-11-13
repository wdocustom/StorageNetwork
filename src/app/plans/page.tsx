import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
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
} from "@/lib/tote-plans";
import { LADDER_JIG_NAME } from "@/lib/ladder-jig";
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
import { ResendLinkPanel } from "@/components/plans/PlansStorefront";
import HolidayWreath from "@/components/plans/HolidayWreath";

// ═══════════════════════════════════════════════════════════════════════════
// DIY PLANS STOREFRONT — /plans
//
// The landing page for plan ads (≈90% phones, mostly Facebook). Its one
// job: a tap on "Design your rack". (Not "…free": with $19 on the page that
// reads as a bait-and-switch. The line under the button says it plainly.) Calm and short on purpose: a two-line
// promise, the photo and the button; how it works in three lines; the
// offer with the lumber-cost anchor; the samples; four questions; a close.
// No competing choices (bestsellers live inside the designer), boxes kept
// to a minimum, one type scale, lots of space. A sticky bar keeps the
// button in reach once the hero's scrolls away. Server-rendered for SEO;
// every FAQ stays on the page and in the structured data.
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
  "Can I make plans for more than one size?",
  "What totes do these tote rack plans fit?",
  "What tools do I need to build it?",
  "How do I get my plans after I buy?",
];

const STEPS = [
  { title: "Design it", text: "Set the size, totes and options. Free, in 3D." },
  { title: "Get the plan", text: "Cut list, shopping list and every step. Instantly." },
  { title: "Build it", text: "Follow the 3D guide on your phone, or print the PDF." },
];

const INCLUDED = [
  "Plans for every size you design",
  "Interactive 3D build guide",
  "Printable PDF with cut list",
  "Lifetime access, no subscription",
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function PlansPage() {
  // What lumber for the default 4×4 costs at retail: the price anchor.
  const materials = await estimatePlanMaterials(DEFAULT_TOTE_PLAN_DESIGN).catch(() => null);
  const lumber = materials ? `$${Math.round(materials.materialsTotal / 10) * 10}` : null;

  const otherPlans = [
    { href: "/plans/jig", title: `${LADDER_JIG_NAME} Plans` },
    ...PUBLIC_PLANS.map((plan) => ({ href: planPageHref(plan.id) ?? "/plans", title: `${plan.name} Plans` })),
  ];
  const topFaqs = TOP_FAQ_QUESTIONS.map((q) => PLANS_FAQS.find((f) => f.question === q)).filter(
    (f): f is (typeof PLANS_FAQS)[number] => !!f
  );
  const moreFaqs = PLANS_FAQS.filter((f) => !TOP_FAQ_QUESTIONS.includes(f.question));

  const cta =
    "flex w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 py-4 text-base font-extrabold text-gray-950 transition hover:bg-yellow-300 active:scale-[0.99]";
  const eyebrow = "text-xs font-bold uppercase tracking-[0.18em] text-yellow-400";
  const h2 = "mt-2 text-2xl font-extrabold tracking-tight text-white";

  return (
    <div className="min-h-screen bg-slate-950 pb-24 text-stone-300 antialiased">
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <header className="mx-auto flex max-w-xl items-center justify-between px-5 pt-5">
        <Link href="/" aria-label="Storage Network home">
          <Image src="/landing_page_logo.png" alt="Storage Network" width={84} height={32} className="h-8 w-auto" />
        </Link>
        <nav aria-label="Breadcrumb" className="sr-only">
          <ol>
            <li><Link href="/">Home</Link></li>
            <li aria-current="page">DIY Build Plans</li>
          </ol>
        </nav>
        <a href="#my-plans" className="text-sm text-stone-400 hover:text-white">
          My plans
        </a>
      </header>

      <main className="mx-auto max-w-xl px-5">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="pb-14 pt-8">
          <h1 className="text-[34px] font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl">
            Any size tote rack.
            <br />
            <span className="text-yellow-400">
              Every plan, <br className="sm:hidden" />
              {PLANS_PRICES.allAccess} for life.
            </span>
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-stone-400">
            Size it to your wall. Build it with a step-by-step 3D guide.
          </p>

          <div className="relative mt-7 aspect-[4/3] w-full overflow-hidden rounded-3xl">
            <Image
              src="/hero-rack.webp"
              alt="Rolling 2×4 tote storage rack, 4 totes wide by 4 high, holding 27-gallon yellow-lid totes on casters"
              fill
              priority
              sizes="(max-width: 576px) 100vw, 576px"
              className="object-cover object-left"
            />
          </div>

          <div id="hero-cta" className="mt-7">
            <Link href="/plans/checkout" className={cta}>
              Design your rack <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
            <p className="mt-3 text-center text-sm text-stone-400">
              Free to design. {PLANS_PRICES.allAccess} for the plans, for life.
            </p>
            <p className="mt-1 text-center text-xs text-stone-500">
              For 27-gallon HDX &amp; Greenmade totes · {PRO_INSTALLS} pro installs
            </p>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────── */}
        <section className="border-t border-white/5 py-14">
          <p className={eyebrow}>How it works</p>
          <h2 className={h2}>Three steps to a finished rack.</h2>
          <ol className="mt-8 space-y-7">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="text-3xl font-extrabold leading-none text-yellow-400/90 tabular-nums">{i + 1}</span>
                <div>
                  <h3 className="text-base font-bold text-white">{s.title}</h3>
                  <p className="mt-1 text-[15px] text-stone-400">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── The offer ────────────────────────────────────────────── */}
        <section className="border-t border-white/5 py-14">
          <p className={eyebrow}>{TOTE_PLAN_ALL_ACCESS.name}</p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="relative inline-block text-6xl font-extrabold tracking-tight text-white">
              {PLANS_PRICES.allAccess}
              {/* Holiday pricing: a wreath hooked over the top of the 9, hanging down its side */}
              <HolidayWreath className="absolute left-[calc(100%-27px)] top-[-3px] h-[40px] w-[40px]" />
            </span>
            <span className="ml-6 text-base text-stone-400">once, for life</span>
          </div>
          <ul className="mt-7 space-y-3.5">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-center gap-3 text-base text-stone-200">
                <Check className="h-5 w-5 shrink-0 text-yellow-400" strokeWidth={3} aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-7 text-[15px] leading-relaxed text-stone-400">
            {lumber ? <>The lumber for a 4×4 rack is about {lumber}. </> : null}
            The plan that gets every cut right is {PLANS_PRICES.allAccess}, and it covers every rack you build
            after it.
          </p>
          <Link href="/plans/checkout" className={`${cta} mt-8`}>
            Design your rack <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        </section>

        {/* ── See it ───────────────────────────────────────────────── */}
        <section className="border-t border-white/5 py-14">
          <p className={eyebrow}>See it</p>
          <h2 className={h2}>The guide our pros build from.</h2>
          <p className="mb-6 mt-2 text-[15px] text-stone-400">Tap a sample to look inside.</p>
          <PlanSamplesRow />
        </section>

        {/* ── Questions ────────────────────────────────────────────── */}
        <section className="border-t border-white/5 py-14">
          <p className={eyebrow}>Questions</p>
          <div className="mt-4 divide-y divide-white/5">
            {topFaqs.map((faq) => (
              <details key={faq.question} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-white">
                  <h3>{faq.question}</h3>
                  <ChevronDown className="h-5 w-5 shrink-0 text-stone-500 transition group-open:rotate-180" aria-hidden />
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-stone-400">{faq.answer}</p>
              </details>
            ))}
            <details className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-stone-400">
                <span>More questions</span>
                <ChevronDown className="h-5 w-5 shrink-0 text-stone-500 transition group-open:rotate-180" aria-hidden />
              </summary>
              <div className="mt-4 space-y-5">
                {moreFaqs.map((faq) => (
                  <div key={faq.question}>
                    <h3 className="text-[15px] font-semibold text-white">{faq.question}</h3>
                    <p className="mt-1 text-[15px] leading-relaxed text-stone-400">{faq.answer}</p>
                  </div>
                ))}
                <table className="w-full text-left text-sm">
                  <caption className="mb-2 text-left text-[15px] font-semibold text-white">Plan specs</caption>
                  <tbody className="divide-y divide-white/5">
                    {AT_A_GLANCE.map(([label, value]) => (
                      <tr key={label}>
                        <th scope="row" className="w-20 py-2 pr-3 align-top font-medium text-stone-500">{label}</th>
                        <td className="py-2 text-stone-300">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </section>

        {/* ── Close ────────────────────────────────────────────────── */}
        <section className="border-t border-white/5 py-16 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Build it right the first time.</h2>
          <p className="mt-3 text-[15px] text-stone-400">Free to design. {PLANS_PRICES.allAccess} for every plan you&apos;ll ever need.</p>
          <Link href="/plans/checkout" className={`${cta} mt-8`}>
            Design your rack <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        </section>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <footer className="space-y-6 border-t border-white/5 pb-8 pt-10 text-sm text-stone-500">
          <details id="my-plans" className="group scroll-mt-6">
            <summary className="cursor-pointer list-none font-semibold text-stone-300 hover:text-white">
              Already bought? Get your plan link
            </summary>
            <div className="mt-4">
              <ResendLinkPanel />
            </div>
          </details>
          <nav aria-label="More plans" className="flex flex-wrap gap-x-5 gap-y-2">
            {otherPlans.map((p) => (
              <Link key={p.href} href={p.href} className="hover:text-stone-200">
                {p.title}
              </Link>
            ))}
            <Link href="/installer-network" className="hover:text-stone-200">Find an installer</Link>
            <Link href="/join?src=plans" className="hover:text-stone-200">Build these for a living</Link>
          </nav>
          <p className="text-xs text-stone-600">
            © Storage Network · Updated{" "}
            <time dateTime={PLANS_UPDATED}>
              {new Date(`${PLANS_UPDATED}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
            </time>
          </p>
        </footer>
      </main>

      <StickyPlanCta
        watchId="hero-cta"
        price={`${PLANS_PRICES.allAccess} for life`}
        note="Free to design"
        label="Start designing"
        href="/plans/checkout"
      />
    </div>
  );
}
