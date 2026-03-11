"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getAdminPlatformAnalytics, type PlatformAnalyticsData } from "@/app/actions/platform-analytics";
import {
  ArrowLeft,
  BarChart3,
  Bot,
  Eye,
  Globe2,
  Loader2,
  Monitor,
  RefreshCw,
  Smartphone,
  Tablet,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Platform Analytics — Admin-Only Dashboard
//
// Full platform-wide analytics: page views, unique visitors, device split,
// geographic breakdown, traffic sources, hourly patterns, bot detection,
// and a live activity feed. Admin-gated via is_admin flag.
// ═══════════════════════════════════════════════════════════════════════════

type TimeRange = 7 | 30 | 90;

export default function PlatformAnalyticsPage() {
  const supabase = getSupabaseBrowserClient();
  const [data, setData] = useState<PlatformAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<TimeRange>(30);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "pages" | "geo" | "live">("overview");

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    const result = await getAdminPlatformAnalytics(user.id, range);
    if (result.success && result.data) {
      setData(result.data);
      setError(null);
    } else {
      setError(result.error || "Failed to load analytics.");
    }

    setLoading(false);
    setRefreshing(false);
  }, [supabase, range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <p className="text-red-400 font-bold mb-2">Access Denied</p>
          <p className="text-stone-500 text-sm">{error}</p>
          <a href="/dashboard" className="mt-4 inline-block text-yellow-400 text-sm underline">Back to Dashboard</a>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { kpis } = data;

  // Max values for bar charts
  const maxDayViews = Math.max(...data.viewsByDay.map((d) => d.views), 1);
  const maxHourViews = Math.max(...data.viewsByHour.map((h) => h.views), 1);

  const deviceIcon = (device: string) => {
    if (device === "mobile") return <Smartphone className="h-4 w-4" />;
    if (device === "tablet") return <Tablet className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="rounded-lg p-1.5 text-stone-500 hover:bg-slate-800 hover:text-white transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </a>
            <div>
              <h1 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-yellow-400" />
                Platform Analytics
              </h1>
              <p className="text-[10px] text-stone-500 uppercase tracking-wider">Admin Only</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Refresh */}
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="rounded-lg p-2 text-stone-500 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            {/* Time Range */}
            <div className="flex rounded-lg border border-slate-700 overflow-hidden">
              {([7, 30, 90] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                    range === r
                      ? "bg-yellow-400 text-slate-900"
                      : "bg-slate-800 text-stone-400 hover:text-white"
                  }`}
                >
                  {r}d
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* ── KPI Cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KPICard icon={<Eye className="h-4 w-4 text-blue-400" />} label="Page Views" value={kpis.totalViews.toLocaleString()} />
          <KPICard icon={<Users className="h-4 w-4 text-emerald-400" />} label="Unique Visitors" value={kpis.uniqueVisitors.toLocaleString()} />
          <KPICard icon={<TrendingUp className="h-4 w-4 text-purple-400" />} label="Sessions" value={kpis.uniqueSessions.toLocaleString()} />
          <KPICard icon={<Zap className="h-4 w-4 text-yellow-400" />} label="Active Now" value={String(kpis.activeNow)} highlight />
          <KPICard icon={<BarChart3 className="h-4 w-4 text-cyan-400" />} label="Pages / Session" value={String(kpis.avgPagesPerSession)} />
          <KPICard icon={<Bot className="h-4 w-4 text-red-400" />} label="Bot Views" value={kpis.botViews.toLocaleString()} muted />
        </div>

        {/* ── Tab Navigation ─────────────────────────────────────────── */}
        <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
          {(["overview", "pages", "geo", "live"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === tab
                  ? "bg-yellow-400 text-slate-900"
                  : "text-stone-500 hover:text-white"
              }`}
            >
              {tab === "overview" ? "Overview" : tab === "pages" ? "Pages" : tab === "geo" ? "Geography" : "Live Feed"}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ───────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Views by Day Chart */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="text-sm font-bold text-white mb-4">Views Over Time</h3>
              <div className="flex items-end gap-[2px] h-32">
                {data.viewsByDay.slice(-Math.min(data.viewsByDay.length, range)).map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end group relative">
                    <div
                      className="w-full bg-blue-500/80 rounded-t hover:bg-blue-400 transition-colors min-h-[2px]"
                      style={{ height: `${(d.views / maxDayViews) * 100}%` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[10px] whitespace-nowrap z-10">
                      <p className="text-white font-bold">{d.views} views</p>
                      <p className="text-stone-400">{d.unique} unique</p>
                      <p className="text-stone-500">{d.date}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[9px] text-stone-600">{data.viewsByDay[0]?.date || ""}</span>
                <span className="text-[9px] text-stone-600">{data.viewsByDay[data.viewsByDay.length - 1]?.date || ""}</span>
              </div>
            </div>

            {/* Hourly Pattern + Device Breakdown side by side */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Hourly Pattern */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <h3 className="text-sm font-bold text-white mb-4">Hourly Traffic Pattern</h3>
                <div className="flex items-end gap-[1px] h-24">
                  {data.viewsByHour.map((h) => (
                    <div key={h.hour} className="flex-1 flex flex-col items-center justify-end group relative">
                      <div
                        className="w-full bg-purple-500/70 rounded-t hover:bg-purple-400 transition-colors min-h-[1px]"
                        style={{ height: `${(h.views / maxHourViews) * 100}%` }}
                      />
                      <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[10px] whitespace-nowrap z-10">
                        <p className="text-white font-bold">{h.views} views</p>
                        <p className="text-stone-500">{h.hour}:00</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[9px] text-stone-600">12am</span>
                  <span className="text-[9px] text-stone-600">6am</span>
                  <span className="text-[9px] text-stone-600">12pm</span>
                  <span className="text-[9px] text-stone-600">6pm</span>
                  <span className="text-[9px] text-stone-600">12am</span>
                </div>
              </div>

              {/* Device Breakdown */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <h3 className="text-sm font-bold text-white mb-4">Device Breakdown</h3>
                <div className="space-y-3">
                  {data.deviceBreakdown.map((d) => (
                    <div key={d.device}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 text-sm text-stone-300 capitalize">
                          {deviceIcon(d.device)}
                          {d.device}
                        </div>
                        <span className="text-xs text-stone-500">{d.count.toLocaleString()} ({d.pct}%)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            d.device === "mobile" ? "bg-blue-500" : d.device === "tablet" ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${d.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {data.deviceBreakdown.length === 0 && (
                    <p className="text-stone-600 text-xs">No data yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Traffic Sources */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="text-sm font-bold text-white mb-4">Traffic Sources</h3>
              <div className="space-y-2">
                {data.trafficSources.map((s, i) => {
                  const maxSource = data.trafficSources[0]?.count || 1;
                  return (
                    <div key={s.source} className="flex items-center gap-3">
                      <span className="w-5 text-right text-[10px] text-stone-600 font-bold">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-stone-300 truncate">{s.source}</span>
                          <span className="text-[10px] text-stone-500 ml-2 shrink-0">{s.count.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-yellow-500/70"
                            style={{ width: `${(s.count / maxSource) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {data.trafficSources.length === 0 && (
                  <p className="text-stone-600 text-xs">No traffic data yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PAGES TAB ──────────────────────────────────────────────── */}
        {activeTab === "pages" && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-5 py-3 border-b border-slate-800 text-[10px] uppercase tracking-wider font-bold text-stone-500">
              <span>Page</span>
              <span className="text-right">Views</span>
              <span className="text-right">Unique</span>
            </div>
            {data.topPages.map((p) => (
              <div key={p.page} className="grid grid-cols-[1fr_80px_80px] gap-2 px-5 py-3 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                <span className="text-sm text-stone-300 truncate font-mono">{p.page}</span>
                <span className="text-sm text-white text-right font-bold">{p.views.toLocaleString()}</span>
                <span className="text-sm text-stone-400 text-right">{p.unique.toLocaleString()}</span>
              </div>
            ))}
            {data.topPages.length === 0 && (
              <div className="px-5 py-8 text-center text-stone-600 text-sm">No page data yet</div>
            )}
          </div>
        )}

        {/* ── GEO TAB ────────────────────────────────────────────────── */}
        {activeTab === "geo" && (
          <div className="space-y-6">
            {/* Countries */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-blue-400" />
                Top Countries
              </h3>
              <div className="space-y-2">
                {data.topCountries.map((c) => {
                  const maxCountry = data.topCountries[0]?.count || 1;
                  return (
                    <div key={c.country} className="flex items-center gap-3">
                      <span className="w-8 text-xs text-stone-400 font-bold">{c.country}</span>
                      <div className="flex-1">
                        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500/70"
                            style={{ width: `${(c.count / maxCountry) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-[10px] text-stone-500 w-12 text-right">{c.count.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cities */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white">Top Cities</h3>
              </div>
              {data.topCities.map((c, i) => (
                <div key={`${c.city}-${c.region}-${i}`} className="flex items-center justify-between px-5 py-2.5 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                  <div>
                    <span className="text-sm text-stone-300">{c.city}</span>
                    {c.region && <span className="text-xs text-stone-500 ml-1.5">{c.region}</span>}
                    {c.country && c.country !== "US" && (
                      <span className="text-[10px] text-stone-600 ml-1">({c.country})</span>
                    )}
                  </div>
                  <span className="text-xs text-stone-400 font-bold">{c.count.toLocaleString()}</span>
                </div>
              ))}
              {data.topCities.length === 0 && (
                <div className="px-5 py-8 text-center text-stone-600 text-sm">No geo data yet — Vercel provides city/region headers on deployed environments</div>
              )}
            </div>
          </div>
        )}

        {/* ── LIVE FEED TAB ──────────────────────────────────────────── */}
        {activeTab === "live" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-stone-400">{kpis.activeNow} active in last 5 min</span>
              </div>
              <button
                onClick={() => fetchData(true)}
                className="text-xs text-yellow-400 hover:text-yellow-300 font-bold"
              >
                Refresh
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden divide-y divide-slate-800/50">
              {data.liveActivity.map((a, i) => (
                <div key={i} className={`px-4 py-3 hover:bg-slate-800/50 transition-colors ${a.is_bot ? "opacity-40" : ""}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-stone-300">{a.page}</span>
                      {a.is_bot && (
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400 uppercase">Bot</span>
                      )}
                    </div>
                    <span className="text-[10px] text-stone-600">{timeAgo(a.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-stone-500">
                    <span className="flex items-center gap-1 capitalize">
                      {deviceIcon(a.device)} {a.device}
                    </span>
                    {a.city && (
                      <span className="flex items-center gap-1">
                        <Globe2 className="h-3 w-3" />
                        {a.city}{a.region ? `, ${a.region}` : ""}{a.country && a.country !== "US" ? ` (${a.country})` : ""}
                      </span>
                    )}
                    {a.referrer && (
                      <span className="truncate max-w-[200px]">
                        via {(() => {
                          try { return new URL(a.referrer).hostname.replace("www.", ""); }
                          catch { return a.referrer.slice(0, 30); }
                        })()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {data.liveActivity.length === 0 && (
                <div className="px-5 py-8 text-center text-stone-600 text-sm">No activity yet</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── KPI Card Component ──────────────────────────────────────────────────

function KPICard({
  icon,
  label,
  value,
  highlight,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 text-center ${
      highlight
        ? "border-yellow-400/30 bg-yellow-400/5"
        : muted
        ? "border-slate-800/50 bg-slate-900/50"
        : "border-slate-800 bg-slate-900"
    }`}>
      <div className="flex justify-center mb-1.5">{icon}</div>
      <p className={`text-xl font-black ${highlight ? "text-yellow-400" : muted ? "text-stone-500" : "text-white"}`}>
        {value}
      </p>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500 mt-0.5">{label}</p>
    </div>
  );
}
