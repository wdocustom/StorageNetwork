"use server";

import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Visitor Intelligence — admin-only deep-visibility into platform traffic
//
//   getVisitorSessions  — Groups recent platform_page_views into sessions,
//                         each with the full per-page journey, IP, geo,
//                         UA, referrer, time-on-site, dwell. Watched
//                         entries float to the top.
//
//   getWatchlist        — Lists pinned IPs / visitor_ids with labels.
//   addWatchlistEntry   — Pin a label to an IP and/or visitor_id.
//   removeWatchlistEntry — Unpin.
//
// Sessions are grouped by session_id when present; otherwise by visitor_id;
// otherwise by ip. This handles the three cases in priority:
//   - Modern browser with sessionStorage (session_id present)
//   - Browser with localStorage but session reset (visitor_id only)
//   - Anonymous / private browsing (ip only)
// ═══════════════════════════════════════════════════════════════════════════

const supabase = getServiceClient();

async function requireAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .single();
  return !!data?.is_admin;
}

// ── Types ────────────────────────────────────────────────────────────────

export interface SessionPageHit {
  page_path: string;
  created_at: string;
  referrer: string | null;
}

export interface VisitorSession {
  session_key: string; // session_id || visitor_id || ip
  session_id: string | null;
  visitor_id: string | null;
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  device_type: string;
  user_agent: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  is_bot: boolean;
  first_seen: string;
  last_seen: string;
  page_count: number;
  duration_seconds: number;
  pages: SessionPageHit[];
  // Suspicion scoring + watchlist match
  watchlist_label: string | null;
  watchlist_note: string | null;
  suspicion_score: number;
  suspicion_reasons: string[];
}

export interface WatchlistEntry {
  id: string;
  label: string;
  ip: string | null;
  visitor_id: string | null;
  note: string | null;
  created_at: string;
  recent_hits: number; // sessions in the last 7d
  last_seen: string | null;
}

// ── Suspicion heuristics ────────────────────────────────────────────────
// Cheap, transparent scoring — not ML. The point is to surface "this
// session looked like reconnaissance" so the admin can spot competitor
// traffic faster, not to make automated decisions.

const RECON_PAGES = ["/pricing", "/features", "/partner", "/about", "/p/"];

function scoreSession(s: {
  pages: SessionPageHit[];
  duration_seconds: number;
  user_agent: string | null;
  referrer: string | null;
}): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const uniquePages = new Set(s.pages.map((p) => p.page_path));
  const reconHits = Array.from(uniquePages).filter((p) =>
    RECON_PAGES.some((r) => p.startsWith(r))
  ).length;

  // Touched 3+ "reconnaissance" pages — pricing/features/partner/installer
  if (reconHits >= 3) {
    score += 40;
    reasons.push(`Visited ${reconHits} pricing/feature/partner pages`);
  } else if (reconHits >= 2) {
    score += 20;
    reasons.push(`Visited ${reconHits} pricing/feature/partner pages`);
  }

  // Visited many distinct installer profile pages (/p/[slug])
  const installerPages = Array.from(uniquePages).filter((p) =>
    p.startsWith("/p/")
  ).length;
  if (installerPages >= 3) {
    score += 25;
    reasons.push(`Browsed ${installerPages} different installer pages`);
  }

  // Long deep-dive session (5+ pages, 3+ minutes)
  if (s.pages.length >= 5 && s.duration_seconds >= 180) {
    score += 15;
    reasons.push(
      `Long session: ${s.pages.length} pages over ${Math.round(s.duration_seconds / 60)}m`
    );
  }

  // No referrer (typed URL or direct nav) but deep journey — typical of
  // someone who already knows the URL (not organic discovery).
  if (!s.referrer && s.pages.length >= 4) {
    score += 10;
    reasons.push("No referrer + deep navigation (knew the URL)");
  }

  // Headless-style UA tells (curl, python, headless chrome, etc.)
  if (s.user_agent) {
    const lower = s.user_agent.toLowerCase();
    if (
      lower.includes("headlesschrome") ||
      lower.includes("phantomjs") ||
      lower.includes("python") ||
      lower.includes("curl") ||
      lower.includes("wget")
    ) {
      score += 30;
      reasons.push("Automated/headless user agent");
    }
  }

  return { score: Math.min(score, 100), reasons };
}

// ── Sessions Query ───────────────────────────────────────────────────────

const PAGE_SIZE = 1000;
const MAX_ROWS = 10000; // cap analyses at 10k recent rows for performance

export async function getVisitorSessions(
  userId: string,
  hours: number = 24,
  options: { includeBots?: boolean } = {}
): Promise<{
  success: boolean;
  error?: string;
  sessions?: VisitorSession[];
  totalSessions?: number;
}> {
  try {
    if (!(await requireAdmin(userId))) {
      return { success: false, error: "Not authorized." };
    }

    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    // Pull rows in pages
    type Row = {
      session_id: string | null;
      visitor_id: string | null;
      ip: string | null;
      page_path: string;
      city: string | null;
      region: string | null;
      country: string | null;
      device_type: string | null;
      user_agent: string | null;
      referrer: string | null;
      utm_source: string | null;
      utm_medium: string | null;
      utm_campaign: string | null;
      is_bot: boolean | null;
      created_at: string;
    };

    const rows: Row[] = [];
    let offset = 0;
    while (rows.length < MAX_ROWS) {
      const { data, error } = await supabase
        .from("platform_page_views")
        .select(
          "session_id, visitor_id, ip, page_path, city, region, country, device_type, user_agent, referrer, utm_source, utm_medium, utm_campaign, is_bot, created_at"
        )
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error || !data || data.length === 0) break;
      rows.push(...(data as Row[]));
      if (data.length < PAGE_SIZE) break;
      offset += data.length;
    }

    const filtered = options.includeBots ? rows : rows.filter((r) => !r.is_bot);

    // Group into sessions
    type Bucket = {
      hits: Row[];
    };
    const buckets = new Map<string, Bucket>();
    for (const r of filtered) {
      const key =
        r.session_id ||
        (r.visitor_id ? `v:${r.visitor_id}` : null) ||
        (r.ip ? `ip:${r.ip}` : null) ||
        "unknown";
      let b = buckets.get(key);
      if (!b) {
        b = { hits: [] };
        buckets.set(key, b);
      }
      b.hits.push(r);
    }

    // Watchlist for highlighting
    const { data: watchRows } = await supabase
      .from("analytics_watchlist")
      .select("label, note, ip, visitor_id");
    const watchByIp = new Map<string, { label: string; note: string | null }>();
    const watchByVisitor = new Map<string, { label: string; note: string | null }>();
    for (const w of watchRows || []) {
      if (w.ip) watchByIp.set(w.ip as string, { label: w.label as string, note: (w.note as string | null) ?? null });
      if (w.visitor_id) watchByVisitor.set(w.visitor_id as string, { label: w.label as string, note: (w.note as string | null) ?? null });
    }

    const sessions: VisitorSession[] = [];
    for (const [key, b] of Array.from(buckets.entries())) {
      const first = b.hits[0];
      const last = b.hits[b.hits.length - 1];
      const firstTs = new Date(first.created_at).getTime();
      const lastTs = new Date(last.created_at).getTime();
      const duration = Math.max(0, Math.round((lastTs - firstTs) / 1000));

      const pages: SessionPageHit[] = b.hits.map((h) => ({
        page_path: h.page_path,
        created_at: h.created_at,
        referrer: h.referrer,
      }));

      const watchHit =
        (first.ip && watchByIp.get(first.ip)) ||
        (first.visitor_id && watchByVisitor.get(first.visitor_id)) ||
        null;

      const { score, reasons } = scoreSession({
        pages,
        duration_seconds: duration,
        user_agent: first.user_agent,
        referrer: first.referrer,
      });

      sessions.push({
        session_key: key,
        session_id: first.session_id,
        visitor_id: first.visitor_id,
        ip: first.ip,
        city: first.city,
        region: first.region,
        country: first.country,
        device_type: first.device_type || "desktop",
        user_agent: first.user_agent,
        referrer: first.referrer,
        utm_source: first.utm_source,
        utm_medium: first.utm_medium,
        utm_campaign: first.utm_campaign,
        is_bot: !!first.is_bot,
        first_seen: first.created_at,
        last_seen: last.created_at,
        page_count: b.hits.length,
        duration_seconds: duration,
        pages,
        watchlist_label: watchHit?.label ?? null,
        watchlist_note: watchHit?.note ?? null,
        suspicion_score: score,
        suspicion_reasons: reasons,
      });
    }

    // Sort: watched first, then highest suspicion score, then most recent
    sessions.sort((a, b) => {
      if (!!a.watchlist_label !== !!b.watchlist_label) {
        return a.watchlist_label ? -1 : 1;
      }
      if (a.suspicion_score !== b.suspicion_score) {
        return b.suspicion_score - a.suspicion_score;
      }
      return b.last_seen.localeCompare(a.last_seen);
    });

    return {
      success: true,
      sessions: sessions.slice(0, 200),
      totalSessions: sessions.length,
    };
  } catch (err) {
    console.error("[VisitorIntel] sessions failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load sessions.",
    };
  }
}

// ── Watchlist CRUD ──────────────────────────────────────────────────────

export async function getWatchlist(
  userId: string
): Promise<{ success: boolean; entries?: WatchlistEntry[]; error?: string }> {
  try {
    if (!(await requireAdmin(userId))) {
      return { success: false, error: "Not authorized." };
    }

    const { data: rows, error } = await supabase
      .from("analytics_watchlist")
      .select("id, label, ip, visitor_id, note, created_at")
      .order("created_at", { ascending: false });
    if (error) return { success: false, error: error.message };

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const entries: WatchlistEntry[] = [];
    for (const r of rows || []) {
      // Count recent hits + last_seen (best-effort, per row)
      const filters = supabase
        .from("platform_page_views")
        .select("created_at", { count: "exact" })
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(1);
      let hitsQ = filters;
      if (r.ip && r.visitor_id) {
        hitsQ = filters.or(`ip.eq.${r.ip},visitor_id.eq.${r.visitor_id}`);
      } else if (r.ip) {
        hitsQ = filters.eq("ip", r.ip);
      } else if (r.visitor_id) {
        hitsQ = filters.eq("visitor_id", r.visitor_id);
      }
      const { data: hitData, count: hitCount } = await hitsQ;

      entries.push({
        id: r.id as string,
        label: r.label as string,
        ip: (r.ip as string | null) ?? null,
        visitor_id: (r.visitor_id as string | null) ?? null,
        note: (r.note as string | null) ?? null,
        created_at: r.created_at as string,
        recent_hits: hitCount ?? 0,
        last_seen: hitData && hitData[0] ? (hitData[0].created_at as string) : null,
      });
    }

    return { success: true, entries };
  } catch (err) {
    console.error("[VisitorIntel] watchlist load failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load watchlist.",
    };
  }
}

export async function addWatchlistEntry(
  userId: string,
  input: { label: string; ip?: string | null; visitor_id?: string | null; note?: string | null }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!(await requireAdmin(userId))) {
      return { success: false, error: "Not authorized." };
    }

    const label = input.label.trim();
    const ip = input.ip?.trim() || null;
    const visitor_id = input.visitor_id?.trim() || null;
    const note = input.note?.trim() || null;

    if (!label) return { success: false, error: "Label is required." };
    if (!ip && !visitor_id) {
      return { success: false, error: "At least one of IP or visitor_id is required." };
    }

    const { error } = await supabase
      .from("analytics_watchlist")
      .insert({ label, ip, visitor_id, note, created_by: userId });
    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (err) {
    console.error("[VisitorIntel] add watchlist failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to add watchlist entry.",
    };
  }
}

export async function removeWatchlistEntry(
  userId: string,
  entryId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!(await requireAdmin(userId))) {
      return { success: false, error: "Not authorized." };
    }
    const { error } = await supabase
      .from("analytics_watchlist")
      .delete()
      .eq("id", entryId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to remove watchlist entry.",
    };
  }
}
