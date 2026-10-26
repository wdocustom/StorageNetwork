import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Box, ChevronDown, FileText, Star, Wrench } from "lucide-react";
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
// Server-rendered so search engines see the copy, FAQ and structured data;
// only the resend form is a client component. Kept lean: one pitch and a
// CTA up top, facts in the spec table, detail in the collapsed FAQ.
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

// ── At a glance ──────────────────────────────────────────────────────────────
// A plain spec table: the format answer engines quote most readily.

const AT_A_GLANCE: [string, string][] = [
  ["Totes", "27-gal HDX (Home Depot) or Greenmade (Costco)"],
  ["Build", `2×4s · ${BAY_OPENING_IN}" bays · ${UNIT_DEPTH_IN}" deep`],
  ["Size", `Up to ${TOTE_PLAN_LIMITS.maxCols} wide × ${TOTE_PLAN_LIMITS.maxRows} high, ${TOTE_PLAN_LIMITS.maxUnits} units; split into ${MODULE_MAX_COLS}×${MODULE_MAX_ROWS} modules`],
  ["Options", "Casters · plywood worktop"],
  ["Includes", "Cut list · shopping list · every step in 3D"],
];

const TIERS = [
  { tier: TOTE_PLAN_TIERS.pdf, Icon: FileText },
  { tier: TOTE_PLAN_TIERS.interactive, Icon: Box },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PlansPage() {
  const otherPlans = [
    {
      href: "/plans/jig",
      title: `${LADDER_JIG_NAME} Plans`,
      line: `${PLANS_PRICES.jig} · ${PLANS_PRICES.jigOwner} with a tote plan`,
      Icon: Wrench,
    },
    ...PUBLIC_PLANS.map((plan) => ({
      href: planPageHref(plan.id) ?? "/plans",
      title: `${plan.name} Plans`,
      line: `${formatPlanPrice(plan.price)} · ${plan.tagline}`,
      Icon: null,
      image: plan.previewImage,
    })),
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <header className="border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link href="/">
            <Image src="/landing_page_logo.png" alt="Storage Network home" width={32} height={32} className="rounded" />
          </Link>
          <nav aria-label="Breadcrumb" className="flex-1 text-[11px] text-stone-500">
            <ol className="flex items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-stone-300">Home</Link>
              </li>
              <li aria-hidden>›</li>
              <li aria-current="page" className="font-bold text-white">DIY Build Plans</li>
            </ol>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-7 px-4 py-6">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section>
          <h1 className="text-2xl font-black leading-tight text-white sm:text-3xl">
            DIY Tote Rack Plans, Sized to Your Wall
          </h1>
          <p className="mt-2 text-sm text-stone-400">
            A 2×4 rack for 27-gallon HDX or Greenmade totes, any size. Design it free in 3D, get a plan with
            every cut and step.
          </p>
          <div className="relative mt-4 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-slate-800">
            <Image
              src="/hero-rack.webp"
              alt="Rolling 2×4 tote storage rack, 4 totes wide by 4 high, holding 27-gallon yellow-lid totes on casters"
              fill
              priority
              sizes="(max-width: 672px) 100vw, 640px"
              className="object-cover object-left"
            />
          </div>
          <Link
            href="/plans/checkout"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:from-amber-300 hover:to-yellow-400"
          >
            Design Yours &amp; Get Plans
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {TIERS.map(({ tier, Icon }) => (
              <div key={tier.id} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-yellow-400" aria-hidden />
                  <h2 className="text-xs font-bold text-white">{tier.name}</h2>
                </div>
                <p className="mt-0.5 text-lg font-black text-yellow-400">{formatPlanPrice(tier.price)}</p>
                <p className="text-[11px] text-stone-500">{tier.tagline}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] text-stone-600">
            One-time · permanent link by email · PDF owners upgrade for {PLANS_PRICES.upgrade}
          </p>
        </section>

        {/* ── Bestsellers ────────────────────────────────────────── */}
        {PLAN_BESTSELLERS.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-black text-white">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" aria-hidden />
              Start From a Bestseller
            </h2>
            <ul className="flex flex-wrap gap-2">
              {PLAN_BESTSELLERS.map((b) => (
                <li key={b.preset.id}>
                  <Link
                    href={b.href}
                    className="block rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-stone-300 transition hover:border-yellow-400/60 hover:text-white"
                  >
                    <span className="font-bold text-white">{b.preset.name}</span> · {b.totes} totes
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── At a glance ────────────────────────────────────────── */}
        <section>
          <h2 className="mb-2 text-sm font-black text-white">Tote Rack Plans at a Glance</h2>
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-slate-800">
                {AT_A_GLANCE.map(([label, value]) => (
                  <tr key={label}>
                    <th scope="row" className="w-20 bg-slate-900/60 px-3 py-2 align-top font-semibold text-stone-500">
                      {label}
                    </th>
                    <td className="px-3 py-2 text-stone-200">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── More plans ─────────────────────────────────────────── */}
        <section>
          <h2 className="mb-2 text-sm font-black text-white">More DIY Plans</h2>
          <div className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            {otherPlans.map((p) => (
              <Link key={p.href} href={p.href} className="group flex items-center gap-3 px-3 py-3 transition hover:bg-slate-800/60">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-emerald-400/10">
                  {"image" in p && p.image ? (
                    <Image src={p.image} alt="" fill sizes="40px" className="object-cover" />
                  ) : p.Icon ? (
                    <p.Icon className="h-5 w-5 text-emerald-400" aria-hidden />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold text-white">{p.title}</h3>
                  <p className="truncate text-[11px] text-stone-500">{p.line}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-stone-500 transition group-hover:translate-x-0.5 group-hover:text-yellow-400" aria-hidden />
              </Link>
            ))}
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-2 text-sm font-black text-white">Tote Rack Plans FAQ</h2>
          <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900">
            {PLANS_FAQS.map((faq) => (
              <details key={faq.question} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold text-white">
                  <h3>{faq.question}</h3>
                  <ChevronDown className="h-4 w-4 shrink-0 text-stone-500 transition group-open:rotate-180" aria-hidden />
                </summary>
                <p className="mt-2 text-xs leading-relaxed text-stone-400">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <ResendLinkPanel />

        <p className="pb-2 text-center text-[11px] text-stone-600">
          Rather have it built?{" "}
          <Link href="/design" className="text-stone-400 underline hover:text-stone-200">Design it in 3D</Link> and{" "}
          <Link href="/installer-network" className="text-stone-400 underline hover:text-stone-200">
            find a tote rack installer
          </Link>
          {" · "}
          <Link href="/invite" className="text-stone-400 underline hover:text-stone-200">Installers: join</Link>
          {" · "}Updated{" "}
          <time dateTime={PLANS_UPDATED}>
            {new Date(`${PLANS_UPDATED}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
          </time>
        </p>
      </main>
    </div>
  );
}
