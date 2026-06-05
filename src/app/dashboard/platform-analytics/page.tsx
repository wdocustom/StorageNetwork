"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getAdminPlatformAnalytics, type PlatformAnalyticsData } from "@/app/actions/platform-analytics";
import { getInstallerActivityReport, type InstallerActivitySummary } from "@/app/actions/installer-activity";
import {
  getVisitorSessions,
  getWatchlist,
  addWatchlistEntry,
  removeWatchlistEntry,
  type VisitorSession,
  type WatchlistEntry,
} from "@/app/actions/visitor-intel";
import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Eye,
  Globe2,
  Loader2,
  Monitor,
  Plus,
  RefreshCw,
  Smartphone,
  Tablet,
  Trash2,
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
  const [activeTab, setActiveTab] = useState<"traffic" | "live" | "sessions" | "watchlist" | "installers" | "business">("traffic");
  const [installerData, setInstallerData] = useState<InstallerActivitySummary[]>([]);
  const [installerLoading, setInstallerLoading] = useState(false);
  const [expandedInstaller, setExpandedInstaller] = useState<string | null>(null);

  // Sessions tab state
  const [sessions, setSessions] = useState<VisitorSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsHours, setSessionsHours] = useState<24 | 72 | 168>(24);
  const [sessionsIncludeBots, setSessionsIncludeBots] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  // Watchlist state
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [newWatchLabel, setNewWatchLabel] = useState("");
  const [newWatchIp, setNewWatchIp] = useState("");
  const [newWatchVisitor, setNewWatchVisitor] = useState("");
  const [newWatchNote, setNewWatchNote] = useState("");
  const [addingWatch, setAddingWatch] = useState(false);

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

  const fetchInstallerActivity = useCallback(async () => {
    setInstallerLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const result = await getInstallerActivityReport(user.id, range);
    if (result.installers) setInstallerData(result.installers);
    setInstallerLoading(false);
  }, [supabase, range]);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSessionsLoading(false); return; }
    const result = await getVisitorSessions(user.id, sessionsHours, { includeBots: sessionsIncludeBots });
    if (result.success && result.sessions) setSessions(result.sessions);
    setSessionsLoading(false);
  }, [supabase, sessionsHours, sessionsIncludeBots]);

  const fetchWatchlist = useCallback(async () => {
    setWatchlistLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setWatchlistLoading(false); return; }
    const result = await getWatchlist(user.id);
    if (result.success && result.entries) setWatchlist(result.entries);
    setWatchlistLoading(false);
  }, [supabase]);

  async function handleAddWatch() {
    setWatchlistError(null);
    if (!newWatchLabel.trim()) {
      setWatchlistError("Label is required.");
      return;
    }
    if (!newWatchIp.trim() && !newWatchVisitor.trim()) {
      setWatchlistError("Provide at least an IP or a visitor ID.");
      return;
    }
    setAddingWatch(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAddingWatch(false); return; }
    const result = await addWatchlistEntry(user.id, {
      label: newWatchLabel.trim(),
      ip: newWatchIp.trim() || null,
      visitor_id: newWatchVisitor.trim() || null,
      note: newWatchNote.trim() || null,
    });
    if (result.success) {
      setNewWatchLabel("");
      setNewWatchIp("");
      setNewWatchVisitor("");
      setNewWatchNote("");
      await fetchWatchlist();
    } else {
      setWatchlistError(result.error ?? "Failed to add watch entry.");
    }
    setAddingWatch(false);
  }

  async function handleRemoveWatch(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const result = await removeWatchlistEntry(user.id, id);
    if (result.success) await fetchWatchlist();
  }

  async function quickPinFromSession(s: VisitorSession) {
    const label = window.prompt(
      `Label this visitor (e.g. "Alex" or "Spy 1"):`,
      s.city ? `Visitor from ${s.city}` : "Suspicious visitor"
    );
    if (!label) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await addWatchlistEntry(user.id, {
      label,
      ip: s.ip,
      visitor_id: s.visitor_id,
      note: `Pinned from session: ${s.page_count} pages, score ${s.suspicion_score}`,
    });
    await fetchSessions();
    await fetchWatchlist();
  }

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load installer activity when tab is selected
  useEffect(() => {
    if (activeTab === "installers" && installerData.length === 0 && !installerLoading) {
      fetchInstallerActivity();
    }
  }, [activeTab, installerData.length, installerLoading, fetchInstallerActivity]);

  // Load sessions when tab opens or filters change
  useEffect(() => {
    if (activeTab === "sessions") fetchSessions();
  }, [activeTab, fetchSessions]);

  // Load watchlist when tab opens
  useEffect(() => {
    if (activeTab === "watchlist") fetchWatchlist();
  }, [activeTab, fetchWatchlist]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
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
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="rounded-lg p-1.5 text-stone-500 hover:bg-zinc-800 hover:text-white transition-colors">
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
              className="rounded-lg p-2 text-stone-500 hover:bg-zinc-800 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            {/* Time Range */}
            <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
              {([7, 30, 90] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                    range === r
                      ? "bg-yellow-400 text-zinc-900"
                      : "bg-zinc-800 text-stone-400 hover:text-white"
                  }`}
                >
                  {r}d
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        {/* ── KPI Strip ────────────────────────────────────────────── */}
        <div className="flex items-center rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <div className="flex flex-1 items-center justify-around">
            <div className="text-center px-2">
              <p className="text-lg font-black text-white">{kpis.totalViews.toLocaleString()}</p>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500">Views</p>
            </div>
            <div className="h-8 w-px bg-zinc-800" />
            <div className="text-center px-2">
              <p className="text-lg font-black text-white">{kpis.uniqueVisitors.toLocaleString()}</p>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500">Unique</p>
            </div>
            <div className="h-8 w-px bg-zinc-800" />
            <div className="text-center px-2">
              <p className="text-lg font-black text-yellow-400">{kpis.activeNow}</p>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500">Active Now</p>
            </div>
            <div className="h-8 w-px bg-zinc-800" />
            <div className="text-center px-2">
              <p className="text-lg font-black text-white">{kpis.avgPagesPerSession}</p>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500">Pg/Session</p>
            </div>
            {kpis.botViews > 0 && (<>
              <div className="h-8 w-px bg-zinc-800" />
              <div className="text-center px-2 opacity-50">
                <p className="text-lg font-black text-stone-500">{kpis.botViews.toLocaleString()}</p>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-600">Bots</p>
              </div>
            </>)}
          </div>
        </div>

        {/* ── Tab Navigation ─────────────────────────────────────────── */}
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900 p-1">
          {(["traffic", "live", "sessions", "watchlist", "installers", "business"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === tab
                  ? "bg-yellow-400 text-zinc-900"
                  : "text-stone-500 hover:text-white"
              }`}
            >
              {tab === "traffic"
                ? "Traffic"
                : tab === "live"
                  ? "Live"
                  : tab === "sessions"
                    ? "Sessions"
                    : tab === "watchlist"
                      ? "Watchlist"
                      : tab === "installers"
                        ? "Installers"
                        : "Business"}
            </button>
          ))}
        </div>

        {/* ── TRAFFIC TAB ──────────────────────────────────────────── */}
        {activeTab === "traffic" && (
          <div className="space-y-5">
            {/* Views by Day Chart */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h3 className="text-sm font-bold text-white mb-4">Views Over Time</h3>
              <div className="flex items-stretch gap-[2px] h-32">
                {data.viewsByDay.slice(-Math.min(data.viewsByDay.length, range)).map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end group relative">
                    <div
                      className="w-full bg-blue-500/80 rounded-t hover:bg-blue-400 transition-colors min-h-[2px]"
                      style={{ height: `${(d.views / maxDayViews) * 100}%` }}
                    />
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-[10px] whitespace-nowrap z-10">
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

            {/* Hourly + Devices + Sources — 3-col on desktop */}
            <div className="grid gap-4 md:grid-cols-3">
              {/* Hourly Pattern */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">Hourly Pattern</h3>
                <div className="flex items-stretch gap-[1px] h-20">
                  {data.viewsByHour.map((h) => (
                    <div key={h.hour} className="flex-1 flex flex-col items-center justify-end group relative">
                      <div
                        className="w-full bg-purple-500/70 rounded-t hover:bg-purple-400 transition-colors min-h-[1px]"
                        style={{ height: `${(h.views / maxHourViews) * 100}%` }}
                      />
                      <div className="absolute bottom-full mb-1 hidden group-hover:block bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-[10px] whitespace-nowrap z-10">
                        <p className="text-white font-bold">{h.views} views</p>
                        <p className="text-stone-500">{h.hour}:00</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[8px] text-stone-600">12a</span>
                  <span className="text-[8px] text-stone-600">6a</span>
                  <span className="text-[8px] text-stone-600">12p</span>
                  <span className="text-[8px] text-stone-600">6p</span>
                </div>
              </div>

              {/* Devices */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">Devices</h3>
                <div className="space-y-2.5">
                  {data.deviceBreakdown.map((d) => (
                    <div key={d.device}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5 text-xs text-stone-300 capitalize">
                          {deviceIcon(d.device)} {d.device}
                        </span>
                        <span className="text-[10px] text-stone-500">{d.count.toLocaleString()} ({d.pct}%)</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                        <div className={`h-full rounded-full ${d.device === "mobile" ? "bg-blue-500" : d.device === "tablet" ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${d.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Traffic Sources */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">Sources</h3>
                <div className="space-y-1.5">
                  {data.trafficSources.slice(0, 8).map((s) => {
                    const maxSource = data.trafficSources[0]?.count || 1;
                    return (
                      <div key={s.source} className="flex items-center gap-2">
                        <span className="w-24 truncate text-xs text-stone-300">{s.source}</span>
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-yellow-500/70" style={{ width: `${(s.count / maxSource) * 100}%` }} />
                        </div>
                        <span className="w-8 text-right text-[10px] text-stone-500 font-bold">{s.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Top Pages + Top Cities side by side */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Top Pages */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Top Pages</h3>
                  <span className="text-[9px] text-stone-600">Views / Unique</span>
                </div>
                {data.topPages.slice(0, 10).map((p) => (
                  <div key={p.page} className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/30 hover:bg-zinc-800/50 transition-colors">
                    <span className="text-xs text-stone-300 truncate font-mono mr-3">{p.page}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-white font-bold">{p.views.toLocaleString()}</span>
                      <span className="text-[10px] text-stone-500">/ {p.unique.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                {data.topPages.length === 0 && (
                  <div className="px-4 py-6 text-center text-stone-600 text-xs">No page data yet</div>
                )}
              </div>

              {/* Top Cities */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
                  <Globe2 className="h-3.5 w-3.5 text-blue-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Top Cities</h3>
                </div>
                {data.topCities.slice(0, 10).map((c, i) => (
                  <div key={`${c.city}-${c.region}-${i}`} className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/30 hover:bg-zinc-800/50 transition-colors">
                    <div className="min-w-0">
                      <span className="text-xs text-stone-300">{c.city}</span>
                      {c.region && <span className="text-[10px] text-stone-500 ml-1">{c.region}</span>}
                      {c.country && c.country !== "US" && <span className="text-[10px] text-stone-600 ml-1">({c.country})</span>}
                    </div>
                    <span className="text-[10px] text-stone-400 font-bold shrink-0">{c.count.toLocaleString()}</span>
                  </div>
                ))}
                {data.topCities.length === 0 && (
                  <div className="px-4 py-6 text-center text-stone-600 text-xs">Geo data available on deployed environments</div>
                )}
              </div>
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

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden divide-y divide-zinc-800/50">
              {data.liveActivity.map((a, i) => (
                <div
                  key={i}
                  className={`px-4 py-3 hover:bg-zinc-800/50 transition-colors ${a.is_bot ? "opacity-40" : ""} ${a.watchlist_label ? "border-l-4 border-l-red-500 bg-red-500/5" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {a.watchlist_label && (
                        <span className="rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                          {a.watchlist_label}
                        </span>
                      )}
                      <span className="font-mono text-xs text-stone-300 truncate">{a.page}</span>
                      {a.is_bot && (
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400 uppercase">Bot</span>
                      )}
                    </div>
                    <span className="text-[10px] text-stone-600 whitespace-nowrap ml-2">{timeAgo(a.created_at)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-stone-500">
                    <span className="flex items-center gap-1 capitalize">
                      {deviceIcon(a.device)} {a.device}
                    </span>
                    {a.city && (
                      <span className="flex items-center gap-1">
                        <Globe2 className="h-3 w-3" />
                        {a.city}{a.region ? `, ${a.region}` : ""}{a.country && a.country !== "US" ? ` (${a.country})` : ""}
                      </span>
                    )}
                    {a.ip && (
                      <span className="font-mono text-stone-400">{a.ip}</span>
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
        {/* ── SESSIONS TAB — Visitor Intelligence ────────────────────── */}
        {activeTab === "sessions" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-yellow-400" />
                <h3 className="text-sm font-bold text-white">Visitor Sessions</h3>
                <span className="text-xs text-stone-500">
                  ({sessions.length} shown — sorted: watchlist → suspicion → recency)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {([24, 72, 168] as const).map((h) => (
                  <button
                    key={h}
                    onClick={() => setSessionsHours(h)}
                    className={`rounded px-2.5 py-1 text-[10px] font-bold uppercase ${
                      sessionsHours === h ? "bg-yellow-400 text-zinc-900" : "bg-zinc-800 text-stone-400"
                    }`}
                  >
                    {h === 24 ? "24h" : h === 72 ? "3d" : "7d"}
                  </button>
                ))}
                <label className="flex items-center gap-1 text-[10px] text-stone-500">
                  <input
                    type="checkbox"
                    checked={sessionsIncludeBots}
                    onChange={(e) => setSessionsIncludeBots(e.target.checked)}
                  />
                  Include bots
                </label>
                <button
                  onClick={fetchSessions}
                  disabled={sessionsLoading}
                  className="rounded bg-zinc-800 p-1.5 text-stone-400 hover:text-white"
                >
                  <RefreshCw className={`h-3 w-3 ${sessionsLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {sessionsLoading && (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
              </div>
            )}

            {!sessionsLoading && sessions.length === 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-8 text-center text-stone-600 text-sm">
                No sessions in the selected window.
              </div>
            )}

            {!sessionsLoading && sessions.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800/50">
                {sessions.map((s) => {
                  const isOpen = expandedSession === s.session_key;
                  const score = s.suspicion_score;
                  const scoreColor =
                    score >= 60 ? "text-red-400 bg-red-500/10 border-red-500/30" :
                    score >= 30 ? "text-amber-300 bg-amber-500/10 border-amber-500/30" :
                    "text-stone-500 bg-zinc-800 border-zinc-700";
                  return (
                    <div
                      key={s.session_key}
                      className={`px-4 py-3 ${s.watchlist_label ? "border-l-4 border-l-red-500 bg-red-500/5" : ""}`}
                    >
                      <button
                        onClick={() => setExpandedSession(isOpen ? null : s.session_key)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {s.watchlist_label && (
                                <span className="rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                                  {s.watchlist_label}
                                </span>
                              )}
                              <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${scoreColor}`}>
                                Score {score}
                              </span>
                              {s.is_bot && (
                                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400 uppercase">Bot</span>
                              )}
                              <span className="text-xs font-semibold text-white">
                                {s.page_count} page{s.page_count === 1 ? "" : "s"}
                              </span>
                              <span className="text-[10px] text-stone-500">
                                {Math.round(s.duration_seconds / 60)}m {s.duration_seconds % 60}s
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-stone-400">
                              <span className="flex items-center gap-1 capitalize">
                                {deviceIcon(s.device_type)} {s.device_type}
                              </span>
                              {s.city && (
                                <span className="flex items-center gap-1">
                                  <Globe2 className="h-3 w-3" />
                                  {s.city}{s.region ? `, ${s.region}` : ""}{s.country && s.country !== "US" ? ` (${s.country})` : ""}
                                </span>
                              )}
                              {s.ip && <span className="font-mono text-stone-300">{s.ip}</span>}
                              {s.referrer && (
                                <span className="truncate max-w-[200px]">
                                  via {(() => {
                                    try { return new URL(s.referrer).hostname.replace("www.", ""); }
                                    catch { return s.referrer.slice(0, 30); }
                                  })()}
                                </span>
                              )}
                            </div>
                            {s.suspicion_reasons.length > 0 && (
                              <div className="mt-1 text-[10px] text-amber-300/80">
                                {s.suspicion_reasons.join(" • ")}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="text-[10px] text-stone-600">{timeAgo(s.last_seen)}</span>
                            {isOpen ? (
                              <ChevronUp className="h-4 w-4 text-stone-500" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-stone-500" />
                            )}
                          </div>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="mt-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[10px] text-stone-500">
                              session_id: <span className="font-mono text-stone-300">{s.session_id ?? "—"}</span>
                              {" · "}
                              visitor_id: <span className="font-mono text-stone-300">{s.visitor_id ?? "—"}</span>
                            </div>
                            {!s.watchlist_label && (s.ip || s.visitor_id) && (
                              <button
                                onClick={() => quickPinFromSession(s)}
                                className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-[10px] font-bold uppercase text-red-300 hover:bg-red-500/30"
                              >
                                <Plus className="h-3 w-3" />
                                Pin to Watchlist
                              </button>
                            )}
                          </div>
                          {s.user_agent && (
                            <div className="text-[10px] text-stone-500 break-all">
                              UA: <span className="text-stone-400">{s.user_agent}</span>
                            </div>
                          )}
                          {(s.utm_source || s.utm_medium || s.utm_campaign) && (
                            <div className="text-[10px] text-stone-500">
                              UTM: {[s.utm_source, s.utm_medium, s.utm_campaign].filter(Boolean).join(" / ")}
                            </div>
                          )}
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Page journey</p>
                            <ol className="space-y-1">
                              {s.pages.map((p, i) => (
                                <li key={i} className="flex items-baseline gap-2 text-[11px]">
                                  <span className="w-6 text-right text-stone-600">{i + 1}.</span>
                                  <span className="font-mono text-stone-200">{p.page_path}</span>
                                  <span className="text-[9px] text-stone-600">
                                    {new Date(p.created_at).toLocaleTimeString()}
                                  </span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── WATCHLIST TAB ──────────────────────────────────────────── */}
        {activeTab === "watchlist" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Eye className="h-4 w-4 text-red-400" />
                Visitor Watchlist
              </h3>
              <button
                onClick={fetchWatchlist}
                disabled={watchlistLoading}
                className="rounded bg-zinc-800 p-1.5 text-stone-400 hover:text-white"
              >
                <RefreshCw className={`h-3 w-3 ${watchlistLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Pin a visitor
              </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <input
                  value={newWatchLabel}
                  onChange={(e) => setNewWatchLabel(e.target.value)}
                  placeholder="Label (e.g. Alex - home IP)"
                  className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white outline-none focus:border-yellow-400"
                />
                <input
                  value={newWatchIp}
                  onChange={(e) => setNewWatchIp(e.target.value)}
                  placeholder="IP address (optional)"
                  className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white font-mono outline-none focus:border-yellow-400"
                />
                <input
                  value={newWatchVisitor}
                  onChange={(e) => setNewWatchVisitor(e.target.value)}
                  placeholder="Visitor ID (optional)"
                  className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white font-mono outline-none focus:border-yellow-400"
                />
                <input
                  value={newWatchNote}
                  onChange={(e) => setNewWatchNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white outline-none focus:border-yellow-400"
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                {watchlistError ? (
                  <p className="text-[11px] text-red-400">{watchlistError}</p>
                ) : (
                  <p className="text-[10px] text-stone-600">
                    Either an IP, a visitor ID, or both. Pinned entries highlight in Live + Sessions.
                  </p>
                )}
                <button
                  onClick={handleAddWatch}
                  disabled={addingWatch}
                  className="flex items-center gap-1 rounded-md bg-yellow-400 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-900 hover:bg-yellow-300 disabled:opacity-40"
                >
                  {addingWatch ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Pin
                </button>
              </div>
            </div>

            {watchlistLoading && (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
              </div>
            )}

            {!watchlistLoading && watchlist.length === 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-8 text-center text-stone-600 text-sm">
                No watchlist entries yet. Pin one above, or click &quot;Pin to Watchlist&quot; on a suspicious session.
              </div>
            )}

            {!watchlistLoading && watchlist.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800/50">
                {watchlist.map((w) => (
                  <div key={w.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                            {w.label}
                          </span>
                          <span className="text-[10px] text-stone-500">
                            {w.recent_hits} hits in last 7d
                          </span>
                          {w.last_seen && (
                            <span className="text-[10px] text-stone-600">
                              · last seen {timeAgo(w.last_seen)}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px]">
                          {w.ip && <span className="font-mono text-stone-300">IP: {w.ip}</span>}
                          {w.visitor_id && (
                            <span className="font-mono text-stone-300 truncate max-w-[200px]">
                              Visitor: {w.visitor_id}
                            </span>
                          )}
                        </div>
                        {w.note && <p className="mt-1 text-[10px] text-stone-500">{w.note}</p>}
                      </div>
                      <button
                        onClick={() => handleRemoveWatch(w.id)}
                        className="rounded p-1.5 text-stone-500 hover:bg-zinc-800 hover:text-red-400"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── INSTALLERS TAB ────────────────────────────────────────── */}
        {activeTab === "installers" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-yellow-400" />
                Installer Activity — Last {range} Days
              </h3>
              <button
                onClick={fetchInstallerActivity}
                disabled={installerLoading}
                className="rounded-lg p-2 text-stone-500 hover:bg-zinc-800 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${installerLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {installerLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
              </div>
            ) : installerData.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-12 text-center text-stone-600 text-sm">
                No installer activity recorded yet. Activity will appear as installers use the dashboard.
              </div>
            ) : (
              <div className="space-y-3">
                {installerData.map((inst) => (
                  <div key={inst.installerId} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                    {/* Installer Summary Row */}
                    <button
                      onClick={() => setExpandedInstaller(expandedInstaller === inst.installerId ? null : inst.installerId)}
                      className="w-full flex items-center gap-3 px-5 py-4 hover:bg-zinc-800/50 transition-colors text-left"
                    >
                      {/* Avatar */}
                      {inst.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={inst.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover border-2 border-zinc-700 shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-stone-500">{inst.installerName.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      {/* Name + Business */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                          {inst.businessName || inst.installerName}
                        </p>
                        <p className="text-[10px] text-stone-500 truncate">
                          {inst.email}
                        </p>
                      </div>
                      {/* Stats */}
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-black text-yellow-400">{inst.totalActions}</p>
                          <p className="text-[9px] text-stone-600 uppercase">Actions</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-stone-400">{timeAgo(inst.lastActive)}</p>
                          <p className="text-[9px] text-stone-600 uppercase">Last Active</p>
                        </div>
                        {expandedInstaller === inst.installerId
                          ? <ChevronUp className="h-4 w-4 text-stone-600" />
                          : <ChevronDown className="h-4 w-4 text-stone-600" />
                        }
                      </div>
                    </button>

                    {/* Expanded Detail */}
                    {expandedInstaller === inst.installerId && (
                      <div className="border-t border-zinc-800 px-5 py-4 space-y-4">
                        {/* Top Pages + Top Actions side-by-side */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Top Pages */}
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2">Top Pages Visited</p>
                            <div className="space-y-1">
                              {inst.topPages.map((p) => (
                                <div key={p.page} className="flex items-center justify-between text-xs">
                                  <span className="text-stone-300 truncate mr-2 font-mono text-[11px]">{p.page}</span>
                                  <span className="text-yellow-400 font-bold shrink-0">{p.count}</span>
                                </div>
                              ))}
                              {inst.topPages.length === 0 && <p className="text-stone-600 text-xs">No page views</p>}
                            </div>
                          </div>
                          {/* Top Actions */}
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2">Action Breakdown</p>
                            <div className="space-y-1">
                              {inst.topActions.map((a) => (
                                <div key={a.action} className="flex items-center justify-between text-xs">
                                  <span className="text-stone-300 truncate mr-2">
                                    {a.action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                  </span>
                                  <span className="text-emerald-400 font-bold shrink-0">{a.count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Recent Activity Timeline */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2">Recent Activity</p>
                          <div className="space-y-1 max-h-64 overflow-y-auto">
                            {inst.recentActivity.map((act, i) => (
                              <div key={i} className="flex items-center gap-3 rounded-lg bg-zinc-800/50 px-3 py-2 text-xs">
                                <span className="text-stone-600 text-[10px] font-mono shrink-0 w-16">{timeAgo(act.created_at)}</span>
                                <span className="inline-block rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] font-bold text-stone-300 shrink-0">
                                  {act.action.replace(/_/g, " ")}
                                </span>
                                {act.page_path && (
                                  <span className="text-stone-500 truncate font-mono text-[10px]">{act.page_path}</span>
                                )}
                                {act.detail && Object.keys(act.detail).length > 0 && (
                                  <span className="text-stone-600 truncate text-[10px]">
                                    {Object.entries(act.detail).map(([k, v]) => `${k}: ${v}`).join(", ")}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* ── BUSINESS TAB ──────────────────────────────────────────── */}
        {activeTab === "business" && (
          <div className="space-y-5">
            {/* Business KPI Strip */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
                <p className="text-2xl font-black text-white">{data.businessMetrics.totalInstallers}</p>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500 mt-1">Total Installers</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                <p className="text-2xl font-black text-emerald-400">{data.businessMetrics.newSignups}</p>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500 mt-1">New Signups</p>
              </div>
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-center">
                <p className="text-2xl font-black text-blue-400">{data.businessMetrics.bookingsInPeriod}</p>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500 mt-1">Bookings</p>
              </div>
              <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-center">
                <p className="text-2xl font-black text-yellow-400">${data.businessMetrics.revenueInPeriod.toLocaleString()}</p>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500 mt-1">Revenue</p>
              </div>
              <div className="col-span-2 md:col-span-1 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 text-center">
                <p className="text-2xl font-black text-purple-400">{data.businessMetrics.conversionRate}%</p>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500 mt-1">Visitor → Booking</p>
              </div>
            </div>

            {/* Top Installers by Bookings */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-yellow-400" />
                  Top Installers by Bookings
                </h3>
                <span className="text-[9px] text-stone-600">Last {range} days</span>
              </div>
              {data.businessMetrics.topInstallersByBookings.length > 0 ? (
                <div className="divide-y divide-zinc-800/50">
                  {data.businessMetrics.topInstallersByBookings.map((inst, i) => {
                    const maxBookings = data.businessMetrics.topInstallersByBookings[0]?.bookings || 1;
                    return (
                      <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-800/50 transition-colors">
                        <span className={`text-sm font-black w-6 text-center ${i < 3 ? "text-yellow-400" : "text-stone-600"}`}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{inst.name}</p>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-yellow-500/70"
                              style={{ width: `${(inst.bookings / maxBookings) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-black text-white">{inst.bookings}</p>
                            <p className="text-[9px] text-stone-600 uppercase">Jobs</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-emerald-400">${inst.revenue.toLocaleString()}</p>
                            <p className="text-[9px] text-stone-600 uppercase">Revenue</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-5 py-8 text-center text-stone-600 text-sm">No booking data for this period</div>
              )}
            </div>

            {/* Funnel Summary */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-4 flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                Conversion Funnel
              </h3>
              <div className="flex items-center gap-2">
                {[
                  { label: "Visitors", value: kpis.uniqueVisitors.toLocaleString(), color: "bg-blue-500" },
                  { label: "Signups", value: data.businessMetrics.newSignups.toString(), color: "bg-emerald-500" },
                  { label: "Bookings", value: data.businessMetrics.bookingsInPeriod.toString(), color: "bg-yellow-500" },
                ].map((step, i, arr) => (
                  <div key={step.label} className="flex items-center gap-2 flex-1">
                    <div className="flex-1 text-center">
                      <div className={`h-2 rounded-full ${step.color} mb-2`} />
                      <p className="text-lg font-black text-white">{step.value}</p>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500">{step.label}</p>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="text-stone-700 shrink-0">→</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
