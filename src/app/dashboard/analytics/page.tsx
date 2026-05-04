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
  ChevronDown,
  QrCode,
  MapPin,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getInstallerAnalytics, getQRScanAnalytics, type AnalyticsSummary, type QRScanSummary, type GroupedReferrer } from "@/app/actions/analytics";
import ProPill from "@/components/dashboard/ProPill";

type TimeRange = 7 | 30 | 90;

export default function AnalyticsPage() {
  const supabase = getSupabaseBrowserClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [qrData, setQrData] = useState<QRScanSummary | null>(null);
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
    setLoading(true);
    setError("");

    const [result, qrResult] = await Promise.all([
      getInstallerAnalytics(user.id, range),
      getQRScanAnalytics(user.id, range),
    ]);
    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error || "Failed to load analytics.");
    }
    if (qrResult.success && qrResult.data) {
      setQrData(qrResult.data);
    }
    setLoading(false);
  }, [supabase, range]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center gap-3 md:max-w-3xl lg:max-w-4xl">
          <a
            href="/dashboard"
            className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="flex-1">
            <h1 className="text-sm font-bold uppercase tracking-wider text-white">Analytics</h1>
          </div>

          {/* Time range — inline in header */}
          <div className="flex gap-1">
            {([7, 30, 90] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                  range === r
                    ? "bg-purple-500/20 text-purple-400"
                    : "text-stone-500 hover:text-white"
                }`}
              >
                {r}D
              </button>
            ))}
          </div>
          <ProPill />
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4 md:max-w-3xl lg:max-w-4xl">
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
            {/* ── KPI Strip ────────────────────────────────────────── */}
            <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900 px-3 py-3">
              <div className="flex flex-1 items-center justify-around">
                <KPI icon={Eye} color="text-blue-400" value={data.totalViews.toLocaleString()} label="Views" />
                <div className="h-6 w-px bg-slate-800" />
                <KPI icon={ShoppingCart} color="text-emerald-400" value={data.totalOrders.toLocaleString()} label="Orders" />
                <div className="h-6 w-px bg-slate-800" />
                <KPI icon={TrendingUp} color="text-purple-400" value={`${data.conversionRate}%`} label="Conv" />
                <div className="h-6 w-px bg-slate-800" />
                <KPI icon={DollarSign} color="text-yellow-400" value={`$${data.totalRevenue.toLocaleString()}`} label="Revenue" />
              </div>
            </div>

            {/* ── AOV (if orders exist) ─────────────────────────────── */}
            {data.totalOrders > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-3.5 w-3.5 text-yellow-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Avg Order</span>
                </div>
                <span className="text-sm font-black text-white">${data.avgOrderValue.toLocaleString()}</span>
              </div>
            )}

            {/* ── Daily Trends (views + orders combined) ────────────── */}
            {data.viewsByDay.length > 0 && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">Daily Trend</h2>
                  <div className="ml-auto flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[10px] text-blue-400">
                      <span className="inline-block h-2 w-2 rounded-full bg-blue-500" /> Views
                    </span>
                    {data.ordersByDay.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Orders
                      </span>
                    )}
                  </div>
                </div>
                <DualBarChart viewsByDay={data.viewsByDay} ordersByDay={data.ordersByDay} />
              </section>
            )}

            {/* ── Traffic Sources + Devices (side by side on desktop) ── */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Traffic Sources */}
              {data.groupedReferrers && data.groupedReferrers.length > 0 && (
                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Globe className="h-4 w-4 text-amber-400" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">Traffic Sources</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {data.groupedReferrers.map((group) => (
                      <TrafficSourceTile key={group.group} group={group} totalViews={data.totalViews} />
                    ))}
                  </div>
                </section>
              )}

              {/* Devices */}
              {data.deviceBreakdown.length > 0 && (
                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-cyan-400" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">Devices</h2>
                  </div>
                  <div className="space-y-2">
                    {data.deviceBreakdown.map((d) => {
                      const Icon = d.device === "Mobile" ? Smartphone : d.device === "Tablet" ? Tablet : Monitor;
                      const pct = data.totalViews > 0 ? Math.round((d.count / data.totalViews) * 100) : 0;
                      return (
                        <div key={d.device} className="flex items-center gap-3">
                          <Icon className="h-4 w-4 shrink-0 text-cyan-400" />
                          <span className="w-16 text-xs font-medium text-stone-400">{d.device}</span>
                          <div className="flex-1 h-4 bg-slate-800 rounded overflow-hidden">
                            <div className="h-full rounded bg-cyan-500/60 transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-12 text-right text-xs font-bold text-white">{pct}%</span>
                          <span className="w-10 text-right text-[10px] text-stone-500">{d.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>

            {/* ── Recent Activity Feed ─────────────────────────────── */}
            {data.recentViews.length > 0 && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-purple-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">Recent Visits</h2>
                  <span className="ml-auto text-[10px] text-stone-600">Last 20</span>
                </div>

                {/* Table header */}
                <div className="mb-2 hidden items-center gap-3 px-3 text-[10px] font-bold uppercase tracking-widest text-stone-600 md:flex">
                  <span className="w-24">Page</span>
                  <span className="flex-1">Source</span>
                  <span className="w-16 text-center">Device</span>
                  <span className="w-20 text-right">When</span>
                </div>

                <div className="space-y-1">
                  {data.recentViews.map((v, i) => {
                    const Icon = v.device === "Mobile" ? Smartphone : v.device === "Tablet" ? Tablet : Monitor;
                    return (
                      <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-800/30 px-3 py-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                          <Eye className="h-3 w-3 text-blue-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-white">
                              {v.page === "/design" ? "Design Page" : v.page === "/book" ? "Booking Page" : v.page === "/" ? "Portfolio" : v.page}
                            </span>
                            <span className="hidden text-[10px] text-stone-500 md:inline">
                              via {v.referrer ? cleanReferrerDisplay(v.referrer) : "Direct"}
                            </span>
                          </div>
                          <p className="text-[10px] text-stone-500 md:hidden">
                            {v.referrer ? cleanReferrerDisplay(v.referrer) : "Direct"} · {v.device}
                          </p>
                        </div>
                        <Icon className="hidden h-3.5 w-3.5 shrink-0 text-stone-600 md:block" />
                        <span className="text-[10px] text-stone-600 shrink-0">{timeAgo(v.created_at)}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── QR Code Analytics ────────────────────────────────── */}
            {qrData && qrData.totalScans > 0 && (
              <section className="rounded-2xl border border-purple-500/20 bg-slate-900 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-purple-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">QR Code Scans</h2>
                  <span className="ml-auto rounded-full bg-purple-500/15 px-2.5 py-0.5 text-[10px] font-black text-purple-400">
                    {qrData.totalScans} total
                  </span>
                </div>

                {/* QR daily chart */}
                {qrData.scansByDay.length > 0 && (
                  <div className="mb-4">
                    {renderBarChart(
                      qrData.scansByDay.slice(-14).map((d) => ({
                        label: formatDate(d.date),
                        value: d.scans,
                      })),
                      "bg-purple-500"
                    )}
                  </div>
                )}

                {/* QR devices + locations side by side */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {qrData.deviceBreakdown.length > 0 && (
                    <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-3">
                      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-500">Devices</h3>
                      <div className="space-y-1.5">
                        {qrData.deviceBreakdown.map((d) => {
                          const pct = qrData.totalScans > 0 ? Math.round((d.count / qrData.totalScans) * 100) : 0;
                          return (
                            <div key={d.device} className="flex items-center justify-between">
                              <span className="text-[11px] text-stone-400 capitalize">{d.device}</span>
                              <span className="text-[10px] font-bold text-white">{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {qrData.topLocations.length > 0 && (
                    <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-3">
                      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-500">Top Locations</h3>
                      <div className="space-y-1.5">
                        {qrData.topLocations.slice(0, 5).map((loc) => (
                          <div key={loc.location} className="flex items-center gap-1.5">
                            <MapPin className="h-2.5 w-2.5 text-stone-600 shrink-0" />
                            <span className="flex-1 text-[11px] text-stone-400 truncate">{loc.location}</span>
                            <span className="text-[10px] font-bold text-white">{loc.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* QR recent scans — unified feed with all data per row */}
                {qrData.recentScans.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-500">Recent Scans</h3>
                    <div className="space-y-1 max-h-56 overflow-y-auto">
                      {qrData.recentScans.map((s, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-800/40 px-3 py-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500/10">
                            <QrCode className="h-3 w-3 text-purple-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-medium text-white capitalize">{s.device_type || "unknown"}</span>
                              {s.city && (
                                <span className="text-[10px] text-stone-500 truncate">
                                  {s.city}{s.region ? `, ${s.region}` : ""}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] text-stone-600 shrink-0">{timeAgo(s.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ── Empty State ──────────────────────────────────────── */}
            {data.totalViews === 0 && data.totalOrders === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center">
                <BarChart3 className="mx-auto mb-3 h-10 w-10 text-stone-600" />
                <h3 className="mb-2 text-sm font-bold text-white">No data yet</h3>
                <p className="text-xs text-stone-500">
                  Share your installer link to start tracking visits and conversions.
                </p>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════════════════════════════════════

function KPI({ icon: Icon, color, value, label }: { icon: React.ComponentType<{ className?: string }>; color: string; value: string; label: string }) {
  return (
    <div className="text-center px-1">
      <Icon className={`mx-auto mb-0.5 h-4 w-4 ${color}`} />
      <p className="text-lg font-black text-white leading-tight">{value}</p>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500">{label}</p>
    </div>
  );
}

function DualBarChart({
  viewsByDay,
  ordersByDay,
}: {
  viewsByDay: { date: string; views: number }[];
  ordersByDay: { date: string; orders: number }[];
}) {
  const last14 = viewsByDay.slice(-14);
  const orderMap: Record<string, number> = {};
  for (const o of ordersByDay) orderMap[o.date] = o.orders;
  const maxViews = Math.max(...last14.map((d) => d.views), 1);

  return (
    <div className="flex items-end gap-1" style={{ height: 100 }}>
      {last14.map((d) => {
        const viewH = (d.views / maxViews) * 100;
        const orders = orderMap[d.date] || 0;
        const fmtDate = new Date(d.date + "T12:00:00");
        const label = fmtDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-0.5" title={`${label}: ${d.views} views, ${orders} orders`}>
            <div className="relative w-full flex items-end justify-center" style={{ height: 80 }}>
              <div className="w-full rounded-t bg-blue-500/40 transition-all duration-500" style={{ height: `${viewH}%` }}>
                {orders > 0 && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-slate-900" title={`${orders} order${orders > 1 ? "s" : ""}`} />
                )}
              </div>
            </div>
            <span className="text-[8px] text-stone-600 leading-none hidden sm:block">
              {fmtDate.toLocaleDateString("en-US", { day: "numeric" })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function renderBarChart(items: { label: string; value: number }[], color: string) {
  const maxVal = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="w-16 text-right text-[10px] text-stone-500 shrink-0">{item.label}</span>
          <div className="flex-1 h-4 bg-slate-800 rounded overflow-hidden">
            <div className={`h-full rounded ${color} transition-all duration-500`} style={{ width: `${(item.value / maxVal) * 100}%` }} />
          </div>
          <span className="w-8 text-right text-xs font-bold text-white shrink-0">{item.value}</span>
        </div>
      ))}
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

// ═══════════════════════════════════════════════════════════════════════════
// Traffic Source Tile
// ═══════════════════════════════════════════════════════════════════════════

const SOURCE_COLORS: Record<string, string> = {
  Facebook: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  Instagram: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  Google: "bg-red-500/15 text-red-400 border-red-500/20",
  YouTube: "bg-red-500/15 text-red-400 border-red-500/20",
  TikTok: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  "X / Twitter": "bg-sky-500/15 text-sky-400 border-sky-500/20",
  LinkedIn: "bg-blue-600/15 text-blue-300 border-blue-600/20",
  Nextdoor: "bg-green-500/15 text-green-400 border-green-500/20",
  Pinterest: "bg-red-400/15 text-red-300 border-red-400/20",
  Reddit: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  Direct: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  Bing: "bg-teal-500/15 text-teal-400 border-teal-500/20",
  Yahoo: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  Craigslist: "bg-violet-500/15 text-violet-400 border-violet-500/20",
};

const DEFAULT_COLOR = "bg-slate-700/30 text-stone-300 border-slate-600/30";

function TrafficSourceTile({ group, totalViews }: { group: GroupedReferrer; totalViews: number }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = SOURCE_COLORS[group.group] || DEFAULT_COLOR;
  const pct = totalViews > 0 ? Math.round((group.totalCount / totalViews) * 100) : 0;
  const hasDetails = group.details.length > 1 || (group.details.length === 1 && group.group !== group.details[0].url);

  return (
    <div
      className={`rounded-xl border p-3 transition-all ${colorClass} ${hasDetails ? "cursor-pointer hover:brightness-110" : ""} ${expanded ? "col-span-2" : ""}`}
      onClick={() => hasDetails && setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold truncate">{group.group}</p>
          <p className="text-[10px] opacity-70">{group.totalCount} · {pct}%</p>
        </div>
        {hasDetails && (
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 opacity-50 transition-transform ${expanded ? "rotate-180" : ""}`} />
        )}
      </div>
      {expanded && hasDetails && (
        <div className="mt-2 space-y-1 border-t border-current/10 pt-2">
          {group.details.map((d) => (
            <div key={d.url} className="flex items-center justify-between gap-2">
              <span className="truncate text-[11px] opacity-80">{d.url}</span>
              <span className="shrink-0 text-[10px] font-bold">{d.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
