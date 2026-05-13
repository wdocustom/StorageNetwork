// ═══════════════════════════════════════════════════════════════════════════
// Realtor → Gifts (list of everything they've sent)
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, Gift, Plus } from "lucide-react";

import { listRealtorGifts, type RealtorGiftSummary } from "@/app/actions/realtor-gifts";

export default async function RealtorGiftsPage() {
  const gifts = await listRealtorGifts();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
        <Link
          href="/realtors/dashboard"
          className="mb-8 inline-flex items-center gap-2 text-sm text-stone-400 hover:text-yellow-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>

        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
              Your Gifts
            </p>
            <h1 className="text-3xl font-black sm:text-4xl">Sent &amp; in flight</h1>
          </div>
          <Link
            href="/realtors/dashboard/gifts/new"
            className="hidden items-center gap-2 rounded-xl bg-yellow-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-yellow-300 sm:flex"
          >
            <Plus className="h-4 w-4" />
            New gift
          </Link>
        </div>

        {gifts.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wider text-stone-500">
                  <th className="px-5 py-3 font-semibold">Recipient</th>
                  <th className="px-5 py-3 font-semibold">Package</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Amount</th>
                  <th className="px-5 py-3 font-semibold">Sent</th>
                </tr>
              </thead>
              <tbody>
                {gifts.map((gift) => (
                  <GiftRow key={gift.id} gift={gift} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function GiftRow({ gift }: { gift: RealtorGiftSummary }) {
  const sent = new Date(gift.created_at);
  const sentLabel = sent.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sent.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });

  return (
    <tr className="border-b border-slate-800 last:border-0">
      <td className="px-5 py-4">
        <p className="font-semibold text-white">{gift.recipient_name}</p>
        <p className="text-xs text-stone-500">{gift.recipient_email}</p>
      </td>
      <td className="px-5 py-4">
        <p className="text-stone-200">{gift.package_name}</p>
        <p className="text-xs text-stone-500">
          {gift.tote_count} totes &middot; {gift.duration_days}-day
        </p>
      </td>
      <td className="px-5 py-4">
        <StatusBadge status={gift.status} />
      </td>
      <td className="px-5 py-4 text-right font-semibold text-white">
        ${(gift.amount_cents / 100).toFixed(0)}
      </td>
      <td className="px-5 py-4 text-stone-400">{sentLabel}</td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: string }> = {
    paid: { label: "Awaiting recipient", tone: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
    redeemed: { label: "Recipient verified", tone: "border-blue-400/40 bg-blue-400/10 text-blue-300" },
    scheduled: { label: "Scheduled", tone: "border-yellow-400/40 bg-yellow-400/10 text-yellow-300" },
    assigned: { label: "Installer assigned", tone: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" },
    delivered: { label: "Delivered", tone: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" },
    returned: { label: "Complete", tone: "border-slate-500/40 bg-slate-500/10 text-stone-300" },
    cancelled: { label: "Cancelled", tone: "border-red-400/40 bg-red-400/10 text-red-300" },
  };
  const entry = map[status] || { label: status, tone: "border-slate-700 bg-slate-800/40 text-stone-300" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${entry.tone}`}>
      {entry.label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-6 py-16 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400/10 ring-1 ring-yellow-400/40">
        <Gift className="h-7 w-7 text-yellow-400" />
      </div>
      <h2 className="mb-2 text-xl font-bold">No gifts sent yet</h2>
      <p className="mx-auto mb-6 max-w-md text-sm text-stone-400">
        Send your first closing gift &mdash; pick a package, address it to your buyer or seller, and
        we&apos;ll handle the rest.
      </p>
      <Link
        href="/realtors/dashboard/gifts/new"
        className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-yellow-300"
      >
        <Plus className="h-4 w-4" />
        Send a gift
      </Link>
    </div>
  );
}
