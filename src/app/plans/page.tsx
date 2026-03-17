import type { Metadata } from "next";
import Link from "next/link";
import { PLAN_CATALOG, type PlanCatalogItem } from "@/lib/plans";

// ═══════════════════════════════════════════════════════════════════════════
// SEO Metadata
// ═══════════════════════════════════════════════════════════════════════════

export const metadata: Metadata = {
  title: "DIY Build Plans | Tote Storage Organizer | Storage Network",
  description:
    "Comprehensive, printable DIY build plans for 27-gallon tote organizer systems. Cut lists, shopping lists, step-by-step assembly instructions, and dimensional drawings. Build your own storage — no installer needed.",
  keywords: [
    "DIY tote storage plans",
    "tote organizer build plans",
    "27 gallon tote rack plans",
    "garage storage DIY",
    "2x4 tote rack instructions",
    "printable cut list",
    "tote shelf plans",
  ],
  alternates: { canonical: "/plans" },
  openGraph: {
    title: "DIY Tote Organizer Build Plans",
    description:
      "Professional-grade build plans for 27-gallon tote storage systems. Shopping lists, cut diagrams, and step-by-step instructions.",
    type: "website",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Skill Badge
// ═══════════════════════════════════════════════════════════════════════════

function SkillBadge({ skill }: { skill: PlanCatalogItem["skill"] }) {
  const colors = {
    beginner: "bg-green-500/20 text-green-400 border-green-500/30",
    intermediate: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    advanced: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[skill]}`}>
      {skill.charAt(0).toUpperCase() + skill.slice(1)}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Plan Card
// ═══════════════════════════════════════════════════════════════════════════

function PlanCard({ plan }: { plan: PlanCatalogItem }) {
  const optionTags: string[] = [];
  if (plan.config.hasWheels) optionTags.push("Casters");
  if (plan.config.hasTop) optionTags.push("Worktop");
  if (plan.config.orientation === "sideways") optionTags.push("Sideways");
  if (plan.config.toteType === "GM") optionTags.push("Costco/GM");

  return (
    <Link
      href={`/plans/${plan.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-700/60 bg-slate-800/60 transition-all hover:border-blue-500/50 hover:bg-slate-800/80 hover:shadow-lg hover:shadow-blue-500/5"
    >
      {plan.featured && (
        <div className="absolute right-3 top-3 rounded-full bg-blue-500 px-2.5 py-0.5 text-xs font-bold text-white">
          Most Popular
        </div>
      )}

      {/* ── Visual: Grid representation ── */}
      <div className="flex items-center justify-center bg-slate-900/50 px-6 py-8">
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${plan.config.cols}, 1fr)`,
            gridTemplateRows: `repeat(${plan.config.rows}, 1fr)`,
          }}
        >
          {Array.from({ length: plan.toteCount }).map((_, i) => (
            <div
              key={i}
              className="h-6 w-10 rounded-sm border border-slate-600 bg-slate-700/80 transition-colors group-hover:border-blue-500/40 group-hover:bg-blue-900/30 sm:h-7 sm:w-12"
            />
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-white group-hover:text-blue-400">
            {plan.name}
          </h3>
          <span className="shrink-0 text-lg font-bold text-blue-400">
            ${plan.price}
          </span>
        </div>

        <p className="text-sm leading-relaxed text-slate-400">
          {plan.description}
        </p>

        {/* ── Stats row ── */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>{plan.toteCount} totes</span>
          <span className="text-slate-700">|</span>
          <span>~{plan.buildTimeHours}h build</span>
          <span className="text-slate-700">|</span>
          <SkillBadge skill={plan.skill} />
        </div>

        {/* ── Dimension chips ── */}
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded bg-slate-700/60 px-2 py-0.5 text-xs text-slate-400">
            {plan.approxDimensions.width} W
          </span>
          <span className="rounded bg-slate-700/60 px-2 py-0.5 text-xs text-slate-400">
            {plan.approxDimensions.height} H
          </span>
          <span className="rounded bg-slate-700/60 px-2 py-0.5 text-xs text-slate-400">
            {plan.approxDimensions.depth} D
          </span>
          {optionTags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Plans Page
// ═══════════════════════════════════════════════════════════════════════════

export default function PlansPage() {
  const featured = PLAN_CATALOG.filter((p) => p.featured);
  const beginner = PLAN_CATALOG.filter((p) => p.skill === "beginner");
  const intermediate = PLAN_CATALOG.filter((p) => p.skill === "intermediate" && !p.featured);
  const advanced = PLAN_CATALOG.filter((p) => p.skill === "advanced");

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* ── Hero ── */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          DIY Build Plans
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
          Professional-grade build plans for 27-gallon tote organizer systems.
          Complete shopping lists, cut diagrams, and step-by-step assembly
          instructions — everything you need to build your own.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            Printable PDF-ready
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            Cut list + shopping list
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            Step-by-step with pro tips
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            Exact dimensions for your tote brand
          </span>
        </div>
      </div>

      {/* ── Featured ── */}
      {featured.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-bold text-white">Most Popular</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((plan) => (
              <PlanCard key={plan.slug} plan={plan} />
            ))}
          </div>
        </section>
      )}

      {/* ── Beginner ── */}
      {beginner.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-2 text-2xl font-bold text-white">Starter Plans</h2>
          <p className="mb-6 text-sm text-slate-400">
            First-time builders start here. Minimal cuts, small footprint, big impact.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {beginner.map((plan) => (
              <PlanCard key={plan.slug} plan={plan} />
            ))}
          </div>
        </section>
      )}

      {/* ── Intermediate ── */}
      {intermediate.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-2 text-2xl font-bold text-white">Mid-Range Builds</h2>
          <p className="mb-6 text-sm text-slate-400">
            More totes, more options. Casters, worktops, and Costco tote variants.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {intermediate.map((plan) => (
              <PlanCard key={plan.slug} plan={plan} />
            ))}
          </div>
        </section>
      )}

      {/* ── Advanced ── */}
      {advanced.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-2 text-2xl font-bold text-white">XL Builds</h2>
          <p className="mb-6 text-sm text-slate-400">
            Maximum storage. More cuts, more material, more organization.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {advanced.map((plan) => (
              <PlanCard key={plan.slug} plan={plan} />
            ))}
          </div>
        </section>
      )}

      {/* ── CTA: Custom size ── */}
      <section className="mt-16 rounded-xl border border-slate-700/60 bg-slate-800/40 p-8 text-center">
        <h2 className="text-2xl font-bold text-white">Need a different size?</h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-400">
          Use our free 3D configurator to design any size unit, then book an
          installer to build it for you — or contact us for a custom plan.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/design"
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Open 3D Designer
          </Link>
        </div>
      </section>
    </main>
  );
}
