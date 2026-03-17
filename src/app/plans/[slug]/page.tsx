import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PLAN_CATALOG, getPlanBySlug } from "@/lib/plans";
import { generateDIYPlan } from "@/app/actions/generate-plan";
import PrintablePlan from "@/components/plans/PrintablePlan";

// ═══════════════════════════════════════════════════════════════════════════
// Static params — pre-generate all plan pages at build time
// ═══════════════════════════════════════════════════════════════════════════

export function generateStaticParams() {
  return PLAN_CATALOG.map((plan) => ({ slug: plan.slug }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Dynamic Metadata
// ═══════════════════════════════════════════════════════════════════════════

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const plan = getPlanBySlug(slug);
  if (!plan) return { title: "Plan Not Found" };

  return {
    title: `${plan.name} DIY Build Plan | Storage Network`,
    description: `Complete DIY build plan for the ${plan.name} (${plan.toteCount}-tote organizer). Includes cut list, shopping list, dimensional drawings, and step-by-step assembly instructions.`,
    alternates: { canonical: `/plans/${slug}` },
    openGraph: {
      title: `${plan.name} — DIY Build Plan`,
      description: plan.description,
      type: "article",
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Page Component
// ═══════════════════════════════════════════════════════════════════════════

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const catalogItem = getPlanBySlug(slug);
  if (!catalogItem) notFound();

  const plan = await generateDIYPlan(catalogItem.config, catalogItem.name);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PrintablePlan plan={plan} catalogItem={catalogItem} />
    </main>
  );
}
