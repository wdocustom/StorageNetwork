// ═══════════════════════════════════════════════════════════════════════════
// Realtor Analytics Section
//
// Server-rendered tile for the realtor dashboard. Replaces the "Coming Soon"
// analytics placeholder with real numbers derived from this realtor's
// tote_rental_gifts rows: how many they've sent, what share got redeemed,
// what's currently in flight, what's complete, and the average time it
// takes a recipient to redeem after the realtor sends a gift.
//
// Computed server-side in one round-trip and bucketed in JS. Realtors
// rarely have hundreds of gifts; if they do, lift this into a SQL view.
// ═══════════════════════════════════════════════════════════════════════════

import { BarChart3, Gift, Truck, CheckCircle2, Clock, Percent } from "lucide-react";
import { getServiceClient } from "@/lib/supabase-server";

interface AnalyticsSectionProps {
  realtorId: string;
}

interface Aggregates {
  total: number;
  /** Gifts past pending_payment (paid + everything after, excluding cancelled). */
  paid: number;
  redeemed: number;
  inFlight: number;   // scheduled + assigned + delivered
  completed: number;  // returned
  cancelled: number;
  revenueCents: number;
  /** Average days between paid_at and redeemed_at across redeemed gifts.
   *  Null when no redemptions exist yet. */
  avgDaysToRedeem: number | null;
}

async function fetchAggregates(realtorId: string): Promise<Aggregates> {
  const supabase = getServiceClient();
  const { data: gifts } = await supabase
    .from("tote_rental_gifts")
    .select("status, amount_cents, paid_at, redeemed_at")
    .eq("realtor_id", realtorId);

  const agg: Aggregates = {
    total: 0,
    paid: 0,
    redeemed: 0,
    inFlight: 0,
    completed: 0,
    cancelled: 0,
    revenueCents: 0,
    avgDaysToRedeem: null,
  };

  let redeemMsTotal = 0;
  let redeemSamples = 0;

  for (const g of gifts ?? []) {
    agg.total += 1;
    const status = g.status as string;
    if (status !== "pending_payment" && status !== "cancelled") {
      agg.paid += 1;
      agg.revenueCents += (g.amount_cents as number) || 0;
    }
    if (g.redeemed_at) agg.redeemed += 1;
    if (status === "scheduled" || status === "assigned" || status === "delivered") agg.inFlight += 1;
    else if (status === "returned") agg.completed += 1;
    else if (status === "cancelled") agg.cancelled += 1;

    if (g.paid_at && g.redeemed_at) {
      const start = new Date(g.paid_at as string).getTime();
      const end = new Date(g.redeemed_at as string).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        redeemMsTotal += end - start;
        redeemSamples += 1;
      }
    }
  }

  if (redeemSamples > 0) {
    agg.avgDaysToRedeem = redeemMsTotal / redeemSamples / (1000 * 60 * 60 * 24);
  }

  return agg;
}

export async function AnalyticsSection({ realtorId }: AnalyticsSectionProps) {
  const agg = await fetchAggregates(realtorId);

  // First-use empty state — friendlier than five "0"s for a brand-new realtor.
  if (agg.total === 0) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
        <div className="flex items-start gap-3">
          <BarChart3 className="h-5 w-5 text-stone-500" />
          <div>
            <h2 className="mb-1 text-sm font-bold text-stone-300">Your gift activity</h2>
            <p className="text-xs text-stone-500">
              Once you send your first gift, your redemption rate, in-flight status, and
              completion stats will show up here.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const redemptionPct =
    agg.paid > 0 ? Math.round((agg.redeemed / agg.paid) * 100) : null;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-yellow-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-300">
            Your gift activity
          </h2>
        </div>
        <div className="text-right text-[11px] text-stone-500">
          <p>${(agg.revenueCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
          <p>Lifetime spend</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard icon={<Gift className="h-4 w-4" />} label="Gifts sent" value={agg.total} />
        <StatCard
          icon={<Percent className="h-4 w-4" />}
          label="Redemption rate"
          value={redemptionPct !== null ? `${redemptionPct}%` : "—"}
          subValue={redemptionPct !== null ? `${agg.redeemed}/${agg.paid}` : "no paid gifts yet"}
          tint={redemptionPct !== null && redemptionPct >= 75 ? "emerald" : undefined}
        />
        <StatCard
          icon={<Truck className="h-4 w-4" />}
          label="In flight"
          value={agg.inFlight}
          tint={agg.inFlight > 0 ? "yellow" : undefined}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Completed"
          value={agg.completed}
          tint={agg.completed > 0 ? "emerald" : undefined}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Avg time to redeem"
          value={
            agg.avgDaysToRedeem !== null
              ? `${agg.avgDaysToRedeem < 1 ? "<1" : agg.avgDaysToRedeem.toFixed(1)}d`
              : "—"
          }
          subValue={
            agg.avgDaysToRedeem !== null ? "after gift sent" : "no redemptions yet"
          }
        />
      </div>

      {agg.cancelled > 0 && (
        <p className="mt-4 text-[11px] text-stone-500">
          {agg.cancelled} cancelled gift{agg.cancelled === 1 ? "" : "s"} not included in the rate above.
        </p>
      )}
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  subValue,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  tint?: "yellow" | "emerald";
}) {
  const tintClass =
    tint === "yellow"
      ? "border-yellow-400/30 bg-yellow-400/5 text-yellow-200"
      : tint === "emerald"
        ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-200"
        : "border-slate-800 bg-slate-950/40 text-stone-200";
  return (
    <div className={`rounded-xl border p-3 ${tintClass}`}>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-400">
        {icon}
        {label}
      </div>
      <p className="text-xl font-black text-white">{value}</p>
      {subValue && <p className="mt-0.5 text-[10px] text-stone-500">{subValue}</p>}
    </div>
  );
}
