"use server";

import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Leaderboard — Monthly installer rankings
//
// Aggregates completed jobs (payout_status = 'paid') for the current
// calendar month and returns the top performers. Revenue is summed from
// balance_due. Each installer's rank, streak, and position delta are
// computed server-side to keep the client lightweight.
// ═══════════════════════════════════════════════════════════════════════════

export interface LeaderboardEntry {
  id: string;
  rank: number;
  businessName: string;
  city: string | null;
  state: string | null;
  avatarUrl: string | null;
  slug: string | null;
  isPro: boolean;
  jobsThisMonth: number;
  revenueThisMonth: number;
  allTimeJobs: number;
  streak: number; // consecutive months with at least 1 paid job
  isCurrentUser: boolean;
  engagementScore?: number; // activity-based score (when scoreBasis is "engagement")
}

export type ScoreBasis = "revenue" | "engagement";

export interface LeaderboardData {
  entries: LeaderboardEntry[];
  currentUserRank: number | null;
  monthLabel: string;
  daysLeft: number;
  totalDays: number;
  scoreBasis: ScoreBasis;
}

/**
 * Fetch the monthly leaderboard. Returns top 10 + the current user
 * (if not already in the top 10) so they always see their own position.
 */
export async function getLeaderboard(
  currentUserId: string
): Promise<LeaderboardData> {
  const supabase = getServiceClient();
  const now = new Date();

  // Platform launch date — the leaderboard tracks from this date.
  // Inaugural period: Feb 8 2026 → Mar 31 2026.
  // Standard monthly cycles begin April 1, 2026.
  const LAUNCH_DATE = new Date("2026-02-08T00:00:00Z");
  const FIRST_CYCLE_END = new Date("2026-04-01T00:00:00Z");

  let periodStart: Date;
  let periodEnd: Date;
  let periodLabel: string;

  if (now < FIRST_CYCLE_END) {
    // Inaugural period
    periodStart = LAUNCH_DATE;
    periodEnd = FIRST_CYCLE_END;
    periodLabel = "Feb 8 – Mar 31, 2026";
  } else {
    // Standard monthly cycles starting April 1 2026
    const year = now.getFullYear();
    const month = now.getMonth();
    periodStart = new Date(year, month, 1);
    periodEnd = new Date(year, month + 1, 1);
    periodLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });
  }

  const monthStart = periodStart.toISOString();
  const monthEnd = periodEnd.toISOString();

  // Days remaining and total days in the current period
  const msLeft = periodEnd.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));

  const monthLabel = periodLabel;

  // Fetch all paid leads this month with installer info
  const { data: paidLeads, error } = await supabase
    .from("leads")
    .select("installer_id, balance_due")
    .eq("payout_status", "paid")
    .gte("created_at", monthStart)
    .lt("created_at", monthEnd);

  if (error || !paidLeads) {
    console.error("[Leaderboard]", error?.message);
    return { entries: [], currentUserRank: null, monthLabel, daysLeft, totalDays, scoreBasis: "revenue" };
  }

  // Aggregate per installer
  const agg = new Map<string, { jobs: number; revenue: number }>();
  for (const lead of paidLeads) {
    const id = lead.installer_id as string;
    if (!id) continue;
    const prev = agg.get(id) || { jobs: 0, revenue: 0 };
    prev.jobs += 1;
    prev.revenue += (lead.balance_due as number) || 0;
    agg.set(id, prev);
  }

  // Sort by jobs desc, then revenue desc
  const sorted = Array.from(agg.entries()).sort((a, b) => {
    if (b[1].jobs !== a[1].jobs) return b[1].jobs - a[1].jobs;
    return b[1].revenue - a[1].revenue;
  });

  // Collect installer IDs we need profiles for (top 10 monthly + current user)
  const top10Ids = sorted.slice(0, 10).map(([id]) => id);
  const needIds = new Set(top10Ids);
  needIds.add(currentUserId);

  // Also fetch top installers by ALL-TIME completed jobs so the board
  // is populated even when few people have jobs this specific month.
  const { data: topAllTime } = await supabase
    .from("profiles")
    .select("id")
    .gt("completed_jobs", 0)
    .order("completed_jobs", { ascending: false })
    .limit(20);

  for (const p of topAllTime || []) {
    needIds.add(p.id as string);
  }

  // Fetch profiles + all-time completed_jobs
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, business_name, city, state, avatar_url, slug, is_pro, completed_jobs")
    .in("id", Array.from(needIds));

  const profileMap = new Map(
    (profiles || []).map((p) => [p.id as string, p])
  );

  // Compute streaks: fetch last 12 months of paid leads in one query,
  // then compute consecutive monthly activity per installer in JS.
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  const twelveMonthsAgo = new Date(nowYear, nowMonth - 12, 1).toISOString();
  const streakIds = Array.from(needIds);
  const streaks = new Map<string, number>();

  const { data: historicalLeads } = await supabase
    .from("leads")
    .select("installer_id, created_at")
    .eq("payout_status", "paid")
    .in("installer_id", streakIds)
    .gte("created_at", twelveMonthsAgo)
    .lt("created_at", monthStart);

  // Build a set of "YYYY-MM" keys per installer
  const monthlyActivity = new Map<string, Set<string>>();
  for (const lead of historicalLeads || []) {
    const id = lead.installer_id as string;
    const d = new Date(lead.created_at as string);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyActivity.has(id)) monthlyActivity.set(id, new Set());
    monthlyActivity.get(id)!.add(key);
  }

  for (const id of streakIds) {
    let streak = 0;
    const activity = monthlyActivity.get(id);
    if (activity) {
      for (let m = 1; m <= 12; m++) {
        const d = new Date(nowYear, nowMonth - m, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (activity.has(key)) {
          streak++;
        } else {
          break;
        }
      }
    }
    // Include current month if they have jobs
    if (agg.has(id)) streak += 1;
    streaks.set(id, streak);
  }

  // Build entries
  function buildEntry(
    installerId: string,
    rank: number,
    isCurrentUser: boolean
  ): LeaderboardEntry {
    const p = profileMap.get(installerId);
    const stats = agg.get(installerId) || { jobs: 0, revenue: 0 };
    return {
      id: installerId,
      rank,
      businessName: (p?.business_name as string) || "Storage Network Installer",
      city: (p?.city as string) || null,
      state: (p?.state as string) || null,
      avatarUrl: (p?.avatar_url as string) || null,
      slug: (p?.slug as string) || null,
      isPro: !!(p?.is_pro),
      jobsThisMonth: stats.jobs,
      revenueThisMonth: Math.round(stats.revenue),
      allTimeJobs: (p?.completed_jobs as number) || 0,
      streak: streaks.get(installerId) || 0,
      isCurrentUser,
    };
  }

  // Build a combined ranking: monthly jobs first, then all-time jobs as tiebreaker.
  // Include all known installers (those with monthly jobs + those with all-time jobs).
  const allInstallerIds = new Set<string>();
  for (const [id] of sorted) allInstallerIds.add(id);
  for (const p of profiles || []) allInstallerIds.add(p.id as string);

  const combined = Array.from(allInstallerIds).map((id) => {
    const monthlyStats = agg.get(id) || { jobs: 0, revenue: 0 };
    const prof = profileMap.get(id);
    const allTime = (prof?.completed_jobs as number) || 0;
    return { id, monthlyJobs: monthlyStats.jobs, monthlyRevenue: monthlyStats.revenue, allTime };
  });

  // Sort: monthly jobs desc → all-time jobs desc → revenue desc
  combined.sort((a, b) => {
    if (b.monthlyJobs !== a.monthlyJobs) return b.monthlyJobs - a.monthlyJobs;
    if (b.allTime !== a.allTime) return b.allTime - a.allTime;
    return b.monthlyRevenue - a.monthlyRevenue;
  });

  // Determine if we have enough monthly job data to rank by revenue,
  // or if we should fall back to engagement scores from activity logs.
  const installersWithMonthlyJobs = combined.filter((c) => c.monthlyJobs > 0).length;
  const useEngagement = installersWithMonthlyJobs < 3;
  const scoreBasis: ScoreBasis = useEngagement ? "engagement" : "revenue";

  // If engagement mode, fetch activity scores for all known installers
  const engagementScores = new Map<string, number>();
  if (useEngagement) {
    const allIds = Array.from(allInstallerIds);
    const { data: actLogs } = await supabase
      .from("installer_activity_log")
      .select("installer_id, action")
      .in("installer_id", allIds)
      .gte("created_at", monthStart)
      .lt("created_at", monthEnd)
      .limit(10000);

    // Score: page_view=1, social_generate/social_share=3, quote/build=5
    for (const log of actLogs || []) {
      const id = log.installer_id as string;
      const action = log.action as string;
      const prev = engagementScores.get(id) || 0;
      if (action === "page_view") {
        engagementScores.set(id, prev + 1);
      } else if (action === "social_generate" || action === "social_share") {
        engagementScores.set(id, prev + 3);
      } else {
        engagementScores.set(id, prev + 2);
      }
    }
    // Add lead-based points (10 per lead received this month)
    for (const lead of paidLeads) {
      const id = lead.installer_id as string;
      engagementScores.set(id, (engagementScores.get(id) || 0) + 10);
    }

    // Re-sort combined by engagement score
    combined.sort((a, b) => {
      const scoreA = engagementScores.get(a.id) || 0;
      const scoreB = engagementScores.get(b.id) || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.allTime - a.allTime;
    });
  }

  const entries: LeaderboardEntry[] = [];
  let currentUserRank: number | null = null;

  // Find current user's rank
  const userIdx = combined.findIndex((c) => c.id === currentUserId);
  if (userIdx >= 0) currentUserRank = userIdx + 1;

  // Top 10
  for (let i = 0; i < Math.min(combined.length, 10); i++) {
    const c = combined[i];
    const entry = buildEntry(c.id, i + 1, c.id === currentUserId);
    if (useEngagement) entry.engagementScore = engagementScores.get(c.id) || 0;
    entries.push(entry);
  }

  // If current user is not in top 10, append them
  if (currentUserRank && currentUserRank > 10) {
    const entry = buildEntry(currentUserId, currentUserRank, true);
    if (useEngagement) entry.engagementScore = engagementScores.get(currentUserId) || 0;
    entries.push(entry);
  } else if (!currentUserRank) {
    // User has 0 jobs ever — show them at the bottom
    const rank = combined.length + 1;
    const entry = buildEntry(currentUserId, rank, true);
    if (useEngagement) entry.engagementScore = engagementScores.get(currentUserId) || 0;
    entries.push(entry);
    currentUserRank = rank;
  }

  return { entries, currentUserRank, monthLabel, daysLeft, totalDays, scoreBasis };
}
