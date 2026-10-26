import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle, ChevronDown, Hammer, Ruler, Wrench } from "lucide-react";
import { formatPlanPrice } from "@/lib/tote-plans";
import { getPlanPage, planPageSlugs } from "@/lib/plan-pages";
import { generateBreadcrumbJsonLd } from "@/lib/schema/breadcrumb";
import { PLANS_PRICES, planPageJsonLd } from "@/lib/schema/plans";
import { BuyPlanButton, ResendLinkPanel } from "@/components/plans/PlansStorefront";

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC PLAN PAGE — /plans/[slug] (e.g. /plans/adirondack-chair)
//
// One server-rendered page per fixed-price plan in PLAN_PAGES. Unknown
// slugs 404 (dynamicParams = false). Checkout is the same /api/plans/checkout
// flow the /plans card uses.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamicParams = false;

export function generateStaticParams() {
  return planPageSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const found = getPlanPage(slug);
  if (!found) return {};
  const { page, plan } = found;
  const path = `/plans/${page.slug}`;
  return {
    title: page.seoTitle,
    description: page.metaDescription,
    keywords: page.keywords,
    alternates: { canonical: path },
    openGraph: {
      title: page.h1,
      description: page.metaDescription,
      url: path,
      type: "website",
      siteName: "Storage Network",
      locale: "en_US",
      images: [{ url: plan.previewImage, alt: `${plan.name} build plan preview` }],
    },
    twitter: {
      card: "summary_large_image",
      title: page.h1,
      description: page.metaDescription,
      images: [plan.previewImage],
    },
  };
}

export default async function PlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = getPlanPage(slug);
  if (!found) notFound();
  const { page, plan } = found;
  const priceDisplay = formatPlanPrice(plan.price);

  const jsonLd = [
    generateBreadcrumbJsonLd([
      { name: "DIY Build Plans", path: "/plans" },
      { name: page.h1, path: `/plans/${page.slug}` },
    ]),
    ...planPageJsonLd(page, plan),
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      {jsonLd.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}

      <header className="border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link href="/plans">
            <Image src="/landing_page_logo.png" alt="Storage Network DIY plans" width={36} height={36} className="rounded" />
          </Link>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">DIY Build Plans</p>
            <p className="text-[10px] text-stone-500">Digital plans · Instant access · Yours forever</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-4 py-8">
        <nav aria-label="Breadcrumb" className="text-[11px] text-stone-600">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-stone-300">Home</Link>
            </li>
            <li aria-hidden>›</li>
            <li>
              <Link href="/plans" className="hover:text-stone-300">DIY Build Plans</Link>
            </li>
            <li aria-hidden>›</li>
            <li aria-current="page" className="text-stone-400">{plan.name}</li>
          </ol>
        </nav>

        {/* ── Hero + buy ─────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-amber-500/20 bg-slate-900">
          <div className="h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />
          <div className="p-6">
            <h1 className="text-2xl font-black text-white sm:text-3xl">{page.h1}</h1>
            <p className="mt-1 text-sm text-stone-400">{plan.tagline}</p>
            <div className="relative mt-5 aspect-[800/589] w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-800">
              <Image
                src={plan.previewImage}
                alt={`Finished ${plan.name} with a white frame and blue-gray back on a stone patio`}
                fill
                priority
                sizes="(max-width: 672px) 100vw, 624px"
                className="object-cover"
              />
            </div>
            <p className="mt-5 text-sm leading-relaxed text-stone-300">{page.intro}</p>
            <ul className="mt-5 space-y-2">
              {plan.includes.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                  <span className="text-sm text-stone-300">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-center gap-2">
              <span className="text-3xl font-black text-yellow-400">{priceDisplay}</span>
              <span className="text-xs text-stone-500">one-time · instant access · permanent link by email</span>
            </div>
            <BuyPlanButton planId={plan.id} priceDisplay={priceDisplay} />
          </div>
        </section>

        {/* ── Materials, tools, parts ────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-xl font-black text-white">Materials, Tools and Parts</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
                <Ruler className="h-4 w-4 text-yellow-400" aria-hidden />
                Lumber
              </h3>
              <ul className="space-y-1 text-xs text-stone-300">
                {page.lumber.map((l) => (
                  <li key={l.name}>
                    ({l.qty}) {l.name}
                  </li>
                ))}
              </ul>
              <h3 className="mb-2 mt-4 flex items-center gap-2 text-sm font-bold text-white">
                <Hammer className="h-4 w-4 text-yellow-400" aria-hidden />
                Hardware
              </h3>
              <ul className="space-y-1 text-xs text-stone-300">
                {page.hardware.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
                <Wrench className="h-4 w-4 text-yellow-400" aria-hidden />
                Tools
              </h3>
              <ul className="space-y-1 text-xs text-stone-300">
                {page.tools.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <caption className="bg-slate-900 px-4 py-2 text-left text-sm font-bold text-white">
                Parts ({page.parts.reduce((s, p) => s + p.qty, 0)} pieces; full dimensions in the plan)
              </caption>
              <thead className="bg-slate-900/60 text-stone-500">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">Part</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Qty</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Cut from</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-stone-300">
                {page.parts.map((p) => (
                  <tr key={p.name}>
                    <td className="px-4 py-2">{p.name}</td>
                    <td className="px-4 py-2">{p.qty}</td>
                    <td className="px-4 py-2">{p.from}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Build steps ────────────────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-xl font-black text-white">How the Build Goes: {page.steps.length} Steps</h2>
          <ol className="grid gap-4 sm:grid-cols-2">
            {page.steps.map((step, i) => (
              <li key={step.title} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
                <div className="relative aspect-[4/3] w-full bg-[#c4c6ca]">
                  <Image src={step.image} alt={step.imageAlt} fill sizes="(max-width: 640px) 100vw, 304px" className="object-contain" />
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-bold text-white">
                    {i + 1}. {step.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-stone-400">{step.summary}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-xl font-black text-white">{plan.name} Plans FAQ</h2>
          <div className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900">
            {page.faqs.map((faq) => (
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

        {/* ── Cross-sell ─────────────────────────────────────────── */}
        <section className="rounded-2xl border border-yellow-400/20 bg-slate-900 p-5">
          <h2 className="text-base font-black text-white">More DIY Plans: Tote Storage Racks</h2>
          <p className="mt-1 text-sm text-stone-400">
            Build a 2×4 tote rack for 27-gallon HDX or Greenmade totes, sized to your wall, with a cut list,
            shopping list and every step in 3D. {PLANS_PRICES.pdf} for the PDF, {PLANS_PRICES.interactive} with the
            interactive guide.
          </p>
          <Link
            href="/plans"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-yellow-400 hover:text-yellow-300"
          >
            See the DIY tote rack plans
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>

        <ResendLinkPanel />
      </main>
    </div>
  );
}
