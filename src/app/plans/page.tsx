import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Box, CheckCircle, ChevronDown, FileText, Infinity as InfinityIcon, Star, Wrench } from "lucide-react";
import { BuildForALiving } from "@/components/plans/AllAccessOffer";
import { PUBLIC_PLANS } from "@/lib/plans-config";
import {
  BAY_OPENING_IN,
  MODULE_MAX_COLS,
  MODULE_MAX_ROWS,
  TOTE_PLAN_LIMITS,
  TOTE_PLAN_ALL_ACCESS,
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

// ── At a glance ──────────────────────────────────────────────────────────────
// A plain spec table: the format answer engines quote most readily.

const AT_A_GLANCE: [string, string][] = [
  ["Totes", "27-gal HDX (Home Depot) or Greenmade (Costco)"],
  ["Build", `2×4s · ${BAY_OPENING_IN}" bays · ${UNIT_DEPTH_IN}" deep`],
  ["Size", `Up to ${TOTE_PLAN_LIMITS.maxCols} wide × ${TOTE_PLAN_LIMITS.maxRows} high, ${TOTE_PLAN_LIMITS.maxUnits} units; split into ${MODULE_MAX_COLS}×${MODULE_MAX_ROWS} modules`],
  ["Options", "Casters · plywood worktop"],
  ["Includes", "Cut list · shopping list · every step in 3D"],
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
            every cut and step, and one price covers every size you&apos;ll ever build.
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
          {/* ── All-Access: the one plan product ── */}
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-yellow-400/40 bg-slate-900 p-4 sm:p-5">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-yellow-400">
                  <InfinityIcon className="h-4 w-4" aria-hidden /> Unlimited plans · lifetime
                </p>
                <h2 className="mt-1 text-lg font-black text-white">{TOTE_PLAN_ALL_ACCESS.name}</h2>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-3xl font-black leading-none text-white">{PLANS_PRICES.allAccess}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-yellow-400">Once, for life</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-stone-300">
              Most plans cover one size. All-Access covers <strong className="text-white">every tote organizer you
              design</strong>: buy once, then build another plan whenever you need one, free. Your garage today, the
              shed next spring, a friend&apos;s basement after that.
            </p>
            <ul className="mt-3 grid gap-1.5 text-xs text-stone-300 sm:grid-cols-2">
              {[
                ["Unlimited plans, any size", InfinityIcon],
                ["Interactive 3D build guide", Box],
                ["Printable PDF for every plan", FileText],
                ["One payment, no subscription", CheckCircle],
              ].map(([label, Icon]) => {
                const I = Icon as typeof Box;
                return (
                  <li key={label as string} className="flex items-center gap-1.5">
                    <I className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                    {label as string}
                  </li>
                );
              })}
            </ul>
          </div>
          <Link
            href="/plans/checkout"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:from-amber-300 hover:to-yellow-400"
          >
            Design Yours &amp; Get All-Access — {PLANS_PRICES.allAccess}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <p className="mt-2 text-center text-[11px] text-stone-600">
            Designing is free · {PLANS_PRICES.allAccess} once for every plan, for life · permanent link by email
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

        <BuildForALiving />

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
