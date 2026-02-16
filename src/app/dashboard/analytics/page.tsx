"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Eye,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Loader2,
  Calendar,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getInstallerAnalytics, type AnalyticsSummary } from "@/app/actions/analytics";

// ═══════════════════════════════════════════════════════════════════════════
// Installer Analytics Dashboard
//
// Shows page views, conversions, referrer breakdown, device split,
// and recent activity for the logged-in installer.
// ═══════════════════════════════════════════════════════════════════════════

type TimeRange = 7 | 30 | 90;

export default function AnalyticsPage() {
  const supabase = getSupabaseBrowserClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState("");
  const [range, setRange] = useState<TimeRange>(30);

  const fetchAnalytics = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setUserId(user.id);
    setLoading(true);
    setError("");

    const result = await getInstallerAnalytics(user.id, range);
    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error || "Failed to load analytics.");
    }
    setLoading(false);
  }, [supabase, range]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  function getDeviceIcon(device: string) {
    if (device === "Mobile") return Smartphone;
    if (device === "Tablet") return Tablet;
    return Monitor;
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function timeAgo(dateStr: string): string {
    const now = new Date();
    const then = new Date(dateStr);
    const diffMs = now.getTime() - then.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return "Yesterday";
    return `${diffDay}d ago`;
  }

  // ── Bar chart helper: max value for scaling ────────────────────────────
  function renderBarChart(
    items: { label: string; value: number }[],
    color: string
  ) {
    const maxVal = Math.max(...items.map((i) => i.value), 1);
    return (
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="w-16 text-right text-[10px] text-stone-500 shrink-0">
              {item.label}
            </span>
            <div className="flex-1 h-5 bg-slate-800 rounded overflow-hidden">
              <div
                className={`h-full rounded ${color} transition-all duration-500`}
                style={{ width: `${(item.value / maxVal) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right text-xs font-bold text-white shrink-0">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <a
            href="/dashboard"
            className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="flex-1">
            <h1 className="text-sm font-bold uppercase tracking-wider text-white">
              Analytics
            </h1>
            <p className="text-[11px] text-stone-500">Link Performance & Conversions</p>
          </div>
          <BarChart3 className="h-5 w-5 text-purple-400" />
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        {/* ── Time Range Selector ─────────────────────────────────────── */}
        <div className="flex gap-2">
          {([7, 30, 90] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                range === r
                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                  : "bg-slate-800 text-stone-500 border border-slate-700 hover:text-white"
              }`}
            >
              {r}D
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : data ? (
          <>
            {/* ══════════════════════════════════════════════════════════
                KPI Cards
            ══════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-2 gap-3">
              {/* Page Views */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
                <Eye className="mx-auto mb-1.5 h-5 w-5 text-blue-400" />
                <p className="text-2xl font-black text-white">
                  {data.totalViews.toLocaleString()}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                  Page Views
                </p>
              </div>

              {/* Orders */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
                <ShoppingCart className="mx-auto mb-1.5 h-5 w-5 text-emerald-400" />
                <p className="text-2xl font-black text-white">
                  {data.totalOrders.toLocaleString()}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                  Orders
                </p>
              </div>

              {/* Conversion Rate */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
                <TrendingUp className="mx-auto mb-1.5 h-5 w-5 text-purple-400" />
                <p className="text-2xl font-black text-white">
                  {data.conversionRate}%
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                  Conversion
                </p>
              </div>

              {/* Revenue */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
                <DollarSign className="mx-auto mb-1.5 h-5 w-5 text-yellow-400" />
                <p className="text-2xl font-black text-white">
                  ${data.totalRevenue.toLocaleString()}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                  Revenue
                </p>
              </div>
            </div>

            {/* Avg Order Value */}
            {data.totalOrders > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowUpRight className="h-4 w-4 text-yellow-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                      Avg Order Value
                    </span>
                  </div>
                  <span className="text-lg font-black text-white">
                    ${data.avgOrderValue.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                Views by Day (Bar Chart)
            ══════════════════════════════════════════════════════════ */}
            {data.viewsByDay.length > 0 && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                    Daily Views
                  </h2>
                </div>
                {renderBarChart(
                  data.viewsByDay.slice(-14).map((d) => ({
                    label: formatDate(d.date),
                    value: d.views,
                  })),
                  "bg-blue-500"
                )}
              </section>
            )}

            {/* ══════════════════════════════════════════════════════════
                Orders by Day
            ══════════════════════════════════════════════════════════ */}
            {data.ordersByDay.length > 0 && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                    Daily Orders
                  </h2>
                </div>
                {renderBarChart(
                  data.ordersByDay.slice(-14).map((d) => ({
                    label: formatDate(d.date),
                    value: d.orders,
                  })),
                  "bg-emerald-500"
                )}
              </section>
            )}

            {/* ══════════════════════════════════════════════════════════
                Traffic Sources
            ══════════════════════════════════════════════════════════ */}
            {data.topReferrers.length > 0 && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-amber-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                    Traffic Sources
                  </h2>
                </div>
                <div className="space-y-2">
                  {data.topReferrers.map((r) => (
                    <div
                      key={r.referrer}
                      className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2"
                    >
                      <span className="text-sm text-white truncate max-w-[200px]">
                        {r.referrer}
                      </span>
                      <span className="text-xs font-bold text-amber-400 shrink-0 ml-2">
                        {r.count} {r.count === 1 ? "visit" : "visits"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ══════════════════════════════════════════════════════════
                Device Breakdown
            ══════════════════════════════════════════════════════════ */}
            {data.deviceBreakdown.length > 0 && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-cyan-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                    Devices
                  </h2>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {data.deviceBreakdown.map((d) => {
                    const Icon = getDeviceIcon(d.device);
                    const pct = data.totalViews > 0
                      ? Math.round((d.count / data.totalViews) * 100)
                      : 0;
                    return (
                      <div
                        key={d.device}
                        className="rounded-lg bg-slate-800/50 p-3 text-center"
                      >
                        <Icon className="mx-auto mb-1 h-5 w-5 text-cyan-400" />
                        <p className="text-lg font-black text-white">{pct}%</p>
                        <p className="text-[10px] text-stone-500">{d.device}</p>
                        <p className="text-[10px] text-stone-600">{d.count} visits</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ══════════════════════════════════════════════════════════
                Recent Activity
            ══════════════════════════════════════════════════════════ */}
            {data.recentViews.length > 0 && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-purple-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                    Recent Activity
                  </h2>
                </div>
                <div className="space-y-2">
                  {data.recentViews.map((v, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg bg-slate-800/30 px-3 py-2"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                        <Eye className="h-3.5 w-3.5 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">
                          {v.page === "/design" ? "Design Page" : v.page === "/book" ? "Booking Page" : v.page}
                        </p>
                        <p className="text-[10px] text-stone-500 truncate">
                          {v.referrer ? cleanReferrerDisplay(v.referrer) : "Direct"} · {v.device}
                        </p>
                      </div>
                      <span className="text-[10px] text-stone-600 shrink-0">
                        {timeAgo(v.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Empty State ──────────────────────────────────────── */}
            {data.totalViews === 0 && data.totalOrders === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center">
                <BarChart3 className="mx-auto mb-3 h-10 w-10 text-stone-600" />
                <h3 className="mb-2 text-sm font-bold text-white">
                  No data yet
                </h3>
                <p className="text-xs text-stone-500">
                  Share your installer link to start tracking visits and conversions.
                  Analytics will appear here as customers interact with your pages.
                </p>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}

function cleanReferrerDisplay(referrer: string | null): string {
  if (!referrer || referrer === "") return "Direct";
  try {
    const url = new URL(referrer);
    return url.hostname.replace("www.", "");
  } catch {
    return referrer.slice(0, 30);
  }
}
