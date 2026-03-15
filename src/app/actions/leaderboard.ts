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
  isPro: boolean;
  jobsThisMonth: number;
  revenueThisMonth: number;
  allTimeJobs: number;
  streak: number; // consecutive months with at least 1 paid job
  isCurrentUser: boolean;
}

export interface LeaderboardData {
  entries: LeaderboardEntry[];
  currentUserRank: number | null;
  monthLabel: string;
  daysLeft: number;
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
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // Current month boundaries
  const monthStart = new Date(year, month, 1).toISOString();
  const monthEnd = new Date(year, month + 1, 1).toISOString();

  // Days remaining
  const lastDay = new Date(year, month + 1, 0).getDate();
  const daysLeft = lastDay - now.getDate();

  const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  // Fetch all paid leads this month with installer info
  const { data: paidLeads, error } = await supabase
    .from("leads")
    .select("installer_id, balance_due")
    .eq("payout_status", "paid")
    .gte("created_at", monthStart)
    .lt("created_at", monthEnd);

  if (error || !paidLeads) {
    console.error("[Leaderboard]", error?.message);
    return { entries: [], currentUserRank: null, monthLabel, daysLeft };
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

  // Collect installer IDs we need profiles for (top 10 + current user)
  const top10Ids = sorted.slice(0, 10).map(([id]) => id);
  const needIds = new Set(top10Ids);
  needIds.add(currentUserId);

  // Fetch profiles + all-time completed_jobs
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, business_name, city, state, avatar_url, is_pro, completed_jobs")
    .in("id", Array.from(needIds));

  const profileMap = new Map(
    (profiles || []).map((p) => [p.id as string, p])
  );

  // Compute streaks: fetch last 12 months of paid leads in one query,
  // then compute consecutive monthly activity per installer in JS.
  const twelveMonthsAgo = new Date(year, month - 12, 1).toISOString();
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
        const d = new Date(year, month - m, 1);
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
      isPro: !!(p?.is_pro),
      jobsThisMonth: stats.jobs,
      revenueThisMonth: Math.round(stats.revenue),
      allTimeJobs: (p?.completed_jobs as number) || 0,
      streak: streaks.get(installerId) || 0,
      isCurrentUser,
    };
  }

  const entries: LeaderboardEntry[] = [];
  let currentUserRank: number | null = null;

  // Full ranking to find current user's position
  const fullRank = sorted.map(([id]) => id);
  const userIdx = fullRank.indexOf(currentUserId);
  if (userIdx >= 0) currentUserRank = userIdx + 1;

  // Top 10
  for (let i = 0; i < Math.min(sorted.length, 10); i++) {
    const [id] = sorted[i];
    entries.push(buildEntry(id, i + 1, id === currentUserId));
  }

  // If current user is not in top 10, append them
  if (currentUserRank && currentUserRank > 10) {
    entries.push(buildEntry(currentUserId, currentUserRank, true));
  } else if (!currentUserRank) {
    // User has 0 jobs this month — show them at the bottom
    const rank = sorted.length + 1;
    entries.push(buildEntry(currentUserId, rank, true));
    currentUserRank = rank;
  }

  return { entries, currentUserRank, monthLabel, daysLeft };
}
