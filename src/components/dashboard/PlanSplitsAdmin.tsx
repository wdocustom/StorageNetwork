"use client";

// ═══════════════════════════════════════════════════════════════════════════
// DIY PLAN SPLITS — owner-only admin section: every installer split on a
// plan sale, totals by installer, and a retry for failed transfers. The
// server returns nothing unless the viewer is the platform owner, so this
// renders nothing for other admins or partners.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { Hammer, Loader2, RotateCw } from "lucide-react";
import { getPlanSplitsAdmin, retryPlanSplit, type PlanSplitsAdmin as AdminData } from "@/app/actions/plan-split-earnings";
import { STATUS_STYLE, money, splitLabel } from "@/components/dashboard/PlanEarningsCard";

export default function PlanSplitsAdmin() {
  const [data, setData] = useState<AdminData | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(() => {
    getPlanSplitsAdmin().then(setData).catch(() => setData(null));
  }, []);
  useEffect(load, [load]);

  const retry = async (id: string) => {
    setRetrying(id);
    setMessage("");
    const result = await retryPlanSplit(id);
    setMessage(result.ok ? "Transfer sent." : result.error ?? "Retry failed.");
    setRetrying(null);
    load();
  };

  if (!data) return null;
  const { totals } = data;

  return (
    <section className="mb-6 rounded-2xl border border-yellow-400/20 bg-gradient-to-b from-yellow-400/5 to-slate-900 p-5">
      <div className="mb-1 flex items-center gap-2">
        <Hammer className="h-4 w-4 text-yellow-400" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">DIY Plan Splits</h2>
      </div>
      <p className="mb-4 text-xs text-stone-500">
        Up to $5 of each tote plan sale goes to the referring installer, or to the installers whose bestsellers are in
        the plan. Only you can see this.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Paid out", money(totals.paidCents)],
          ["Owed", money(totals.owedCents)],
          ["Plan sales", String(totals.sales)],
          ["Failed", String(totals.failed)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{label}</p>
            <p className="mt-0.5 text-lg font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      {data.byInstaller.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-xs text-stone-500">
          No plan splits yet.
        </p>
      ) : (
        <>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">By installer</h3>
          <div className="mb-4 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-stone-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Installer</th>
                  <th className="px-3 py-2 font-semibold">Sales</th>
                  <th className="px-3 py-2 font-semibold">Paid</th>
                  <th className="px-3 py-2 font-semibold">Owed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-stone-300">
                {data.byInstaller.map((i) => (
                  <tr key={i.id}>
                    <td className="px-3 py-2 font-semibold text-white">{i.name}</td>
                    <td className="px-3 py-2">{i.sales}</td>
                    <td className="px-3 py-2">{money(i.paidCents)}</td>
                    <td className={`px-3 py-2 ${i.owedCents > 0 ? "text-yellow-300" : ""}`}>{money(i.owedCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">Recent splits</h3>
          {message && <p className="mb-2 text-xs text-stone-300">{message}</p>}
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
            {data.rows.map((r) => (
              <li key={r.id} className="px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-stone-500">
                    {new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold text-white">{r.recipientName}</span>
                    <span className="text-stone-500"> · {splitLabel(r.reason, r.bestsellers)}</span>
                  </span>
                  <span className="font-bold text-white">{money(r.amount_cents)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_STYLE[r.status]}`}>
                    {r.status}
                  </span>
                  {r.status === "failed" && (
                    <button
                      type="button"
                      onClick={() => retry(r.id)}
                      disabled={retrying !== null}
                      className="flex items-center gap-1 rounded-lg border border-slate-600 px-2 py-0.5 text-[10px] font-bold text-stone-200 transition hover:border-yellow-400 hover:text-yellow-300 disabled:opacity-50"
                    >
                      {retrying === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
                      Retry
                    </button>
                  )}
                </div>
                {r.status === "failed" && r.failure_reason && (
                  <p className="mt-1 pl-16 text-[10px] text-red-400/80">{r.failure_reason}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
