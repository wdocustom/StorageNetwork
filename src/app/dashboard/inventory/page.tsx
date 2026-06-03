export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";

import { getAuthenticatedUser } from "@/lib/auth";
import { getInstallerInventory } from "@/app/actions/inventory";
import { InventoryForm } from "./InventoryForm";

// ═══════════════════════════════════════════════════════════════════════════
// /dashboard/inventory — manual edit + reset for the auto-tracked
// material inventory. The Smart Inventory system deducts items as jobs
// complete; this page is the escape hatch when that drifts out of sync
// with what's actually in the shop.
// ═══════════════════════════════════════════════════════════════════════════

export default async function InventoryPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const inventory = await getInstallerInventory(user.id);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm text-stone-400 hover:text-yellow-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>

        <div className="mb-8 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 ring-1 ring-yellow-400/40">
            <Package className="h-5 w-5 text-yellow-400" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
              Smart Inventory
            </p>
            <h1 className="text-2xl font-black sm:text-3xl">Materials on hand</h1>
            <p className="mt-2 max-w-xl text-sm text-stone-400">
              Edit any value below to match what&apos;s actually in your shop, or use
              <span className="font-bold text-stone-300"> Clear All </span>
              to reset everything to zero when the auto-tracking has drifted.
            </p>
          </div>
        </div>

        <InventoryForm initial={inventory} />
      </div>
    </div>
  );
}
