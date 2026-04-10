"use server";

import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard Nudge — Server Action
//
// Returns the single most relevant coaching nudge for an installer
// based on their real activity state. Priority-ordered rules — first
// matching rule wins.
// ═══════════════════════════════════════════════════════════════════════════

export interface DashboardNudge {
  id: string;
  icon: "megaphone" | "briefcase" | "hardhat" | "trophy" | "link" | "users";
  title: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
}

const db = () => getServiceClient();

export async function getDashboardNudge(userId: string): Promise<DashboardNudge | null> {
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

  // Run all queries in parallel
  const [unviewedLeadsRes, recentSocialRes, recentBuildRes, allLeadsRes, recentCompletedRes] =
    await Promise.all([
      // Unviewed leads (new status with deposit paid)
      db()
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("installer_id", userId)
        .eq("deposit_paid", true)
        .eq("status", "new"),

      // Social shares in last 14 days
      db()
        .from("installer_activity_log")
        .select("id", { count: "exact", head: true })
        .eq("installer_id", userId)
        .in("action", ["social_generate", "social_share"])
        .gte("created_at", fourteenDaysAgo),

      // Build page visits in last 7 days
      db()
        .from("installer_activity_log")
        .select("id", { count: "exact", head: true })
        .eq("installer_id", userId)
        .eq("action", "page_view")
        .in("page_path", ["/dashboard/build", "/build"])
        .gte("created_at", sevenDaysAgo),

      // Total leads (has quotes)
      db()
        .from("leads")
        .select("id, payout_status", { count: "exact" })
        .eq("installer_id", userId)
        .limit(1),

      // Recently completed job (last 3 days)
      db()
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("installer_id", userId)
        .eq("payout_status", "paid")
        .gte("created_at", threeDaysAgo),
    ]);

  const unviewedLeads = unviewedLeadsRes.count ?? 0;
  const recentSocial = recentSocialRes.count ?? 0;
  const recentBuild = recentBuildRes.count ?? 0;
  const totalLeads = allLeadsRes.count ?? 0;
  const hasAnyPaid = allLeadsRes.data?.some((l) => l.payout_status === "paid") ?? false;
  const recentCompleted = recentCompletedRes.count ?? 0;

  // Priority-ordered rules — first match wins

  // 1. Has unviewed leads
  if (unviewedLeads > 0) {
    return {
      id: "unviewed_leads",
      icon: "briefcase",
      title: `You have ${unviewedLeads} new lead${unviewedLeads > 1 ? "s" : ""}!`,
      message: "Review and respond quickly — fast replies close more jobs.",
      ctaLabel: "View Leads",
      ctaHref: "/dashboard/leads",
    };
  }

  // 2. No social shares in 14 days
  if (recentSocial === 0) {
    return {
      id: "no_social",
      icon: "megaphone",
      title: "Post in a local Facebook group",
      message: "Installers who post weekly land 3x more jobs. Use our post generator to create one in seconds.",
      ctaLabel: "Create a Post",
      ctaHref: "/dashboard/marketing",
    };
  }

  // 3. No build page visits in 7 days
  if (recentBuild === 0) {
    return {
      id: "no_quotes",
      icon: "hardhat",
      title: "Try the AI Builder",
      message: "Describe a job in plain English and get an instant quote with materials and pricing.",
      ctaLabel: "Build a Quote",
      ctaHref: "/dashboard/build",
    };
  }

  // 4. Has leads but no completed jobs
  if (totalLeads > 0 && !hasAnyPaid) {
    return {
      id: "close_deals",
      icon: "briefcase",
      title: "Follow up on your leads",
      message: "You have quotes out — a quick follow-up call or text can close the deal.",
      ctaLabel: "View Jobs",
      ctaHref: "/dashboard/leads",
    };
  }

  // 5. Completed a job recently
  if (recentCompleted > 0) {
    return {
      id: "share_success",
      icon: "trophy",
      title: "Great job — share your success!",
      message: "Post a before/after photo on Facebook to attract more customers.",
      ctaLabel: "Create a Post",
      ctaHref: "/dashboard/marketing",
    };
  }

  // 6. Default — share your link
  return {
    id: "share_link",
    icon: "link",
    title: "Share your booking link today",
    message: "Copy your personal link and post it on Facebook, NextDoor, or send it via text.",
    ctaLabel: "Get Your Link",
    ctaHref: "/dashboard/marketing",
  };
}
