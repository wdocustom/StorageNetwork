"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  getSalesInsights,
  type SalesInsightsData,
  type OrderDetail,
} from "@/app/actions/sales-insights";
import {
  updateOperationalStatus,
  type OperationalStatus,
} from "@/app/actions/jobs";
import {
  ArrowLeft,
  DollarSign,
  Package,
  ShoppingCart,
  Search,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Loader2,
  Star,
  Phone,
  MapPin,
  Ruler,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Sales Insights — CRM / Sales History Dashboard
//
// Installer-scoped view of all completed orders with:
//   - Top tiles: Gross Revenue (with Net Payout), COGS, Total Orders
//   - Actionable customer cards (Call, Navigate, Blueprints)
//   - Operational status pipeline (New → Scheduled → Completed)
//   - Financial summary mini-cards with highlighted Gross Profit
//   - Comprehensive search (customer, address, config type)
//   - Popular unit rankings for bestseller campaigns
// ═══════════════════════════════════════════════════════════════════════════

function fmt(n: number) {
  return "$" + n.toLocaleString();
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso + (iso.includes("T") ? "" : "T12:00:00")).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SalesInsightsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SalesInsightsData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const insights = await getSalesInsights(user.id);
    setData(insights);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Callback for OrderRow to update operational status optimistically
  const handleOpStatusChange = useCallback(
    async (orderId: string, newStatus: OperationalStatus) => {
      if (!data) return;

      // Optimistic update
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          orders: prev.orders.map((o) =>
            o.id === orderId ? { ...o, operationalStatus: newStatus } : o
          ),
        };
      });

      const result = await updateOperationalStatus(orderId, newStatus);
      if (!result.success) {
        // Revert on failure
        fetchData();
      }
    },
    [data, fetchData]
  );

  // ── Search Logic ────────────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    if (!data) return [];
    if (!searchQuery.trim()) return data.orders;

    const q = searchQuery.toLowerCase().trim();

    // Natural language detection for "popular" queries
    if (
      q.includes("popular") ||
      q.includes("bestseller") ||
      q.includes("best seller") ||
      q.includes("most ordered") ||
      q.includes("top unit") ||
      q.includes("top config")
    ) {
      // Return orders sorted by the most popular configuration
      if (data.popularUnits.length > 0) {
        const topConfig = data.popularUnits[0].config;
        return data.orders.filter((o) =>
          o.units.some((u) => {
            const key = `${u.cols}x${u.rows} ${u.toteType}${u.hasTotes ? " +Totes" : ""}${u.hasWheels ? " +Wheels" : ""}${u.hasTop ? " +Top" : ""}`;
            return key === topConfig;
          })
        );
      }
    }

    // Config-based search (e.g., "5x4", "wheels", "totes", "HDX", "GM", "large", "standard")
    const configTerms = ["hdx", "gm", "totes", "wheels", "top", "large", "standard", "mini"];
    const isConfigSearch = configTerms.some((t) => q.includes(t)) || /\d+x\d+/.test(q);

    return data.orders.filter((order) => {
      // Text search across customer fields
      const textMatch =
        order.customerName.toLowerCase().includes(q) ||
        (order.customerEmail?.toLowerCase().includes(q) ?? false) ||
        (order.customerPhone?.includes(q) ?? false) ||
        (order.address?.toLowerCase().includes(q) ?? false) ||
        order.id.toLowerCase().includes(q);

      if (textMatch) return true;

      // Config search
      if (isConfigSearch) {
        return order.units.some((u) => {
          const unitStr = `${u.desc} ${u.toteType} ${u.cols}x${u.rows} ${u.hasTotes ? "totes" : ""} ${u.hasWheels ? "wheels" : ""} ${u.hasTop ? "top" : ""} ${u.cols >= 5 ? "large" : "standard"}`.toLowerCase();
          return unitStr.includes(q);
        });
      }

      return false;
    });
  }, [data, searchQuery]);

  // ── Popular units search result message ──────────────────────────────
  const popularSearchMessage = useMemo(() => {
    if (!data || !searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase().trim();
    if (
      q.includes("popular") ||
      q.includes("bestseller") ||
      q.includes("most ordered") ||
      q.includes("top unit")
    ) {
      if (data.popularUnits.length > 0) {
        const top = data.popularUnits[0];
        return `Your most popular configuration is "${top.config}" — ordered ${top.count} time${top.count > 1 ? "s" : ""} for ${fmt(top.totalRevenue)} total revenue.`;
      }
    }
    return null;
  }, [data, searchQuery]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (!data) return null;

  const grossMargin = data.totalSales > 0 ? Math.round(((data.totalSales - data.totalCOGS) / data.totalSales) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-gray-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            href="/dashboard"
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-black text-white">Sales &amp; Customers</h1>
            <p className="text-[10px] text-stone-500">Order history, analytics &amp; CRM</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {/* ══ Phase 1: KPI Top Tiles — Gross Revenue + Net Payout ══ */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
            <DollarSign className="mx-auto mb-1 h-5 w-5 text-yellow-400" />
            <p className="text-lg font-black text-white sm:text-xl">
              {fmt(data.totalSales)}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              Gross Revenue
            </p>
            <p className="mt-0.5 text-[10px] text-stone-600">
              Net Payout: {fmt(data.netPayout)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
            <ShoppingCart className="mx-auto mb-1 h-5 w-5 text-amber-400" />
            <p className="text-lg font-black text-white sm:text-xl">
              {fmt(data.totalCOGS)}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              Cost of Goods
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
            <Package className="mx-auto mb-1 h-5 w-5 text-emerald-400" />
            <p className="text-lg font-black text-white sm:text-xl">
              {data.totalOrders}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              Total Orders
            </p>
          </div>
        </div>

        {/* ── Gross Margin Bar ──────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              Gross Margin (after materials)
            </span>
            <span className="text-xs font-black text-emerald-400">{grossMargin}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
              style={{ width: `${Math.min(grossMargin, 100)}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-stone-500">
            <span>{data.totalUnitsBuilt} units built</span>
            <span>{data.totalTotesOrdered} totes ordered</span>
          </div>
        </div>

        {/* ── Popular Units ────────────────────────────────────────── */}
        {data.popularUnits.length > 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
              <Star className="h-3.5 w-3.5 text-yellow-400" />
              Top Configurations
            </h2>
            <div className="space-y-2">
              {data.popularUnits.slice(0, 5).map((unit, i) => (
                <div
                  key={unit.config}
                  className="flex items-center gap-3 rounded-lg bg-slate-800/50 px-3 py-2"
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                    i === 0
                      ? "bg-yellow-400/20 text-yellow-400"
                      : i === 1
                      ? "bg-stone-400/20 text-stone-300"
                      : "bg-slate-700 text-stone-500"
                  }`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {unit.config}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-yellow-400">{unit.count}x</p>
                    <p className="text-[10px] text-stone-500">{fmt(unit.totalRevenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Search ───────────────────────────────────────────────── */}
        <div className="sticky top-[53px] z-10 -mx-4 bg-gray-950/95 px-4 py-2 backdrop-blur">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
            <input
              type="text"
              placeholder="Search customers, addresses, configs, or try &quot;popular unit&quot;..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 pl-10 pr-4 text-sm text-white placeholder-stone-500 focus:border-yellow-400 focus:outline-none"
            />
          </div>
          {popularSearchMessage && (
            <div className="mt-2 rounded-lg border border-yellow-400/20 bg-yellow-400/5 px-3 py-2">
              <p className="text-xs font-semibold text-yellow-400">
                {popularSearchMessage}
              </p>
            </div>
          )}
          {searchQuery.trim() && (
            <p className="mt-1.5 text-[10px] text-stone-500">
              {filteredOrders.length} result{filteredOrders.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* ── Order List ───────────────────────────────────────────── */}
        <div className="space-y-2">
          {filteredOrders.length === 0 && (
            <div className="py-12 text-center">
              <Package className="mx-auto mb-2 h-8 w-8 text-stone-600" />
              <p className="text-sm text-stone-500">
                {searchQuery.trim()
                  ? "No orders match your search."
                  : "No completed orders yet."}
              </p>
            </div>
          )}

          {filteredOrders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              expanded={expandedId === order.id}
              onToggle={() =>
                setExpandedId(expandedId === order.id ? null : order.id)
              }
              onOpStatusChange={handleOpStatusChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// OperationalStatusPills — Pipeline state toggle
// ═══════════════════════════════════════════════════════════════════════════

const OP_STATUS_CONFIG: {
  value: OperationalStatus;
  label: string;
}[] = [
  { value: "new", label: "New" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
];

function OperationalStatusPills({
  current,
  onChange,
}: {
  current: string;
  onChange: (status: OperationalStatus) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {OP_STATUS_CONFIG.map((opt) => {
        const isActive = current === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
              isActive
                ? opt.value === "completed"
                  ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
                  : opt.value === "scheduled"
                  ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40"
                  : "bg-yellow-400/20 text-yellow-400 ring-1 ring-yellow-400/40"
                : "bg-slate-800 text-stone-600 hover:bg-slate-700 hover:text-stone-400"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// OrderRow — Expandable order line with full details
// ═══════════════════════════════════════════════════════════════════════════

function OrderRow({
  order,
  expanded,
  onToggle,
  onOpStatusChange,
}: {
  order: OrderDetail;
  expanded: boolean;
  onToggle: () => void;
  onOpStatusChange: (orderId: string, status: OperationalStatus) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      {/* Summary row */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-slate-800/50"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {order.customerName}
          </p>
          <p className="truncate text-[11px] text-stone-500">
            {order.units.length} unit{order.units.length !== 1 ? "s" : ""}
            {order.address ? ` \u2022 ${order.address}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-yellow-400">{fmt(order.totalPrice)}</p>
          <p className="text-[10px] text-stone-500">
            {fmtDate(order.completedAt || order.createdAt)}
          </p>
        </div>
        <div className="shrink-0 text-stone-500">
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-slate-800 bg-slate-800/30 p-3 space-y-3">
          {/* Customer info */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {order.customerEmail && (
              <div>
                <span className="text-stone-500">Email: </span>
                <a
                  href={`mailto:${order.customerEmail}`}
                  className="text-blue-400 hover:underline"
                >
                  {order.customerEmail}
                </a>
              </div>
            )}
            {order.customerPhone && (
              <div>
                <span className="text-stone-500">Phone: </span>
                <a
                  href={`tel:${order.customerPhone}`}
                  className="text-blue-400 hover:underline"
                >
                  {order.customerPhone}
                </a>
              </div>
            )}
            {order.address && (
              <div className="col-span-2">
                <span className="text-stone-500">Address: </span>
                <span className="text-stone-300">{order.address}</span>
              </div>
            )}
          </div>

          {/* ══ Phase 2: Action Buttons — Call, Navigate, Blueprints ══ */}
          <div className="grid grid-cols-3 gap-2">
            <a
              href={order.customerPhone ? `tel:${order.customerPhone}` : undefined}
              className={`flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold transition-all ${
                order.customerPhone
                  ? "text-stone-300 hover:border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-400 active:scale-95"
                  : "pointer-events-none text-stone-700"
              }`}
            >
              <Phone className="h-3.5 w-3.5" />
              Call
            </a>
            <a
              href={order.address ? `https://maps.google.com/?q=${encodeURIComponent(order.address)}` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold transition-all ${
                order.address
                  ? "text-stone-300 hover:border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-400 active:scale-95"
                  : "pointer-events-none text-stone-700"
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              Navigate
            </a>
            <Link
              href={`/dashboard/leads/${order.id}`}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-stone-300 transition-all hover:border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-400 active:scale-95"
            >
              <Ruler className="h-3.5 w-3.5" />
              Blueprints
            </Link>
          </div>

          {/* ══ Phase 3: Status Row — Payment + Operational Pipeline ══ */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Payment:</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                order.status === "paid"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-amber-500/20 text-amber-400"
              }`}>
                {order.status === "paid" ? "Paid" : "Pending"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Job:</span>
              <OperationalStatusPills
                current={order.operationalStatus}
                onChange={(status) => onOpStatusChange(order.id, status)}
              />
            </div>
          </div>

          {/* Unit breakdown */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Units
            </p>
            {order.units.map((u, i) => {
              const addons: string[] = [];
              if (u.hasTotes) addons.push(`${u.toteType} Totes`);
              if (u.hasWheels) addons.push("Wheels");
              if (u.hasTop) addons.push("Top");
              const addonStr = addons.length > 0 ? addons.join(", ") : "Frame Only";

              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-slate-800 px-2.5 py-2"
                >
                  <div>
                    <p className="text-xs font-semibold text-white">{u.desc}</p>
                    <p className="text-[10px] text-stone-500">{addonStr}</p>
                  </div>
                  <span className="text-xs font-bold text-yellow-400">
                    {fmt(u.price)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ══ Phase 4: Financial Summary Mini-Card ══ */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-900 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Financial Summary
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-[10px] text-stone-500">Revenue</p>
                <p className="text-sm font-black text-white">{fmt(order.totalPrice)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-stone-500">Materials</p>
                <p className="text-sm font-black text-amber-400">{fmt(order.materialCost)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-stone-500">Gross Profit</p>
                <p className="text-sm font-black text-emerald-400">{fmt(order.profit)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
