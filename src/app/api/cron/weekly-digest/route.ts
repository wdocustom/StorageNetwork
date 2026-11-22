import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { sendWeeklyDigestEmail } from "@/lib/email";
import { getLeaderboard } from "@/lib/server/leaderboard";
import { getAppUrl } from "@/lib/url-helper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/cron/weekly-digest
// Sends a personalized weekly activity scorecard to every active installer.
// Called every Monday at 9am UTC via Vercel Cron.
//
// Per-installer content:
//   - Customer-facing stats for the last 7 days:
//       page views  → page_views (public visits to the installer's links)
//       quotes      → leads the installer sent (source = installer_manual)
//       leads       → leads a customer started (every other source)
//       jobs        → any lead paid out
//     NOT installer_activity_log — that table records the installer's own
//     dashboard clicks, which made every scorecard count their own usage.
//   - Contextual CTA based on behavior gaps
//   - Top 3 leaderboard names for social proof
// ═══════════════════════════════════════════════════════════════════════════

const db = () => getServiceClient();

// PostgREST caps every response at the project's max-rows (1000 by default)
// regardless of .limit(), so a single query silently drops rows once the
// whole network has more than that in a week. Page through instead.
const PAGE_SIZE = 1000;
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

interface InstallerRow {
  id: string;
  email: string;
  first_name: string | null;
  business_name: string | null;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sinceStr = sevenDaysAgo.toISOString();
    // Dedup window: 6 days, so a slightly-late Monday run still finds last week's recipients.
    const sixDaysAgoStr = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch eligible installers:
    //   - not suspended (treat NULL as not suspended — `.neq(col, true)` excludes NULLs in PostgREST)
    //   - not opted out of the weekly digest
    //   - either never received a digest, or last received > 6 days ago (prevents duplicate sends)
    // Order by last_digest_sent_at asc so the longest-waiting installers come first when paginating.
    const { data: installers, error: profileErr } = await db()
      .from("profiles")
      .select("id, email, first_name, business_name")
      .or("is_suspended.is.null,is_suspended.eq.false")
      .or("is_realtor.is.null,is_realtor.eq.false,is_pro.eq.true")
      .eq("weekly_digest_opted_out", false)
      .or(`last_digest_sent_at.is.null,last_digest_sent_at.lt.${sixDaysAgoStr}`)
      .order("last_digest_sent_at", { ascending: true, nullsFirst: true })
      .limit(500);

    if (profileErr || !installers) {
      console.error("[WeeklyDigest] Profile query error:", profileErr?.message);
      return NextResponse.json({ success: false, error: profileErr?.message }, { status: 500 });
    }

    if (installers.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: "No eligible installers" });
    }

    const installerIds = installers.map((i) => i.id as string);

    // Public visits to installers' pages (same source as the Analytics page).
    const recentViews = await fetchAll<{ installer_id: string }>((from, to) =>
      db()
        .from("page_views")
        .select("installer_id")
        .in("installer_id", installerIds)
        .gte("created_at", sinceStr)
        .order("id")
        .range(from, to)
    );

    // Leads created in the window — split into quotes sent vs customer leads below.
    const recentLeads = await fetchAll<{ installer_id: string; source: string | null; payout_status: string | null }>(
      (from, to) =>
        db()
          .from("leads")
          .select("installer_id, source, payout_status")
          .in("installer_id", installerIds)
          .gte("created_at", sinceStr)
          .order("id")
          .range(from, to)
    );

    // Social posts only (drives the CTA). The activity log is fine here: this
    // is genuinely the installer's own action.
    const socialActivity = await fetchAll<{ installer_id: string }>((from, to) =>
      db()
        .from("installer_activity_log")
        .select("installer_id")
        .in("installer_id", installerIds)
        .in("action", ["social_generate", "social_share"])
        .gte("created_at", sinceStr)
        .order("id")
        .range(from, to)
    );

    // Build per-installer stats
    type Stats = {
      pageViews: number;
      quotesCreated: number;
      socialShares: number;
      leadsReceived: number;
      jobsCompleted: number;
    };
    const statsMap = new Map<string, Stats>();

    for (const id of installerIds) {
      statsMap.set(id, { pageViews: 0, quotesCreated: 0, socialShares: 0, leadsReceived: 0, jobsCompleted: 0 });
    }

    for (const v of recentViews) {
      const s = statsMap.get(v.installer_id);
      if (s) s.pageViews++;
    }

    for (const a of socialActivity) {
      const s = statsMap.get(a.installer_id);
      if (s) s.socialShares++;
    }

    for (const lead of recentLeads) {
      const s = statsMap.get(lead.installer_id);
      if (!s) continue;
      if (lead.source === "installer_manual") s.quotesCreated++;
      else s.leadsReceived++;
      if (lead.payout_status === "paid") s.jobsCompleted++;
    }

    // Get leaderboard for social proof (use a system user ID)
    let topInstallers: Array<{ name: string; score: number }> = [];
    try {
      const lb = await getLeaderboard(installerIds[0]);
      topInstallers = lb.entries
        .slice(0, 3)
        .map((e) => ({
          name: e.businessName,
          score: e.revenueThisMonth > 0 ? e.revenueThisMonth : e.allTimeJobs * 10,
        }));
    } catch {
      // Non-fatal — send digest without leaderboard
    }

    const appUrl = getAppUrl();
    let sent = 0;
    const errors: string[] = [];

    for (const installer of installers as InstallerRow[]) {
      const displayName = installer.business_name || installer.first_name || "there";
      const stats = statsMap.get(installer.id)!;

      // Determine best CTA based on behavior gaps
      let cta: { label: string; href: string; reason: string };

      if (stats.leadsReceived > 0 && stats.jobsCompleted === 0) {
        cta = {
          label: "View Your Leads",
          href: `${appUrl}/dashboard/leads`,
          reason: `You have ${stats.leadsReceived} new lead${stats.leadsReceived > 1 ? "s" : ""} waiting. Follow up to close the deal!`,
        };
      } else if (stats.socialShares === 0) {
        cta = {
          label: "Create a Facebook Post",
          href: `${appUrl}/dashboard/marketing`,
          reason: "Post in a local Facebook buy/sell group to get your first customer this week.",
        };
      } else if (stats.quotesCreated === 0) {
        cta = {
          label: "Build a Quote",
          href: `${appUrl}/dashboard/build`,
          reason: "Use the AI Builder to price a job in seconds. Try: \"4x4 with totes and wheels\"",
        };
      } else if (stats.jobsCompleted > 0) {
        cta = {
          label: "Share Your Success",
          href: `${appUrl}/dashboard/marketing`,
          reason: "You completed a job this week! Share it on social media to attract more customers.",
        };
      } else {
        cta = {
          label: "Share Your Link",
          href: `${appUrl}/dashboard/marketing`,
          reason: "Copy your booking link and post it on Facebook or send it via text.",
        };
      }

      const unsubscribeUrl = `${appUrl}/api/unsubscribe-digest?id=${installer.id}`;

      try {
        const result = await sendWeeklyDigestEmail({
          email: installer.email,
          displayName,
          pageViews: stats.pageViews,
          quotesCreated: stats.quotesCreated,
          leadsReceived: stats.leadsReceived,
          jobsCompleted: stats.jobsCompleted,
          cta,
          topInstallers,
          unsubscribeUrl,
        });

        if (result.success) {
          sent++;
          // Update last_digest_sent_at
          await db()
            .from("profiles")
            .update({ last_digest_sent_at: now.toISOString() })
            .eq("id", installer.id);
        } else {
          errors.push(`${installer.email}: ${result.error}`);
        }
      } catch (err) {
        errors.push(`${installer.email}: ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }

    const response = {
      success: true,
      timestamp: now.toISOString(),
      total: installers.length,
      sent,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log("[WeeklyDigest] Completed:", response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("[WeeklyDigest] Failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
