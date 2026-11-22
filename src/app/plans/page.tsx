import PlanReviewsSection, { PlanRatingLine } from "@/components/plans/PlanReviewsSection";
import { getPlanReviews, type PlanReviewsData } from "@/app/actions/plan-reviews";
import { summarizeRatings } from "@/lib/reviews";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Gift } from "lucide-react";
import PlanSamplesRow from "@/components/plans/PlanSamplesRow";
import StickyPlanCta from "@/components/plans/StickyPlanCta";
import { estimatePlanMaterials } from "@/app/actions/plan-materials";
import { PUBLIC_PLANS } from "@/lib/plans-config";
import {
  BAY_OPENING_IN,
  MODULE_MAX_COLS,
  MODULE_MAX_ROWS,
  TOTE_PLAN_LIMITS,
  DEFAULT_TOTE_PLAN_DESIGN,
  UNIT_DEPTH_IN,
  decodeTotePlanDesign,
} from "@/lib/tote-plans";
import { MINI } from "@/lib/mini-rack";
import { LADDER_JIG_NAME } from "@/lib/ladder-jig";
import { generateBreadcrumbJsonLd } from "@/lib/schema/breadcrumb";
import { planPageHref } from "@/lib/plan-pages";
import {
  PLANS_FAQS,
  PLANS_PRICES,
  ladderJigProductJsonLd,
  miniPlansProductJsonLd,
  PLANS_UPDATED,
  plansFaqJsonLd,
  plansWebPageJsonLd,
  publicPlanProductsJsonLd,
  totePlansProductJsonLd,
} from "@/lib/schema/plans";
import { ResendLinkPanel } from "@/components/plans/PlansStorefront";
import GiftSection from "@/components/plans/GiftSection";
import { GIFT_FLAT_EACH, GIFT_FLAT_FROM, giftPriceLabel, giftTotalCents } from "@/lib/plan-gifts";

// ═══════════════════════════════════════════════════════════════════════════
// DIY PLANS STOREFRONT — /plans
//
// The landing page for plan ads (≈90% phones, mostly Facebook). Its one
// job: a tap into a designer. Two products, one page:
//   • Full-size Tote Rack Plans — 27-gallon totes, 2×4 frame ($19)
//   • Mini Tote Rack Plans — HDX 6.5 qt totes, 2×3 + plywood ($12)
// "Every size, for life" is a promise PER SYSTEM (each covers every size of
// its own rack), so the page leads with "plans from $12", lets the visitor
// pick their tote in one glance (two cards), and states each product's
// price and coverage right on its card. Then how it works, what every plan
// includes (with a lumber-cost anchor for each), samples, gift, questions,
// a close. Calm and short: one type scale, lots of space. A sticky bar
// keeps a button in reach. Server-rendered for SEO; every FAQ stays on the
// page and in the structured data.
// ═══════════════════════════════════════════════════════════════════════════

const TITLE = "DIY Tote Rack Plans for 27-Gallon & 6.5 Qt Mini Totes | Storage Network";
const DESCRIPTION = `Tote rack plans sized to your wall, from ${PLANS_PRICES.from}: full-size 2×4 racks for 27-gallon totes (${PLANS_PRICES.allAccess}) and Mini racks for HDX 6.5 qt totes (${PLANS_PRICES.mini}). Cut list, shopping list and every step in 3D, plus a printable PDF. Pay once: every size of your rack, for life.`;

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
    "mini tote rack plans",
    "6.5 qt tote rack plans",
    "shoebox tote storage rack",
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

// Reviews are re-read at most hourly (ISR).
export const revalidate = 3600;

const EMPTY_REVIEWS: PlanReviewsData = { summary: summarizeRatings([]), reviews: [] };

// ── Proof ────────────────────────────────────────────────────────────────────
// Paid jobs completed by Storage Network installers with the same build
// system (73 on Nov 12, 2026: leads paid/completed). A floor, rounded down
// so it stays true; raise it as the network grows.
const PRO_INSTALLS = "70+";

// ── At a glance ──────────────────────────────────────────────────────────────
// A plain spec table: the format answer engines quote most readily. Shown
// collapsed under the FAQ.

const AT_A_GLANCE: [string, string][] = [
  ["Full-size", `27-gallon totes · 2×4s · ${BAY_OPENING_IN}" bays · ${UNIT_DEPTH_IN}" deep · casters, worktop, sideways · ${PLANS_PRICES.allAccess}`],
  ["Mini", `HDX 6.5 qt totes · 2×3s + plywood · ${MINI.opening}" bays · ${MINI.depth}" deep · top, sideways · ${PLANS_PRICES.mini}`],
  ["Size", `Full-size up to ${TOTE_PLAN_LIMITS.maxCols} wide × ${TOTE_PLAN_LIMITS.maxRows} high, ${TOTE_PLAN_LIMITS.maxUnits} units (${MODULE_MAX_COLS}×${MODULE_MAX_ROWS} modules); mini up to ${TOTE_PLAN_LIMITS.maxRowsMini} high`],
  ["Includes", "Cut list · shopping list · every step in 3D · printable PDF"],
];

// The questions buyers actually hesitate on, shown open to read; the rest
// (still in the FAQ structured data) sit under "More questions".
const TOP_FAQ_QUESTIONS = [
  "What's the difference between the full-size and Mini plans?",
  "Can I make plans for more than one size?",
  "What totes do these tote rack plans fit?",
  "How do I get my plans after I buy?",
];

const STEPS = [
  { title: "Design it", text: "Pick your totes, set the size and options. Free, in 3D." },
  { title: "Get the plan", text: "Cut list, shopping list and every step. Instantly." },
  { title: "Build it", text: "Follow the 3D guide on your phone, or print the PDF." },
];

const INCLUDED = [
  "A plan for every size of your rack, for life",
  "Interactive 3D build guide",
  "Printable PDF with cut list & shopping list",
  "One payment, no subscription",
];

/** The two products, as the "Pick your rack" cards show them. */
const PRODUCTS = [
  {
    key: "full",
    name: "Full-size Tote Rack",
    totes: "27-gallon totes",
    fit: "HDX, Greenmade & most brands",
    price: PLANS_PRICES.allAccess,
    priceNote: "once, every full-size rack",
    points: ["2×4 frame for garages, sheds & basements", "Casters, worktop or a shallow sideways build"],
    href: "/plans/checkout",
    cta: "Design a full-size rack",
  },
  {
    key: "mini",
    name: "Mini Tote Rack",
    totes: "6.5 qt mini totes",
    fit: "HDX 6.5 qt clear totes",
    price: PLANS_PRICES.mini,
    priceNote: `once, every mini rack · ${PLANS_PRICES.miniOwner} for full-size owners`,
    points: ["2×3 & plywood frame for closets, craft rooms & shops", "Wall-height or tabletop, with an optional top"],
    href: "/plans/mini?utm_source=plans_card",
    cta: "Design a mini rack",
  },
] as const;

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function PlansPage() {
  // What lumber for a 4×4 of each costs at retail: the price anchors.
  const [materials, miniMaterials, reviews, toteReviews, miniReviews] = await Promise.all([
    estimatePlanMaterials(DEFAULT_TOTE_PLAN_DESIGN).catch(() => null),
    estimatePlanMaterials(decodeTotePlanDesign("M4x4t")).catch(() => null),
    getPlanReviews({ limit: 24 }).catch(() => EMPTY_REVIEWS),
    getPlanReviews({ product: "tote", limit: 5 }).catch(() => EMPTY_REVIEWS),
    getPlanReviews({ product: "mini", limit: 5 }).catch(() => EMPTY_REVIEWS),
  ]);
  const jsonLd = [
    plansWebPageJsonLd(DESCRIPTION),
    generateBreadcrumbJsonLd([{ name: "DIY Build Plans", path: "/plans" }]),
    totePlansProductJsonLd(toteReviews),
    miniPlansProductJsonLd(miniReviews),
    ladderJigProductJsonLd(),
    ...publicPlanProductsJsonLd(),
    plansFaqJsonLd(),
  ];
  const lumber = materials ? `$${Math.round(materials.materialsTotal / 10) * 10}` : null;
  const miniLumber = miniMaterials ? `$${Math.round(miniMaterials.materialsTotal / 10) * 10}` : null;

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
        <div className="flex items-center gap-5">
          <a href="#gift" className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-white">
            <Gift className="h-4 w-4" aria-hidden /> Gift
          </a>
          <a href="#my-plans" className="text-sm text-stone-400 hover:text-white">
            My plans
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="pb-12 pt-8">
          <h1 className="text-[34px] font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl">
            Tote racks, sized
            <br className="sm:hidden" /> to your wall.
            <br />
            <span className="text-yellow-400">Plans from {PLANS_PRICES.from}.</span>
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-stone-400">
            Design it free in 3D, then build it step by step. Pay once and every size of your rack is yours for life.
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
              Free to design · {PLANS_PRICES.allAccess} for 27-gallon totes · {PRO_INSTALLS} pro installs
            </p>
            <p className="mt-1.5 text-center">
              <PlanRatingLine data={reviews} href="#reviews" />
            </p>
            <p className="mt-1.5 text-center text-sm">
              <Link href="/plans/mini?utm_source=plans_hero" className="font-semibold text-yellow-300 hover:underline">
                Smaller totes? Mini racks for 6.5 qt, {PLANS_PRICES.mini} →
              </Link>
            </p>
          </div>
        </section>

        {/* ── Pick your rack: the two products ───────────────────────── */}
        <section id="pick" className="scroll-mt-4 border-t border-white/5 py-14">
          <p className={eyebrow}>Pick your rack</p>
          <h2 className={h2}>Two sizes of totes. One way to build.</h2>
          <p className="mt-2 text-[15px] text-stone-400">
            Each plan covers every size of its rack, for life. Buy the one that fits your totes.
          </p>
          <div className="mt-7 grid gap-4">
            {PRODUCTS.map((p) => (
              <article key={p.key} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-xl font-extrabold tracking-tight text-white">{p.name}</h3>
                      <p className="mt-0.5 text-sm font-semibold text-yellow-400">{p.totes}</p>
                      <p className="text-xs text-stone-500">{p.fit}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-3xl font-extrabold leading-none text-white">{p.price}</p>
                    </div>
                  </div>
                  <p className="mt-1 text-right text-[11px] text-stone-500">{p.priceNote}</p>
                  <ul className="mt-4 space-y-2">
                    {p.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2.5 text-[15px] text-stone-300">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" strokeWidth={3} aria-hidden />
                        {pt}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={p.href}
                    className={
                      p.key === "full"
                        ? `${cta} mt-5`
                        : "mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-yellow-400/50 py-4 text-base font-extrabold text-yellow-300 transition hover:bg-yellow-400/10 active:scale-[0.99]"
                    }
                  >
                    {p.cta} <ArrowRight className="h-5 w-5" aria-hidden />
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-stone-500">
            Bays are universal for their tote size. Double-check your totes&apos; measurements before you build.
          </p>
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

        {/* ── What you get (both plans) ───────────────────────────── */}
        <section className="border-t border-white/5 py-14">
          <p className={eyebrow}>Every plan includes</p>
          <h2 className={h2}>Everything to build it right the first time.</h2>
          <ul className="mt-7 space-y-3.5">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-center gap-3 text-base text-stone-200">
                <Check className="h-5 w-5 shrink-0 text-yellow-400" strokeWidth={3} aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          {(lumber || miniLumber) && (
            <p className="mt-7 text-[15px] leading-relaxed text-stone-400">
              The lumber for a 4×4 {lumber ? <>full-size rack is about {lumber}</> : null}
              {lumber && miniLumber ? "; for a 4×4 mini, about " : miniLumber ? "mini rack is about " : ""}
              {miniLumber}. The plan that gets every cut right is a one-time {PLANS_PRICES.allAccess} ({PLANS_PRICES.mini} for mini),
              and it covers every rack of that kind you build after it.
            </p>
          )}
          <a href="#pick" className={`${cta} mt-8`}>
            Pick your rack <ArrowRight className="h-5 w-5" aria-hidden />
          </a>
        </section>

        {/* ── See it ───────────────────────────────────────────────── */}
        <section className="border-t border-white/5 py-14">
          <p className={eyebrow}>See it</p>
          <h2 className={h2}>The guide our pros build from.</h2>
          <p className="mb-6 mt-2 text-[15px] text-stone-400">Tap a sample to look inside.</p>
          <PlanSamplesRow />
        </section>

        {/* ── Reviews (verified buyers) ────────────────────────────── */}
        <PlanReviewsSection data={reviews} eyebrow={eyebrow} h2={h2} />

        {/* ── Gift it ──────────────────────────────────────────────── */}
        <GiftSection>
          <p className={eyebrow}>Give it as a gift</p>
          <h2 className={h2}>Know someone with a garage full of piles?</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-stone-400">
            Send the full-size (27-gallon) plans to one person or a whole crew. Each gets their own email, their own link
            and lifetime access: every full-size rack they design, the 3D guide and the printable PDF.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-stone-300">
            <span className="font-bold text-emerald-300">Volume discounts:</span> {PLANS_PRICES.allAccess} for one, 3 for{" "}
            {giftPriceLabel(giftTotalCents(3))}, 5 for {giftPriceLabel(giftTotalCents(5))}, 7 for{" "}
            {giftPriceLabel(giftTotalCents(7))}, and {GIFT_FLAT_FROM}+ at just {giftPriceLabel(GIFT_FLAT_EACH)} each.
          </p>
        </GiftSection>

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
          <p className="mt-3 text-[15px] text-stone-400">
            Free to design. Plans from {PLANS_PRICES.from}, every size of your rack for life.
          </p>
          <Link href="/plans/checkout" className={`${cta} mt-8`}>
            Design a full-size rack <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
          <Link href="/plans/mini?utm_source=plans_close" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-yellow-300 hover:underline">
            Or a mini rack for 6.5 qt totes, {PLANS_PRICES.mini} <ArrowRight className="h-4 w-4" aria-hidden />
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
            <Link href="/plans/mini?utm_source=plans_nav" className="hover:text-stone-200">Mini tote rack (6.5 qt)</Link>
            <a href="#gift" className="hover:text-stone-200">Gift plans</a>
            <Link href="/installer-network" className="hover:text-stone-200">Find an installer</Link>
            <Link href="/join?src=plans" className="hover:text-stone-200">Build these for a living</Link>
            <Link href="/refund-rules" className="hover:text-stone-200">Holiday refund giveaway – Official Rules</Link>
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
        quietId="gift"
        price={`From ${PLANS_PRICES.from}`}
        note="Free to design · every size, for life"
        label="Pick your rack"
        href="#pick"
      />
    </div>
  );
}
