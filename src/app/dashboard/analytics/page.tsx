"use client";

import { useCallback, useEffect, useState, type ReactNode, type ComponentType } from "react";
import {
  ArrowLeft,
  BarChart3,
  Eye,
  TrendingUp,
  DollarSign,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Loader2,
  Calendar,
  Activity,
  ChevronDown,
  QrCode,
  MapPin,
  Zap,
  Target,
  Briefcase,
  Users,
  Star,
  ArrowRight,
  TrendingDown,
  Pencil,
  User,
  CheckCircle,
  Award,
  Package,
  Filter,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  getInstallerAnalytics,
  getQRScanAnalytics,
  type AnalyticsSummary,
  type QRScanSummary,
  type GroupedReferrer,
} from "@/app/actions/analytics";
import ProPill from "@/components/dashboard/ProPill";

type TimeRange = 7 | 30 | 90;

// ═══════════════════════════════════════════════════════════════════════════
// Mock-data types
// (TODO: replace with real server actions returning these shapes)
// ═══════════════════════════════════════════════════════════════════════════

interface InsightItem {
  id: number;
  icon: ReactNode;
  headline: string;
  body: string;
  cta?: { label: string; href: string };
}

interface FunnelStage {
  stage: string;
  count: number;
  icon: ComponentType<{ className?: string }>;
}

interface HotZone {
  zip: string;
  jobsWon: number;
  avgJobSize: number;
  trend: "up" | "down" | "flat";
}

interface ProductMixItem {
  label: string;
  pct: number;
  revenue: number;
  color: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Mock-data helpers
// ═══════════════════════════════════════════════════════════════════════════

function buildFunnel(totalViews: number, totalOrders: number): FunnelStage[] {
  // TODO: wire stages 2-3 to real design-started / contact-captured events
  return [
    { stage: "Page Views",      count: totalViews,                     icon: Eye },
    { stage: "Designs Started", count: Math.round(totalViews * 0.37),  icon: Pencil },
    { stage: "Contact Info",    count: Math.round(totalViews * 0.105), icon: User },
    { stage: "Deposit Paid",    count: totalOrders,                    icon: CheckCircle },
  ];
}

function buildHotZones(): HotZone[] {
  // TODO: join leads/orders with zip-code column
  return [
    { zip: "68116", jobsWon: 8, avgJobSize: 975,  trend: "up" },
    { zip: "68130", jobsWon: 6, avgJobSize: 850,  trend: "flat" },
    { zip: "68022", jobsWon: 4, avgJobSize: 1125, trend: "up" },
  ];
}

function buildProductMix(totalRevenue: number): ProductMixItem[] {
  // TODO: derive from order detail / add-on flags
  return [
    { label: "With Totes",  pct: 55, revenue: Math.round(totalRevenue * 0.55), color: "#F5D033" },
    { label: "Frame Only",  pct: 30, revenue: Math.round(totalRevenue * 0.30), color: "#71717A" },
    { label: "Plywood Top", pct: 15, revenue: Math.round(totalRevenue * 0.15), color: "#34D399" },
  ];
}

function buildKPIs(data: AnalyticsSummary | null) {
  const orders  = data?.totalOrders  ?? 0;
  const revenue = data?.totalRevenue ?? 0;
  const views   = data?.totalViews   ?? 0;
  return {
    pipelineValue:  7800,   // TODO: sum(estimated_price) where deposit_paid = false
    winRate:        orders > 0 ? 34 : 0, // TODO: orders / total_contacts_captured
    avgJobSize:     data?.avgOrderValue ?? 0,
    revenuePerLead: views > 0 ? Math.round(revenue / views) : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════════════════

export default function AnalyticsPage() {
  const supabase = getSupabaseBrowserClient();
  const [loading,  setLoading]  = useState(true);
  const [data,     setData]     = useState<AnalyticsSummary | null>(null);
  const [qrData,   setQrData]   = useState<QRScanSummary | null>(null);
  const [error,    setError]    = useState("");
  const [range,    setRange]    = useState<TimeRange>(30);
  const [insight,  setInsight]  = useState(0);

  const fetchAnalytics = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    setLoading(true);
    setError("");
    const [result, qrResult] = await Promise.all([
      getInstallerAnalytics(user.id, range),
      getQRScanAnalytics(user.id, range),
    ]);
    if (result.success && result.data)   setData(result.data);
    else                                 setError(result.error || "Failed to load analytics.");
    if (qrResult.success && qrResult.data) setQrData(qrResult.data);
    setLoading(false);
  }, [supabase, range]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  // Derived data (real + mock blended)
  const kpis       = buildKPIs(data);
  const funnel     = buildFunnel(data?.totalViews ?? 847, data?.totalOrders ?? 24);
  const hotZones   = buildHotZones();
  const productMix = buildProductMix(data?.totalRevenue ?? 14200);

  const insights: InsightItem[] = [
    {
      id: 0,
      icon: <Zap className="h-5 w-5 text-[#F5D033]" />,
      headline: "3 incomplete designs from ZIP 68130",
      body: "Calling these leads today could close $2,400 in revenue.",
      cta: { label: "View Leads", href: "/dashboard" },
    },
    {
      id: 1,
      icon: <TrendingUp className="h-5 w-5 text-[#F5D033]" />,
      headline: "'Turnkey with Totes' converts 40% higher",
      body: "Consider making it your default pitch on every quote.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 px-4 py-3.5 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <a
            href="/dashboard"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="flex-1">
            <h1 className="text-sm font-bold uppercase tracking-widest text-white">
              Intelligence Dashboard
            </h1>
          </div>
          <div className="flex gap-1">
            {([7, 30, 90] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                  range === r
                    ? "bg-[#F5D033]/15 text-[#F5D033]"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                {r}D
              </button>
            ))}
          </div>
          <ProPill />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 p-4">

        {/* ── Loading ─────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#F5D033]" />
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────── */}
        {!loading && error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* ── Dashboard ───────────────────────────────────────────────── */}
        {!loading && !error && (
          <>
            {/* 1 ── Money Moves Banner ──────────────────────────────── */}
            <MoneyMovesBanner
              insights={insights}
              active={insight}
              onNext={() => setInsight((p) => (p + 1) % insights.length)}
            />

            {/* 2 ── Core Metric Cards ───────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard
                icon={<Briefcase className="h-5 w-5" />}
                label="Pipeline Value"
                value={`$${kpis.pipelineValue.toLocaleString()}`}
                sub="Quotes not yet deposited"
                accent="yellow"
              />
              <MetricCard
                icon={<Target className="h-5 w-5" />}
                label="Win Rate"
                value={kpis.winRate > 0 ? `${kpis.winRate}%` : "—"}
                sub="Quotes → paid deposits"
                accent="emerald"
              />
              <MetricCard
                icon={<DollarSign className="h-5 w-5" />}
                label="Avg Job Size"
                value={kpis.avgJobSize > 0 ? `$${kpis.avgJobSize.toLocaleString()}` : "—"}
                sub="Per completed job"
                accent="blue"
              />
              <MetricCard
                icon={<Users className="h-5 w-5" />}
                label="Revenue / Lead"
                value={kpis.revenuePerLead > 0 ? `$${kpis.revenuePerLead}` : "—"}
                sub="Your ad-spend ceiling"
                accent="purple"
              />
            </div>

            {/* 3 & 4 ── Funnel + Hot Zones ──────────────────────────── */}
            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <FunnelSection funnel={funnel} />
              <HotZonesSection zones={hotZones} />
            </div>

            {/* 5 ── Product Mix ─────────────────────────────────────── */}
            <ProductMixSection mix={productMix} />

            {/* ── Below-fold: legacy real-data sections ─────────────── */}

            {/* Daily Trend */}
            {data && data.viewsByDay.length > 0 && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <SectionHeader icon={<Calendar className="h-4 w-4 text-blue-400" />} title="Daily Trend">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[10px] text-blue-400">
                      <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                      Views
                    </span>
                    {data.ordersByDay.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                        Orders
                      </span>
                    )}
                  </div>
                </SectionHeader>
                <DualBarChart viewsByDay={data.viewsByDay} ordersByDay={data.ordersByDay} />
              </section>
            )}

            {/* Traffic Sources + Devices */}
            {data && (data.groupedReferrers.length > 0 || data.deviceBreakdown.length > 0) && (
              <div className="grid gap-4 md:grid-cols-2">
                {data.groupedReferrers.length > 0 && (
                  <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                    <SectionHeader icon={<Globe className="h-4 w-4 text-amber-400" />} title="Traffic Sources" />
                    <div className="grid grid-cols-2 gap-2">
                      {data.groupedReferrers.map((group: GroupedReferrer) => (
                        <TrafficSourceTile key={group.group} group={group} totalViews={Number(data.totalViews)} />
                      ))}
                    </div>
                  </section>
                )}
                {data.deviceBreakdown.length > 0 && (
                  <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                    <SectionHeader icon={<Monitor className="h-4 w-4 text-cyan-400" />} title="Devices" />
                    <div className="space-y-2">
                      {data.deviceBreakdown.map((d) => {
                        const DeviceIcon =
                          d.device === "Mobile" ? Smartphone : d.device === "Tablet" ? Tablet : Monitor;
                        const pct = data.totalViews > 0 ? Math.round((d.count / data.totalViews) * 100) : 0;
                        return (
                          <div key={d.device} className="flex items-center gap-3">
                            <DeviceIcon className="h-4 w-4 shrink-0 text-cyan-400" />
                            <span className="w-16 text-xs font-medium text-slate-400">{d.device}</span>
                            <div className="h-4 flex-1 overflow-hidden rounded bg-slate-800">
                              <div
                                className="h-full rounded bg-cyan-500/60 transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-12 text-right text-xs font-bold text-white">{pct}%</span>
                            <span className="w-10 text-right text-[10px] text-slate-500">{d.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* Recent Activity */}
            {data && data.recentViews.length > 0 && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <SectionHeader icon={<Activity className="h-4 w-4 text-purple-400" />} title="Recent Visits">
                  <span className="text-[10px] text-slate-600">Last 20</span>
                </SectionHeader>
                <div className="mb-2 hidden items-center gap-3 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-600 md:flex">
                  <span className="w-24">Page</span>
                  <span className="flex-1">Source</span>
                  <span className="w-16 text-center">Device</span>
                  <span className="w-20 text-right">When</span>
                </div>
                <div className="space-y-1">
                  {data.recentViews.map((v, i) => {
                    const VisitIcon =
                      v.device === "Mobile" ? Smartphone : v.device === "Tablet" ? Tablet : Monitor;
                    return (
                      <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-800/30 px-3 py-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                          <Eye className="h-3 w-3 text-blue-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-white">
                              {v.page === "/design"
                                ? "Design Page"
                                : v.page === "/book"
                                ? "Booking Page"
                                : v.page === "/"
                                ? "Portfolio"
                                : v.page}
                            </span>
                            <span className="hidden text-[10px] text-slate-500 md:inline">
                              via {v.referrer ? cleanReferrerDisplay(v.referrer) : "Direct"}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 md:hidden">
                            {v.referrer ? cleanReferrerDisplay(v.referrer) : "Direct"} · {v.device}
                          </p>
                        </div>
                        <VisitIcon className="hidden h-3.5 w-3.5 shrink-0 text-slate-600 md:block" />
                        <span className="shrink-0 text-[10px] text-slate-600">{timeAgo(v.created_at)}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* QR Scans */}
            {qrData && qrData.totalScans > 0 && (
              <section className="rounded-2xl border border-purple-500/20 bg-slate-900 p-5">
                <SectionHeader icon={<QrCode className="h-4 w-4 text-purple-400" />} title="QR Code Scans">
                  <span className="rounded-full bg-purple-500/15 px-2.5 py-0.5 text-[10px] font-black text-purple-400">
                    {qrData.totalScans} total
                  </span>
                </SectionHeader>
                <div className="grid grid-cols-2 gap-3">
                  {qrData.topLocations.length > 0 && (
                    <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-3">
                      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Top Locations
                      </h3>
                      <div className="space-y-1.5">
                        {qrData.topLocations.slice(0, 5).map((loc) => (
                          <div key={loc.location} className="flex items-center gap-1.5">
                            <MapPin className="h-2.5 w-2.5 shrink-0 text-slate-600" />
                            <span className="flex-1 truncate text-[11px] text-slate-400">{loc.location}</span>
                            <span className="text-[10px] font-bold text-white">{loc.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {qrData.deviceBreakdown.length > 0 && (
                    <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-3">
                      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Devices</h3>
                      <div className="space-y-1.5">
                        {qrData.deviceBreakdown.map((d) => {
                          const pct = qrData.totalScans > 0 ? Math.round((d.count / qrData.totalScans) * 100) : 0;
                          return (
                            <div key={d.device} className="flex items-center justify-between">
                              <span className="text-[11px] capitalize text-slate-400">{d.device}</span>
                              <span className="text-[10px] font-bold text-white">{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Empty state */}
            {data && data.totalViews === 0 && data.totalOrders === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center">
                <BarChart3 className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                <h3 className="mb-2 text-sm font-bold text-white">No traffic yet</h3>
                <p className="text-xs text-slate-500">
                  Share your installer link to start tracking visits and conversions.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared layout helper
// ═══════════════════════════════════════════════════════════════════════════

function SectionHeader({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {icon}
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h2>
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Money Moves Banner
// ═══════════════════════════════════════════════════════════════════════════

function MoneyMovesBanner({
  insights,
  active,
  onNext,
}: {
  insights: InsightItem[];
  active: number;
  onNext: () => void;
}) {
  const item = insights[active];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#F5D033]/20 bg-slate-900">
      {/* Left accent bar */}
      <div className="absolute inset-y-0 left-0 w-1 rounded-l-2xl bg-[#F5D033]" />
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#F5D033]/6 blur-3xl" />

      <div className="flex items-start gap-4 px-5 py-5 pl-6">
        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F5D033]/10 ring-1 ring-[#F5D033]/20">
          {item.icon}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 pr-6">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#F5D033]">
              Money Move
            </span>
            <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
              {active + 1}/{insights.length}
            </span>
          </div>
          <p className="mb-1 text-sm font-bold text-white">{item.headline}</p>
          <p className="mb-3 text-xs leading-relaxed text-slate-400">{item.body}</p>
          <div className="flex items-center gap-3">
            {item.cta && (
              <a
                href={item.cta.href}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5D033] px-3 py-1.5 text-[11px] font-bold text-slate-900 transition-all hover:bg-yellow-300 hover:shadow-lg hover:shadow-[#F5D033]/20"
              >
                {item.cta.label}
                <ArrowRight className="h-3 w-3" />
              </a>
            )}
            {insights.length > 1 && (
              <button
                onClick={onNext}
                className="text-[11px] font-semibold text-slate-500 transition-colors hover:text-slate-300"
              >
                Next insight →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dot progress indicator */}
      <div className="absolute bottom-3.5 right-4 flex items-center gap-1">
        {insights.map((_, i) => (
          <button
            key={i}
            onClick={() =>
              i !== active &&
              Array.from({ length: Math.abs(i - active) }).forEach(() => onNext())
            }
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active ? "w-4 bg-[#F5D033]" : "w-1.5 bg-slate-700 hover:bg-slate-500"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Metric Cards
// ═══════════════════════════════════════════════════════════════════════════

const CARD_ACCENTS = {
  yellow:  { text: "text-[#F5D033]",  bg: "bg-[#F5D033]/10",  glow: "hover:border-[#F5D033]/30  hover:shadow-[#F5D033]/5"  },
  emerald: { text: "text-emerald-400", bg: "bg-emerald-400/10", glow: "hover:border-emerald-400/30 hover:shadow-emerald-400/5" },
  blue:    { text: "text-blue-400",    bg: "bg-blue-400/10",    glow: "hover:border-blue-400/30    hover:shadow-blue-400/5"    },
  purple:  { text: "text-purple-400",  bg: "bg-purple-400/10",  glow: "hover:border-purple-400/30  hover:shadow-purple-400/5"  },
} as const;

function MetricCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  accent: keyof typeof CARD_ACCENTS;
}) {
  const { text, bg, glow } = CARD_ACCENTS[accent];
  return (
    <div
      className={`rounded-2xl border border-slate-800 bg-slate-900 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${glow}`}
    >
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>
        <div className={text}>{icon}</div>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="my-1 text-2xl font-black leading-none text-white">{value}</p>
      <p className="text-[10px] leading-tight text-slate-600">{sub}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Lost Revenue Funnel
// ═══════════════════════════════════════════════════════════════════════════

const FUNNEL_COLORS = ["#F5D033", "#E5C02E", "#C9A829", "#22C55E"];

function FunnelSection({ funnel }: { funnel: FunnelStage[] }) {
  const maxCount = funnel[0]?.count ?? 1;

  // Find the stage with the biggest drop-off
  let worstIdx  = 1;
  let worstDrop = 0;
  for (let i = 1; i < funnel.length; i++) {
    const prev = funnel[i - 1].count;
    const drop = prev > 0 ? ((prev - funnel[i].count) / prev) * 100 : 0;
    if (drop > worstDrop) { worstDrop = drop; worstIdx = i; }
  }

  return (
    <section className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <SectionHeader
        icon={<Filter className="h-4 w-4 text-red-400" />}
        title="Lost Revenue Funnel"
      />

      <div className="flex-1 space-y-1">
        {funnel.map((stage, i) => {
          const widthPct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
          const prev     = funnel[i - 1]?.count ?? 0;
          const dropPct  = i > 0 && prev > 0 ? Math.round(((prev - stage.count) / prev) * 100) : null;
          const StageIcon = stage.icon;

          return (
            <div key={stage.stage}>
              {/* Drop-off connector */}
              {dropPct !== null && (
                <div className="my-1.5 flex items-center gap-2">
                  <div className="h-px flex-1 border-t border-dashed border-slate-800" />
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      dropPct > 60
                        ? "bg-red-500/10 text-red-400"
                        : dropPct > 30
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    −{dropPct}%
                  </span>
                  <div className="h-px flex-1 border-t border-dashed border-slate-800" />
                </div>
              )}

              {/* Stage row */}
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800">
                  <StageIcon className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">{stage.stage}</span>
                    <span className="text-xs font-black text-white tabular-nums">
                      {stage.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${widthPct}%`, backgroundColor: FUNNEL_COLORS[i] }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Insight callout */}
      <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
        <div className="flex items-start gap-2">
          <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          <p className="text-[11px] leading-relaxed text-slate-400">
            <span className="font-bold text-amber-400">Biggest drop-off</span> is at the &ldquo;
            {funnel[worstIdx]?.stage}&rdquo; stage ({Math.round(worstDrop)}% of leads lost).
            Consider offering a BNPL / Klarna option on your next quote to reduce friction.
          </p>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Hot Zones Table
// ═══════════════════════════════════════════════════════════════════════════

function HotZonesSection({ zones }: { zones: HotZone[] }) {
  return (
    <section className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <SectionHeader icon={<MapPin className="h-4 w-4 text-[#F5D033]" />} title="Hot Zones" />

      {/* Table */}
      <div className="mb-4 flex-1">
        {/* Header */}
        <div className="mb-2 grid grid-cols-[2fr_1fr_1.5fr] gap-2 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
          <span>ZIP</span>
          <span className="text-center">Jobs Won</span>
          <span className="text-right">Avg Job $</span>
        </div>

        {/* Rows */}
        <div className="space-y-1.5">
          {zones.map((zone, i) => (
            <div
              key={zone.zip}
              className={`grid grid-cols-[2fr_1fr_1.5fr] items-center gap-2 rounded-xl px-3 py-3 ${
                i === 0
                  ? "border border-[#F5D033]/15 bg-[#F5D033]/5"
                  : "bg-slate-800/40"
              }`}
            >
              {/* Rank + ZIP */}
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                    i === 0
                      ? "bg-[#F5D033] text-slate-900"
                      : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {i + 1}
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{zone.zip}</p>
                  {i === 0 && (
                    <p className="text-[9px] text-[#F5D033]">Top area</p>
                  )}
                </div>
              </div>

              {/* Jobs */}
              <div className="text-center">
                <span className="text-sm font-black text-white">{zone.jobsWon}</span>
              </div>

              {/* Avg job + trend */}
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-sm font-black text-white">
                  ${zone.avgJobSize.toLocaleString()}
                </span>
                {zone.trend === "up" && (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                )}
                {zone.trend === "down" && (
                  <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                )}
                {zone.trend === "flat" && (
                  <div className="h-0.5 w-3 rounded-full bg-slate-600" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insight callout */}
      <div className="rounded-xl border border-[#F5D033]/15 bg-[#F5D033]/5 p-3">
        <div className="flex items-start gap-2">
          <Award className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F5D033]" />
          <p className="text-[11px] leading-relaxed text-slate-400">
            <span className="font-bold text-[#F5D033]">Focus your Facebook ads</span> and yard
            signs on ZIP {zones[0]?.zip}. It&apos;s your most profitable neighborhood right now.
          </p>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Product Mix
// ═══════════════════════════════════════════════════════════════════════════

function ProductMixSection({ mix }: { mix: ProductMixItem[] }) {
  const totalRevenue = mix.reduce((s, m) => s + m.revenue, 0);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <SectionHeader icon={<Package className="h-4 w-4 text-emerald-400" />} title="Product Mix">
        <span className="text-[10px] text-slate-500">Revenue breakdown by type</span>
      </SectionHeader>

      {/* Stacked bar */}
      <div className="mb-4 flex h-8 overflow-hidden rounded-xl">
        {mix.map((item, i) => (
          <div
            key={item.label}
            className={`relative flex items-center justify-center transition-all duration-700 ${
              i === 0 ? "rounded-l-xl" : ""
            } ${i === mix.length - 1 ? "rounded-r-xl" : ""}`}
            style={{ width: `${item.pct}%`, backgroundColor: item.color }}
            title={`${item.label}: ${item.pct}%`}
          >
            {item.pct >= 15 && (
              <span
                className="text-[10px] font-bold"
                style={{ color: item.color === "#F5D033" ? "#1C1917" : "#FFFFFF" }}
              >
                {item.pct}%
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2">
        {mix.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-xs font-semibold text-slate-300">{item.label}</span>
            <span className="text-[10px] text-slate-500">
              ${item.revenue.toLocaleString()} · {item.pct}%
            </span>
          </div>
        ))}
      </div>

      {/* Per-product bars */}
      <div className="space-y-3">
        {mix.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className="w-24 text-xs font-medium text-slate-400">{item.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${item.pct}%`, backgroundColor: item.color }}
              />
            </div>
            <span className="w-20 text-right text-xs font-bold text-white">
              ${item.revenue.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {/* Upsell callout */}
      <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
        <div className="flex items-start gap-2">
          <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <p className="text-[11px] leading-relaxed text-slate-400">
            <span className="font-bold text-emerald-400">Upsell opportunity:</span> {mix[0]?.pct}%
            of your revenue comes from tote packages. Every Frame Only sale that gets upgraded
            adds ${Math.round((mix[0]?.revenue ?? 0) / (mix[1]?.revenue ?? 1) * 100)} in average
            ticket. Ask about totes on every quote.
          </p>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Legacy chart: Dual Bar (views + orders over 14 days)
// ═══════════════════════════════════════════════════════════════════════════

function DualBarChart({
  viewsByDay,
  ordersByDay,
}: {
  viewsByDay: { date: string; views: number }[];
  ordersByDay: { date: string; orders: number }[];
}) {
  const last14  = viewsByDay.slice(-14);
  const orderMap: Record<string, number> = {};
  for (const o of ordersByDay) orderMap[o.date] = o.orders;
  const maxViews = Math.max(...last14.map((d) => d.views), 1);

  return (
    <div className="flex items-end gap-1" style={{ height: 100 }}>
      {last14.map((d) => {
        const viewH  = (d.views / maxViews) * 100;
        const orders = orderMap[d.date] || 0;
        const fmtDate = new Date(d.date + "T12:00:00");
        const label   = fmtDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return (
          <div
            key={d.date}
            className="flex flex-1 flex-col items-center gap-0.5"
            title={`${label}: ${d.views} views, ${orders} orders`}
          >
            <div className="relative flex w-full items-end justify-center" style={{ height: 80 }}>
              <div
                className="w-full rounded-t bg-blue-500/40 transition-all duration-500"
                style={{ height: `${viewH}%` }}
              >
                {orders > 0 && (
                  <div
                    className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-emerald-400 ring-2 ring-slate-900"
                    title={`${orders} order${orders > 1 ? "s" : ""}`}
                  />
                )}
              </div>
            </div>
            <span className="hidden text-[8px] leading-none text-slate-600 sm:block">
              {fmtDate.toLocaleDateString("en-US", { day: "numeric" })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Legacy: Traffic Source Tile
// ═══════════════════════════════════════════════════════════════════════════

const SOURCE_COLORS: Record<string, string> = {
  Facebook:    "bg-blue-500/15 text-blue-400 border-blue-500/20",
  Instagram:   "bg-pink-500/15 text-pink-400 border-pink-500/20",
  Google:      "bg-red-500/15 text-red-400 border-red-500/20",
  YouTube:     "bg-red-500/15 text-red-400 border-red-500/20",
  TikTok:      "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  "X / Twitter": "bg-sky-500/15 text-sky-400 border-sky-500/20",
  LinkedIn:    "bg-blue-600/15 text-blue-300 border-blue-600/20",
  Nextdoor:    "bg-green-500/15 text-green-400 border-green-500/20",
  Pinterest:   "bg-red-400/15 text-red-300 border-red-400/20",
  Reddit:      "bg-orange-500/15 text-orange-400 border-orange-500/20",
  Direct:      "bg-amber-500/15 text-amber-400 border-amber-500/20",
  Bing:        "bg-teal-500/15 text-teal-400 border-teal-500/20",
  Yahoo:       "bg-purple-500/15 text-purple-400 border-purple-500/20",
  Craigslist:  "bg-violet-500/15 text-violet-400 border-violet-500/20",
};
const DEFAULT_COLOR = "bg-slate-700/30 text-slate-300 border-slate-600/30";

function TrafficSourceTile({
  group,
  totalViews,
}: {
  group: GroupedReferrer;
  totalViews: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const colorClass  = SOURCE_COLORS[group.group] || DEFAULT_COLOR;
  const pct         = totalViews > 0 ? Math.round((group.totalCount / totalViews) * 100) : 0;
  const hasDetails  = group.details.length > 1 || (group.details.length === 1 && group.group !== group.details[0].url);

  return (
    <div
      className={`rounded-xl border p-3 transition-all ${colorClass} ${
        hasDetails ? "cursor-pointer hover:brightness-110" : ""
      } ${expanded ? "col-span-2" : ""}`}
      onClick={() => hasDetails && setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{group.group}</p>
          <p className="text-[10px] opacity-70">
            {group.totalCount} · {pct}%
          </p>
        </div>
        {hasDetails && (
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 opacity-50 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
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

// ═══════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════

function cleanReferrerDisplay(referrer: string | null): string {
  if (!referrer) return "Direct";
  try {
    return new URL(referrer).hostname.replace("www.", "");
  } catch {
    return referrer.slice(0, 30);
  }
}

function timeAgo(dateStr: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMin < 1)  return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  return `${diffDay}d ago`;
}
