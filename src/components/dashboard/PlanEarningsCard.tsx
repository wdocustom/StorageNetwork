"use client";

// ═══════════════════════════════════════════════════════════════════════════
// DIY PLAN EARNINGS — account tab card for installers who've received a
// plan-sale split (referrals from their designer / quote page / quote
// email, or sales of their bestseller designs). Renders nothing for
// everyone else.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { Hammer } from "lucide-react";
import { getMyPlanEarnings, type MyPlanEarnings } from "@/app/actions/plan-split-earnings";
import { BESTSELLER_PRESETS } from "@/lib/presets";

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function splitLabel(reason: "referral" | "bestseller", bestsellers: string[]): string {
  if (reason === "referral") return "Referral";
  const names = bestsellers.map((id) => BESTSELLER_PRESETS.find((p) => p.id === id)?.name ?? id);
  return names.join(" + ") || "Bestseller";
}

export const STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-400",
  pending: "bg-yellow-400/10 text-yellow-300",
  failed: "bg-red-500/10 text-red-400",
};

export default function PlanEarningsCard() {
  const [data, setData] = useState<MyPlanEarnings | null>(null);

  useEffect(() => {
    getMyPlanEarnings().then(setData).catch(() => setData(null));
  }, []);

  if (!data) return null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-1 flex items-center gap-2">
        <Hammer className="h-4 w-4 text-yellow-400" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">DIY Plan Earnings</h2>
      </div>
      <p className="mb-4 text-xs text-stone-500">
        Your share of DIY build plans bought through your links or built from your bestseller designs, paid to your
        Stripe account.
      </p>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          ["Paid to you", money(data.paidCents)],
          ["On the way", money(data.owedCents)],
          ["Plan sales", String(data.sales)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{label}</p>
            <p className="mt-0.5 text-lg font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
        {data.recent.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-xs">
            <span className="w-16 shrink-0 text-stone-500">
              {new Date(r.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
            <span className="min-w-0 flex-1 truncate text-stone-300">{splitLabel(r.reason, r.bestsellers)}</span>
            <span className="font-bold text-white">{money(r.cents)}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_STYLE[r.status]}`}>
              {r.status === "failed" ? "pending" : r.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
