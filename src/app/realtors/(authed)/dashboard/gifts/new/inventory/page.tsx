// ═══════════════════════════════════════════════════════════════════════════
// Realtor → Gift → New → Inventory mode
//
// Dispatch a 10–50 tote gift against the realtor's bulk-tote inventory.
// Distance-gated: free <50 mi, +$25 51–75 mi, mailto inquire >75 mi.
// Coexists with the Quick-send catalog flow at /gifts/new.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";

import {
  getRealtorToteInventory,
  listTotePackOptions,
} from "@/app/actions/realtor-tote-inventory";
import { InventoryGiftFlow } from "./InventoryGiftFlow";

export default async function NewInventoryGiftPage() {
  const [inventory, packCatalog] = await Promise.all([
    getRealtorToteInventory(),
    listTotePackOptions(),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <Link
          href="/realtors/dashboard"
          className="mb-8 inline-flex items-center gap-2 text-sm text-stone-400 hover:text-yellow-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>

        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
          New Closing Gift &middot; Inventory mode
        </p>
        <h1 className="mb-2 text-3xl font-black sm:text-4xl">
          Send from your tote inventory
        </h1>
        <p className="mb-3 max-w-2xl text-sm text-stone-400">
          Pick the number of 27-gallon totes (10–50), enter the recipient&apos;s details,
          and we&apos;ll route it to the nearest installer. No package pricing — you spend
          totes from the inventory you already bought.
        </p>

        <Link
          href="/realtors/dashboard/gifts/new"
          className="mb-8 inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-yellow-400"
        >
          <Package className="h-3.5 w-3.5" />
          Or pick a Quick-send package instead &rarr;
        </Link>

        <InventoryGiftFlow
          balance={inventory.balance}
          packs={packCatalog.packs}
          custom={packCatalog.custom}
        />
      </div>
    </div>
  );
}
