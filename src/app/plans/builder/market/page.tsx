// ═══════════════════════════════════════════════════════════════════════════
// PLAN MARKETPLACE — /plans/builder/market
//
// Build plans that Custom Builder subscribers have listed for sale, newest
// first. Anyone can buy one; no subscription or account needed.
// ═══════════════════════════════════════════════════════════════════════════

import type { Metadata } from "next";
import Link from "next/link";
import { listMarketplace } from "@/app/actions/builder";
import { ListingCard, PageHeader } from "@/components/builder/BuilderShared";

export const dynamic = "force-dynamic";

// In preview with the rest of the builder: not linked from /plans and not indexed yet.
export const metadata: Metadata = {
  title: "Build Plan Marketplace | Storage Network",
  description: "Storage build plans designed by other builders: cut list, shopping list, 3D guide and PDF for each.",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default async function MarketplacePage() {
  const market = await listMarketplace();
  return (
    <div className="min-h-[100dvh] bg-slate-950 text-white">
      <PageHeader title="Build Plan Marketplace" subtitle="Plans designed by other builders" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-black">Plans from the community</h2>
          <p className="mt-1 max-w-xl text-sm text-stone-400">
            Each plan comes with a cut list, shopping list, interactive 3D build guide and a printable PDF. Buy once, keep it for good.
          </p>
        </div>
        {!market.ok ? (
          <p className="rounded-xl bg-red-500/10 p-4 text-sm text-red-300">{market.error}</p>
        ) : market.listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center">
            <p className="text-sm font-bold text-white">No plans are listed yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-stone-400">
              Design something in the Custom Builder and list its plan here. You keep 80% of every sale.
            </p>
            <Link href="/plans/builder" className="mt-5 inline-block rounded-xl bg-yellow-400 px-5 py-3 text-sm font-black uppercase tracking-wider text-gray-950">
              Open the builder
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {market.listings.map((listing) => (
              <ListingCard key={listing.slug} listing={listing} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
