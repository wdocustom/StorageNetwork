"use server";

import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Platform Analytics — Admin-Only Server Actions
//
// Aggregates data from `platform_page_views` for the admin analytics
// dashboard. Filters out bots by default, provides device/geo/referrer
// breakdowns, live activity feed, and hourly traffic patterns.
// ═══════════════════════════════════════════════════════════════════════════

const supabase = getServiceClient();

// ── Types ────────────────────────────────────────────────────────────────

export interface PlatformAnalyticsData {
  kpis: {
    totalViews: number;
    uniqueVisitors: number;
    uniqueSessions: number;
    activeNow: number;         // views in last 5 minutes
    botViews: number;
    avgPagesPerSession: number;
  };
  viewsByDay: { date: string; views: number; unique: number }[];
  viewsByHour: { hour: number; views: number }[];
  topPages: { page: string; views: number; unique: number }[];
  deviceBreakdown: { device: string; count: number; pct: number }[];
  topCities: { city: string; region: string | null; country: string | null; count: number }[];
  topCountries: { country: string; count: number }[];
  trafficSources: { source: string; count: number }[];
  liveActivity: {
    page: string;
    city: string | null;
    region: string | null;
    country: string | null;
    device: string;
    referrer: string | null;
    is_bot: boolean;
    created_at: string;
  }[];
}

// ── Referrer source mapping (reuse from existing analytics) ─────────────

const SOURCE_MAP: Record<string, string> = {
  "facebook.com": "Facebook", "m.facebook.com": "Facebook", "l.facebook.com": "Facebook",
  "lm.facebook.com": "Facebook", "fb.com": "Facebook", "fb.me": "Facebook",
  "instagram.com": "Instagram", "l.instagram.com": "Instagram",
  "google.com": "Google", "google.co.uk": "Google", "google.ca": "Google",
  "youtube.com": "YouTube", "m.youtube.com": "YouTube", "youtu.be": "YouTube",
  "tiktok.com": "TikTok", "vm.tiktok.com": "TikTok",
  "twitter.com": "X / Twitter", "x.com": "X / Twitter", "t.co": "X / Twitter",
  "linkedin.com": "LinkedIn", "lnkd.in": "LinkedIn",
  "nextdoor.com": "Nextdoor", "craigslist.org": "Craigslist",
  "pinterest.com": "Pinterest", "reddit.com": "Reddit", "old.reddit.com": "Reddit",
  "bing.com": "Bing", "yahoo.com": "Yahoo", "duckduckgo.com": "DuckDuckGo",
};

function classifyReferrer(referrer: string | null): string {
  if (!referrer) return "Direct";
  try {
    const url = new URL(referrer);
    const hostname = url.hostname.replace("www.", "").toLowerCase();
    if (SOURCE_MAP[hostname]) return SOURCE_MAP[hostname];
    if (url.searchParams.has("fbclid")) return "Facebook";
    if (url.searchParams.has("gclid")) return "Google Ads";
    if (hostname.endsWith("craigslist.org")) return "Craigslist";
    // Return cleaned hostname for unknown sources
    return hostname;
  } catch {
    return referrer.slice(0, 30);
  }
}

// ── Main Analytics Query ─────────────────────────────────────────────────

export async function getAdminPlatformAnalytics(
  userId: string,
  days: number = 30
): Promise<{ success: boolean; data?: PlatformAnalyticsData; error?: string }> {
  try {
    // Verify admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: "Not authorized." };
    }

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const since = sinceDate.toISOString();

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Fetch all views in range + active-now count in parallel
    const [allViewsRes, activeNowRes, liveRes] = await Promise.all([
      supabase
        .from("platform_page_views")
        .select("page_path, visitor_id, session_id, device_type, city, region, country, referrer, is_bot, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(50000),

      supabase
        .from("platform_page_views")
        .select("id", { count: "exact", head: true })
        .gte("created_at", fiveMinAgo)
        .eq("is_bot", false),

      // Last 50 views for live activity feed (including bots for visibility)
      supabase
        .from("platform_page_views")
        .select("page_path, city, region, country, device_type, referrer, is_bot, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const allViews = allViewsRes.data || [];
    const activeNow = activeNowRes.count || 0;
    const liveRaw = liveRes.data || [];

    // Split human vs bot views
    const humanViews = allViews.filter((v) => !v.is_bot);
    const botViews = allViews.filter((v) => v.is_bot);

    // ── KPIs (human only) ──────────────────────────────────────────
    const totalViews = humanViews.length;
    const uniqueVisitors = new Set(humanViews.map((v) => v.visitor_id).filter(Boolean)).size;
    const uniqueSessions = new Set(humanViews.map((v) => v.session_id).filter(Boolean)).size;
    const avgPagesPerSession = uniqueSessions > 0
      ? Math.round((totalViews / uniqueSessions) * 10) / 10
      : 0;

    // ── Views by Day ────────────────────────────────────────────────
    const dayMap: Record<string, { views: number; visitors: Set<string> }> = {};
    for (const v of humanViews) {
      const day = v.created_at?.slice(0, 10) || "unknown";
      if (!dayMap[day]) dayMap[day] = { views: 0, visitors: new Set() };
      dayMap[day].views++;
      if (v.visitor_id) dayMap[day].visitors.add(v.visitor_id);
    }
    const viewsByDay = Object.entries(dayMap)
      .map(([date, d]) => ({ date, views: d.views, unique: d.visitors.size }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── Views by Hour (pattern analysis) ────────────────────────────
    const hourMap: Record<number, number> = {};
    for (const v of humanViews) {
      const hour = new Date(v.created_at).getHours();
      hourMap[hour] = (hourMap[hour] || 0) + 1;
    }
    const viewsByHour = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      views: hourMap[i] || 0,
    }));

    // ── Top Pages ───────────────────────────────────────────────────
    const pageMap: Record<string, { views: number; visitors: Set<string> }> = {};
    for (const v of humanViews) {
      const page = v.page_path || "/";
      if (!pageMap[page]) pageMap[page] = { views: 0, visitors: new Set() };
      pageMap[page].views++;
      if (v.visitor_id) pageMap[page].visitors.add(v.visitor_id);
    }
    const topPages = Object.entries(pageMap)
      .map(([page, d]) => ({ page, views: d.views, unique: d.visitors.size }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 20);

    // ── Device Breakdown ────────────────────────────────────────────
    const deviceMap: Record<string, number> = {};
    for (const v of humanViews) {
      const device = v.device_type || "desktop";
      deviceMap[device] = (deviceMap[device] || 0) + 1;
    }
    const deviceBreakdown = Object.entries(deviceMap)
      .map(([device, count]) => ({
        device,
        count,
        pct: totalViews > 0 ? Math.round((count / totalViews) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // ── Top Cities ──────────────────────────────────────────────────
    const cityMap: Record<string, { count: number; region: string | null; country: string | null }> = {};
    for (const v of humanViews) {
      if (!v.city) continue;
      const key = `${v.city}|${v.region || ""}|${v.country || ""}`;
      if (!cityMap[key]) cityMap[key] = { count: 0, region: v.region, country: v.country };
      cityMap[key].count++;
    }
    const topCities = Object.entries(cityMap)
      .map(([key, d]) => {
        const city = key.split("|")[0];
        return { city, region: d.region, country: d.country, count: d.count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // ── Top Countries ───────────────────────────────────────────────
    const countryMap: Record<string, number> = {};
    for (const v of humanViews) {
      const c = v.country || "Unknown";
      countryMap[c] = (countryMap[c] || 0) + 1;
    }
    const topCountries = Object.entries(countryMap)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // ── Traffic Sources ─────────────────────────────────────────────
    const sourceMap: Record<string, number> = {};
    for (const v of humanViews) {
      const source = classifyReferrer(v.referrer);
      sourceMap[source] = (sourceMap[source] || 0) + 1;
    }
    const trafficSources = Object.entries(sourceMap)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // ── Live Activity ───────────────────────────────────────────────
    const liveActivity = liveRaw.map((v) => ({
      page: v.page_path || "/",
      city: v.city,
      region: v.region,
      country: v.country,
      device: v.device_type || "desktop",
      referrer: v.referrer,
      is_bot: v.is_bot ?? false,
      created_at: v.created_at || "",
    }));

    return {
      success: true,
      data: {
        kpis: {
          totalViews,
          uniqueVisitors,
          uniqueSessions,
          activeNow,
          botViews: botViews.length,
          avgPagesPerSession,
        },
        viewsByDay,
        viewsByHour,
        topPages,
        deviceBreakdown,
        topCities,
        topCountries,
        trafficSources,
        liveActivity,
      },
    };
  } catch (err) {
    console.error("[PlatformAnalytics] Failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load analytics.",
    };
  }
}
