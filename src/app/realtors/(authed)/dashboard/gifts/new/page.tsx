// ═══════════════════════════════════════════════════════════════════════════
// Realtor → Gift → New (Quick-send: package picker + recipient form + checkout)
//
// Coexists with the Inventory-mode flow at /gifts/new/inventory. A cross-link
// at the top of this page surfaces the alternative; the realtor's current
// tote balance hints which mode they likely want.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, Layers, Package } from "lucide-react";

import { listToteRentalPackages } from "@/app/actions/realtor-gifts";
import { getRealtorToteInventory } from "@/app/actions/realtor-tote-inventory";
import { GiftPurchaseFlow } from "./GiftPurchaseFlow";

export default async function NewGiftPage() {
  const [packages, inventory] = await Promise.all([
    listToteRentalPackages(),
    getRealtorToteInventory(),
  ]);

  const hasBalance = inventory.balance > 0;

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
          New Closing Gift &middot; Quick-send
        </p>
        <h1 className="mb-2 text-3xl font-black sm:text-4xl">Pick a tote package</h1>
        <p className="mb-3 max-w-2xl text-sm text-stone-400">
          Choose the size and rental window. Address it to your buyer or seller. We&apos;ll email
          them the gift link with your name and message.
        </p>

        <Link
          href="/realtors/dashboard/gifts/new/inventory"
          className={`mb-10 inline-flex items-center gap-1.5 text-xs ${
            hasBalance ? "text-yellow-400 hover:text-yellow-300" : "text-stone-500 hover:text-yellow-400"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          {hasBalance
            ? `Or send from your inventory (${inventory.balance.toLocaleString()} totes available) →`
            : "Or buy totes in bulk to send from inventory →"}
        </Link>

        <GiftPurchaseFlow packages={packages} />
      </div>
    </div>
  );
}
