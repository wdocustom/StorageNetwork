"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getAdminPlansAnalytics } from "@/app/actions/plans-analytics";
import type { PlansAnalytics, PlansPageKind } from "@/lib/plans-analytics";

// ═══════════════════════════════════════════════════════════════════════════
// Platform Analytics → "Plans" tab: DIY plans storefront activity, funnel,
// purchases (at list price), traffic sources and installer splits.
// ═══════════════════════════════════════════════════════════════════════════

const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const KIND_LABEL: Record<PlansPageKind, string> = {
  storefront: "Storefront",
  designer: "Designer",
  owner: "Buyer area",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">{title}</h3>
      {children}
    </div>
  );
}

export default function PlansAnalyticsTab({ range }: { range: number }) {
  const [data, setData] = useState<PlansAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      const { data: { user } } = await getSupabaseBrowserClient().auth.getUser();
      if (!user) return;
      const res = await getAdminPlansAnalytics(user.id, range);
      if (!live) return;
      if (res.success && res.data) {
        setData(res.data);
        setError(null);
      } else {
        setError(res.error ?? "Failed to load plans analytics.");
      }
      setLoading(false);
    })();
    return () => {
      live = false;
    };
  }, [range]);

  if (loading && !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-stone-500" />
      </div>
    );
  }
  if (error || !data) {
    return <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>;
  }

  return <PlansAnalyticsView data={data} />;
}

export function PlansAnalyticsView({ data }: { data: PlansAnalytics }) {
  const { kpis } = data;
  const maxDay = Math.max(1, ...data.byDay.map((d) => d.visitors));
  const maxFunnel = Math.max(1, data.funnel[0]?.count ?? 0);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: "Visitors", value: kpis.visitors.toLocaleString() },
          { label: "Opened designer", value: kpis.designerVisitors.toLocaleString() },
          { label: "Purchases", value: kpis.purchases.toLocaleString(), accent: true },
          { label: "Revenue (list)", value: money(kpis.revenue), accent: true },
          { label: "Designer → buy", value: `${kpis.designerConversion}%` },
        ].map((k, i, all) => (
          <div
            key={k.label}
            className={`rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-center ${i === all.length - 1 ? "col-span-2 md:col-span-1" : ""}`}
          >
            <p className={`text-lg font-black ${k.accent ? "text-emerald-400" : "text-white"}`}>{k.value}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Funnel */}
      <Card title="Funnel (unique visitors)">
        <div className="space-y-2">
          {data.funnel.map((f) => (
            <div key={f.step}>
              <div className="flex justify-between text-xs">
                <span className="text-stone-300">{f.step}</span>
                <span className="font-bold text-white">{f.count.toLocaleString()}</span>
              </div>
              <div className="mt-1 h-2 rounded bg-slate-800">
                <div className="h-2 rounded bg-yellow-400" style={{ width: `${(f.count / maxFunnel) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Daily */}
      <Card title="Visitors per day">
        {data.byDay.length === 0 ? (
          <p className="text-sm text-stone-500">No plans activity in this period.</p>
        ) : (
          <>
            <div className="flex h-28 items-stretch gap-[2px]">
              {data.byDay.map((d) => (
                <div key={d.date} className="group relative flex flex-1 flex-col items-center justify-end">
                  <div
                    className={`min-h-[2px] w-full rounded-t ${d.purchases > 0 ? "bg-emerald-400" : "bg-blue-500/80"}`}
                    style={{ height: `${(d.visitors / maxDay) * 100}%` }}
                  />
                  <div className="absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] group-hover:block">
                    <p className="font-bold text-white">{d.visitors} visitors</p>
                    {d.purchases > 0 && <p className="text-emerald-400">{d.purchases} purchases</p>}
                    <p className="text-stone-500">{d.date}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-stone-600">Green bars are days with a purchase.</p>
          </>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Pages">
          {data.pages.length === 0 ? (
            <p className="text-sm text-stone-500">No views yet.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-stone-500">
                  <th className="pb-2 font-semibold">Page</th>
                  <th className="pb-2 text-right font-semibold">Visitors</th>
                  <th className="pb-2 text-right font-semibold">Views</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.pages.map((p) => (
                  <tr key={p.page}>
                    <td className="py-1.5">
                      <span className="text-stone-200">{p.page}</span>
                      <span className="ml-1.5 text-[10px] text-stone-500">{KIND_LABEL[p.kind]}</span>
                    </td>
                    <td className="py-1.5 text-right font-bold text-white">{p.visitors}</td>
                    <td className="py-1.5 text-right text-stone-400">{p.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Where visitors came from">
          {data.sources.length === 0 ? (
            <p className="text-sm text-stone-500">No visitors yet.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {data.sources.map((s) => (
                <li key={s.source} className="flex justify-between">
                  <span className="text-stone-300">{s.source}</span>
                  <span className="font-bold text-white">{s.visitors}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[10px] text-stone-600">Referrer on each visitor&apos;s first plans page.</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Sales by plan">
          {data.byPlan.length === 0 ? (
            <p className="text-sm text-stone-500">No purchases in this period.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {data.byPlan.map((p) => (
                <li key={p.plan} className="flex justify-between gap-2">
                  <span className="text-stone-300">{p.plan}</span>
                  <span className="whitespace-nowrap text-white">
                    <span className="font-bold">{p.purchases}</span>
                    <span className="text-stone-500"> · {money(p.revenue)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[10px] text-stone-600">At list price; the jig counts at the owner price for tote plan buyers.</p>
        </Card>

        <Card title="Installer splits">
          {data.splits.length === 0 ? (
            <p className="text-sm text-stone-500">No splits in this period.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {data.splits.map((s, i) => (
                <li key={`${s.createdAt}-${i}`} className="flex justify-between gap-2">
                  <span className="text-stone-300">
                    {s.recipient} <span className="text-stone-500">· {s.reason} · {shortDate(s.createdAt)}</span>
                  </span>
                  <span className={s.status === "paid" ? "font-bold text-emerald-400" : s.status === "failed" ? "text-red-400" : "text-stone-400"}>
                    {money(s.amount)} {s.status !== "paid" && `(${s.status})`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[10px] text-stone-600">Paid this period: {money(kpis.splitsPaid)}</p>
        </Card>
      </div>

      <Card title="Recent purchases">
        {data.recentPurchases.length === 0 ? (
          <p className="text-sm text-stone-500">No purchases in this period.</p>
        ) : (
          <ul className="divide-y divide-slate-800 text-xs">
            {data.recentPurchases.map((p, i) => (
              <li key={`${p.purchasedAt}-${i}`} className="flex flex-wrap justify-between gap-x-3 py-1.5">
                <span className="text-stone-200">{p.plan}</span>
                <span className="text-stone-500">
                  {p.email} · {shortDate(p.purchasedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
