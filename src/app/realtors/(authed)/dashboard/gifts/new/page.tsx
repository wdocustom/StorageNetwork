// ═══════════════════════════════════════════════════════════════════════════
// Realtor → Gift → New (package picker + recipient form + checkout)
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { listToteRentalPackages } from "@/app/actions/realtor-gifts";
import { GiftPurchaseFlow } from "./GiftPurchaseFlow";

export default async function NewGiftPage() {
  const packages = await listToteRentalPackages();

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
          New Closing Gift
        </p>
        <h1 className="mb-2 text-3xl font-black sm:text-4xl">Pick a tote package</h1>
        <p className="mb-10 max-w-2xl text-sm text-stone-400">
          Choose the size and rental window. Address it to your buyer or seller. We&apos;ll email
          them the gift link with your name and message.
        </p>

        <GiftPurchaseFlow packages={packages} />
      </div>
    </div>
  );
}
