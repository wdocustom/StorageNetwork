"use server";

import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════
// Analytics — Server actions for installer page view tracking & metrics
//
// Tracks page visits to installer links and conversion to orders.
// Uses `page_views` table for visit tracking, `leads` table for conversions.
// ═══════════════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Track Page View ─────────────────────────────────────────────────────

export interface PageViewInput {
  installerId: string;
  page: string;           // e.g., "/design", "/book"
  referrer?: string;
  userAgent?: string;
  screenWidth?: number;
}

export async function trackPageView(input: PageViewInput): Promise<{ success: boolean }> {
  if (!input.installerId) return { success: false };

  try {
    await supabase.from("page_views").insert({
      installer_id: input.installerId,
      page: input.page,
      referrer: input.referrer || null,
      user_agent: input.userAgent || null,
      screen_width: input.screenWidth || null,
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}

// ── Installer Analytics Dashboard Data ──────────────────────────────────

export interface ReferrerDetail {
  url: string;       // full referrer URL or path
  count: number;
}

export interface TrafficSourceGroup {
  source: string;           // display name: "Facebook", "Direct", "Google", etc.
  totalCount: number;
  referrers: ReferrerDetail[];
}

export interface AnalyticsSummary {
  totalViews: number;
  totalOrders: number;
  conversionRate: number;         // percentage
  totalRevenue: number;
  avgOrderValue: number;
  viewsByDay: { date: string; views: number }[];
  ordersByDay: { date: string; orders: number; revenue: number }[];
  topReferrers: { referrer: string; count: number }[];
  trafficSourceGroups: TrafficSourceGroup[];
  deviceBreakdown: { device: string; count: number }[];
  recentViews: { page: string; referrer: string | null; created_at: string; device: string }[];
}

function classifyDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown";
  const ua = userAgent.toLowerCase();
  if (ua.includes("mobile") || ua.includes("iphone") || ua.includes("android")) return "Mobile";
  if (ua.includes("tablet") || ua.includes("ipad")) return "Tablet";
  return "Desktop";
}

function cleanReferrer(referrer: string | null): string {
  if (!referrer || referrer === "") return "Direct";
  try {
    const url = new URL(referrer);
    return url.hostname.replace("www.", "");
  } catch {
    return referrer.slice(0, 50);
  }
}

function classifyTrafficSource(referrer: string | null): string {
  if (!referrer || referrer.trim() === "") return "Direct";
  const lower = referrer.toLowerCase();
  if (lower.includes("facebook.com") || lower.includes("fb.com") || lower.includes("fbclid") || lower.includes("l.facebook") || lower.includes("m.facebook") || lower.includes("lm.facebook")) return "Facebook";
  if (lower.includes("instagram.com") || lower.includes("l.instagram")) return "Instagram";
  if (lower.includes("google.com") || lower.includes("google.co") || lower.includes("gclid")) return "Google";
  if (lower.includes("tiktok.com")) return "TikTok";
  if (lower.includes("nextdoor.com")) return "Nextdoor";
  if (lower.includes("craigslist.org")) return "Craigslist";
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "YouTube";
  if (lower.includes("twitter.com") || lower.includes("x.com") || lower.includes("t.co")) return "X / Twitter";
  if (lower.includes("pinterest.com")) return "Pinterest";
  if (lower.includes("reddit.com")) return "Reddit";
  if (lower.includes("bing.com")) return "Bing";
  if (lower.includes("yahoo.com")) return "Yahoo";
  // Fall back to cleaned hostname
  try {
    const url = new URL(referrer);
    return url.hostname.replace("www.", "");
  } catch {
    return "Other";
  }
}

export async function getInstallerAnalytics(
  installerId: string,
  days: number = 30
): Promise<{ success: boolean; data?: AnalyticsSummary; error?: string }> {
  if (!installerId) {
    return { success: false, error: "No installer ID provided." };
  }

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  const since = sinceDate.toISOString();

  try {
    // Fetch page views and orders in parallel
    const [viewsRes, ordersRes, recentViewsRes] = await Promise.all([
      // All page views in date range
      supabase
        .from("page_views")
        .select("page, referrer, user_agent, created_at")
        .eq("installer_id", installerId)
        .gte("created_at", since)
        .order("created_at", { ascending: true }),

      // All paid orders (deposit_paid = true) in date range
      supabase
        .from("leads")
        .select("estimated_price, created_at, deposit_paid")
        .eq("installer_id", installerId)
        .eq("deposit_paid", true)
        .gte("created_at", since)
        .order("created_at", { ascending: true }),

      // Recent views for the activity feed (last 20)
      supabase
        .from("page_views")
        .select("page, referrer, user_agent, created_at")
        .eq("installer_id", installerId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const views = viewsRes.data || [];
    const orders = ordersRes.data || [];
    const recentRaw = recentViewsRes.data || [];

    // ── Totals ────────────────────────────────────────────────
    const totalViews = views.length;
    const totalOrders = orders.length;
    const conversionRate = totalViews > 0 ? (totalOrders / totalViews) * 100 : 0;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.estimated_price || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // ── Views by Day ──────────────────────────────────────────
    const viewDayMap: Record<string, number> = {};
    for (const v of views) {
      const day = v.created_at?.slice(0, 10) || "unknown";
      viewDayMap[day] = (viewDayMap[day] || 0) + 1;
    }
    const viewsByDay = Object.entries(viewDayMap).map(([date, count]) => ({
      date,
      views: count,
    }));

    // ── Orders by Day ─────────────────────────────────────────
    const orderDayMap: Record<string, { orders: number; revenue: number }> = {};
    for (const o of orders) {
      const day = o.created_at?.slice(0, 10) || "unknown";
      if (!orderDayMap[day]) orderDayMap[day] = { orders: 0, revenue: 0 };
      orderDayMap[day].orders += 1;
      orderDayMap[day].revenue += o.estimated_price || 0;
    }
    const ordersByDay = Object.entries(orderDayMap).map(([date, data]) => ({
      date,
      ...data,
    }));

    // ── Top Referrers ─────────────────────────────────────────
    const refMap: Record<string, number> = {};
    for (const v of views) {
      const ref = cleanReferrer(v.referrer);
      refMap[ref] = (refMap[ref] || 0) + 1;
    }
    const topReferrers = Object.entries(refMap)
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // ── Traffic Source Groups (grouped by platform) ─────────
    const groupMap: Record<string, Record<string, number>> = {};
    for (const v of views) {
      const groupName = classifyTrafficSource(v.referrer);
      const detailUrl = v.referrer?.trim() || "Direct visit";
      if (!groupMap[groupName]) groupMap[groupName] = {};
      groupMap[groupName][detailUrl] = (groupMap[groupName][detailUrl] || 0) + 1;
    }
    const trafficSourceGroups: TrafficSourceGroup[] = Object.entries(groupMap)
      .map(([source, details]) => ({
        source,
        totalCount: Object.values(details).reduce((s, c) => s + c, 0),
        referrers: Object.entries(details)
          .map(([url, count]) => ({ url, count }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.totalCount - a.totalCount);

    // ── Device Breakdown ──────────────────────────────────────
    const deviceMap: Record<string, number> = {};
    for (const v of views) {
      const device = classifyDevice(v.user_agent);
      deviceMap[device] = (deviceMap[device] || 0) + 1;
    }
    const deviceBreakdown = Object.entries(deviceMap)
      .map(([device, count]) => ({ device, count }))
      .sort((a, b) => b.count - a.count);

    // ── Recent Views ──────────────────────────────────────────
    const recentViews = recentRaw.map((v) => ({
      page: v.page || "/design",
      referrer: v.referrer,
      created_at: v.created_at || "",
      device: classifyDevice(v.user_agent),
    }));

    return {
      success: true,
      data: {
        totalViews,
        totalOrders,
        conversionRate: Math.round(conversionRate * 10) / 10,
        totalRevenue: Math.round(totalRevenue),
        avgOrderValue: Math.round(avgOrderValue),
        viewsByDay,
        ordersByDay,
        topReferrers,
        trafficSourceGroups,
        deviceBreakdown,
        recentViews,
      },
    };
  } catch {
    return { success: false, error: "Failed to load analytics." };
  }
}

// ── First-Order Discount Check ──────────────────────────────────────────

// Feature flag — set to true to enable the $25 first-order discount
const FIRST_ORDER_DISCOUNT_ENABLED = false;

export interface DiscountCheckResult {
  isFirstOrder: boolean;
  discountAmount: number;   // $25 for first order, $0 otherwise
}

/**
 * Check if a customer email has any prior PAID orders on the platform.
 * Returns $25 discount if this is their first order.
 * Currently DISABLED — returns $0 discount regardless.
 */
export async function checkFirstOrderDiscount(
  customerEmail: string
): Promise<DiscountCheckResult> {
  // Short-circuit when feature is disabled
  if (!FIRST_ORDER_DISCOUNT_ENABLED) {
    return { isFirstOrder: false, discountAmount: 0 };
  }

  const FIRST_ORDER_DISCOUNT = 25;

  if (!customerEmail?.trim()) {
    return { isFirstOrder: false, discountAmount: 0 };
  }

  try {
    const { count, error } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("customer_email", customerEmail.trim().toLowerCase())
      .eq("deposit_paid", true);

    if (error) {
      return { isFirstOrder: false, discountAmount: 0 };
    }

    const isFirstOrder = (count ?? 0) === 0;
    return {
      isFirstOrder,
      discountAmount: isFirstOrder ? FIRST_ORDER_DISCOUNT : 0,
    };
  } catch {
    return { isFirstOrder: false, discountAmount: 0 };
  }
}
