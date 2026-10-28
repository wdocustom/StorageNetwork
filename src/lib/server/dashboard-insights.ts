import "server-only";

import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Today → Analytics peek: a 30-day read on the installer's funnel.
//
//   profile views (/p/<slug>, humans only, vs the 30 days before)
//   quote links sent → opened → booked (quotes built in Create Quote;
//   each carries a pay link)
//   one next step: customers who opened a link but haven't booked
//
// Streams into Today on its own, so it never holds the page.
// ═══════════════════════════════════════════════════════════════════════════

const DAY = 24 * 60 * 60 * 1000;
export const INSIGHT_DAYS = 30;

export interface TodayInsights {
  profileViews: number | null; // null: no profile slug yet
  profileViewsPrev: number | null;
  linksSent: number;
  linksOpened: number;
  booked: number;
  /** Opened their quote link, not booked yet, still open — worth a follow-up */
  openedNotBooked: number;
}

/** The profile page as visitors reach it; links pasted from some apps carry an invisible word joiner. */
function profilePaths(slug: string): string[] {
  return [`/p/${slug}`, `/p/${slug}%E2%81%A0`];
}

export async function loadTodayInsights(userId: string, slug: string | null): Promise<TodayInsights> {
  const db = getServiceClient();
  const now = Date.now();
  const since = new Date(now - INSIGHT_DAYS * DAY).toISOString();
  const prevSince = new Date(now - 2 * INSIGHT_DAYS * DAY).toISOString();

  const views = (from: string, to?: string) => {
    let q = db
      .from("platform_page_views")
      .select("id", { count: "exact", head: true })
      .in("page_path", profilePaths(slug!))
      .gte("created_at", from)
      .not("is_bot", "is", true);
    if (to) q = q.lt("created_at", to);
    return q.then(({ count }) => count ?? 0);
  };

  const [profileViews, profileViewsPrev, quotesRes] = await Promise.all([
    slug ? views(since) : Promise.resolve(null),
    slug ? views(prevSince, since) : Promise.resolve(null),
    db
      .from("leads")
      .select("deposit_paid, viewed_at, status")
      .eq("installer_id", userId)
      .eq("source", "installer_manual")
      .gte("created_at", since),
  ]);

  const quotes = (quotesRes.data ?? []) as { deposit_paid: boolean; viewed_at: string | null; status: string }[];
  return {
    profileViews,
    profileViewsPrev,
    linksSent: quotes.length,
    linksOpened: quotes.filter((q) => q.viewed_at || q.deposit_paid).length,
    booked: quotes.filter((q) => q.deposit_paid).length,
    openedNotBooked: quotes.filter((q) => q.viewed_at && !q.deposit_paid && q.status === "pending_payment").length,
  };
}
