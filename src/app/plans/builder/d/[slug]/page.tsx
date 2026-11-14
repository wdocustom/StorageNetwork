// ═══════════════════════════════════════════════════════════════════════════
// A SHARED CUSTOM DESIGN — /plans/builder/d/<slug>
//
// What a builder's share link opens:
//   • shared to view   the design in 3D, with "Open a copy" for the builder
//   • listed for sale  the plan's listing, with checkout. The design itself
//                      stays on the server until it has been bought.
// A link to a design that has gone back to private shows a plain "not
// shared any more" page.
// ═══════════════════════════════════════════════════════════════════════════

import type { Metadata } from "next";
import Link from "next/link";
import { getSharedDesign } from "@/app/actions/builder";
import { ListingView, PageHeader, SharedDesignView, materialsLine } from "@/components/builder/BuilderShared";

// Listings change when their owner edits them; always read the current one.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const shared = await getSharedDesign(slug);
  // Share pages are reached by link, not search: an unguessable URL shouldn't be indexed.
  const base: Metadata = { robots: { index: false, follow: false }, alternates: { canonical: null } };
  if (!shared.ok) return { ...base, title: "Design not found | Storage Network" };
  return {
    ...base,
    title: `${shared.name} | Storage Network`,
    description: shared.description ?? `${shared.mode === "sale" ? "Build plan" : "Custom storage design"}: ${materialsLine(shared.stats)}.`,
  };
}

export default async function SharedDesignPage({ params }: Params) {
  const { slug } = await params;
  const shared = await getSharedDesign(slug);

  if (!shared.ok) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 text-white">
        <PageHeader title="Custom Storage Builder" subtitle="Shared design" />
        <main className="mx-auto max-w-md px-4 py-20 text-center">
          <h2 className="text-lg font-black">This design isn&apos;t available</h2>
          <p className="mt-2 text-sm text-stone-400">{shared.error}</p>
          <Link href="/plans/builder/market" className="mt-6 inline-block rounded-xl bg-yellow-400 px-5 py-3 text-sm font-black uppercase tracking-wider text-gray-950">
            Browse plans
          </Link>
        </main>
      </div>
    );
  }

  if (shared.mode === "sale") return <ListingView listing={shared} />;
  return <SharedDesignView slug={shared.slug} name={shared.name} description={shared.description} stats={shared.stats} scene={shared.scene} />;
}
