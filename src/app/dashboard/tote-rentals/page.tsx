// ═══════════════════════════════════════════════════════════════════════════
// Installer → Tote Rentals
//
// Two layered states:
//   1. NOT opted in → render <ToteFulfillmentOptIn>: set stock + capacity,
//      flip active=true. Empty state otherwise.
//   2. Opted in → render the job list (assigned / delivered / returned tabs).
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, DollarSign, Package } from "lucide-react";

import { getAuthenticatedUser } from "@/lib/auth";
import {
  getToteFulfillmentSettings,
  listInstallerToteJobs,
} from "@/app/actions/realtor-gift-fulfillment";
import { ToteFulfillmentSettings } from "./ToteFulfillmentSettings";
import { ToteJobsTable } from "./ToteJobsTable";

export default async function ToteRentalsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const [settings, jobs] = await Promise.all([
    getToteFulfillmentSettings(),
    listInstallerToteJobs(),
  ]);

  // Earnings summary across the visible jobs. "Paid" reflects Stripe
  // transfers that landed; "pending" is the cumulative balance from
  // completed-but-not-yet-paid plus in-flight jobs the installer is on
  // the hook for. Useful for installers eyeballing whether the program
  // is worth their time.
  const earnings = jobs.reduce(
    (acc, j) => {
      const cents = j.payout_cents || 0;
      if (j.paid_at) acc.paidCents += cents;
      else acc.pendingCents += cents;
      return acc;
    },
    { paidCents: 0, pendingCents: 0 }
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-2 text-sm text-stone-400 hover:text-yellow-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>

        <div className="mb-10">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
            Tote Rentals
          </p>
          <h1 className="text-3xl font-black sm:text-4xl">Realtor closing-gift jobs</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-400">
            Realtors send reusable-tote closing gifts through the network. Opt in below to
            handle the delivery and pickup &mdash; you keep your stock, we route the jobs.
          </p>
        </div>

        {settings && (
          <ToteFulfillmentSettings
            initial={settings}
            jobsInFlight={jobs.filter((j) => j.status === "assigned" || j.status === "delivered").length}
          />
        )}

        {settings?.active && (earnings.paidCents > 0 || earnings.pendingCents > 0) && (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <EarningsCard
              label="Paid out"
              cents={earnings.paidCents}
              tint="emerald"
              hint="Stripe transfers landed on your connected account."
            />
            <EarningsCard
              label="Pending"
              cents={earnings.pendingCents}
              tint="yellow"
              hint="Earned on jobs not yet completed, plus any completed gifts awaiting transfer."
            />
          </div>
        )}

        {settings?.active ? (
          jobs.length > 0 ? (
            <div className="mt-10">
              <ToteJobsTable jobs={jobs} />
            </div>
          ) : (
            <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/40 px-6 py-16 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400/10 ring-1 ring-yellow-400/40">
                <Package className="h-7 w-7 text-yellow-400" />
              </div>
              <h2 className="mb-2 text-xl font-bold">No active jobs yet</h2>
              <p className="mx-auto max-w-md text-sm text-stone-400">
                You&apos;re live. We&apos;ll route the next realtor gift in your area to you and email
                you the moment it lands.
              </p>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

function EarningsCard({
  label,
  cents,
  tint,
  hint,
}: {
  label: string;
  cents: number;
  tint: "emerald" | "yellow";
  hint: string;
}) {
  const dollars = (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const tintClasses = tint === "emerald"
    ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-300"
    : "border-yellow-400/30 bg-yellow-400/5 text-yellow-300";
  return (
    <div className={`rounded-2xl border p-5 ${tintClasses}`}>
      <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em]">
        <DollarSign className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-2xl font-black text-white">${dollars}</p>
      <p className="mt-1 text-xs text-stone-400">{hint}</p>
    </div>
  );
}
