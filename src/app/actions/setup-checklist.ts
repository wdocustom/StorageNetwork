"use server";

import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Setup Checklist — Server Action
//
// Computes the real-time completion state for each onboarding milestone
// by querying installer_activity_log, leads, and profiles.
// No cached booleans — always reflects the installer's actual progress.
// ═══════════════════════════════════════════════════════════════════════════

export interface ChecklistStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  ctaLabel: string;
  ctaHref: string;
}

export interface SetupStatus {
  steps: ChecklistStep[];
  completedCount: number;
  totalSteps: number;
  allComplete: boolean;
}

const db = () => getServiceClient();

export async function getSetupStatus(userId: string): Promise<SetupStatus> {
  // Run all queries in parallel for speed
  const [activityRes, leadsRes, paidRes, profileRes] = await Promise.all([
    // Check activity log for key actions
    db()
      .from("installer_activity_log")
      .select("action, page_path")
      .eq("installer_id", userId)
      .in("action", ["copy_link", "social_generate", "social_share", "page_view", "group_finder_used"])
      .limit(500),

    // Check if installer has any leads (quotes sent)
    db()
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("installer_id", userId),

    // Check if installer has completed jobs
    db()
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("installer_id", userId)
      .eq("payout_status", "paid"),

    // Get profile for Stripe status
    db()
      .from("profiles")
      .select("stripe_account_id, slug")
      .eq("id", userId)
      .single(),
  ]);

  const activities = activityRes.data || [];
  const actionSet = new Set(activities.map((a) => a.action as string));
  const pageSet = new Set(
    activities
      .filter((a) => a.action === "page_view")
      .map((a) => a.page_path as string)
  );

  const hasStripe = !!profileRes.data?.stripe_account_id;
  const hasCopiedLink = actionSet.has("copy_link");
  const hasSocialShare = actionSet.has("social_generate") || actionSet.has("social_share");
  const hasVisitedBuild = pageSet.has("/dashboard/build") || pageSet.has("/build");
  const hasGroupFinder = actionSet.has("group_finder_used");
  const hasLeads = (leadsRes.count ?? 0) > 0;
  const hasPaidJob = (paidRes.count ?? 0) > 0;

  const steps: ChecklistStep[] = [
    {
      id: "stripe",
      label: "Connect Stripe",
      description: "Set up payments so you can get paid for jobs",
      completed: hasStripe,
      ctaLabel: "Connect Stripe",
      ctaHref: "/dashboard/profile",
    },
    {
      id: "copy_link",
      label: "Copy your booking link",
      description: "Your personal link tracks every customer back to you",
      completed: hasCopiedLink,
      ctaLabel: "Get Your Link",
      ctaHref: "/dashboard/marketing",
    },
    {
      id: "social_share",
      label: "Share on social media",
      description: "Use our post generator to create a professional Facebook or Instagram post",
      completed: hasSocialShare,
      ctaLabel: "Create a Post",
      ctaHref: "/dashboard/marketing",
    },
    {
      id: "create_quote",
      label: "Create your first quote",
      description: "Use the AI Builder to price a job in seconds",
      completed: hasVisitedBuild || hasLeads,
      ctaLabel: "Build a Quote",
      ctaHref: "/dashboard/build",
    },
    {
      id: "find_groups",
      label: "Find local Facebook groups",
      description: "Our AI Group Finder locates buy/sell groups in your area",
      completed: hasGroupFinder,
      ctaLabel: "Find Groups",
      ctaHref: "/dashboard/marketing",
    },
    {
      id: "first_job",
      label: "Complete your first job",
      description: "Land a customer, build it, mark it complete",
      completed: hasPaidJob,
      ctaLabel: "View Jobs",
      ctaHref: "/dashboard/leads",
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;

  return {
    steps,
    completedCount,
    totalSteps: steps.length,
    allComplete: completedCount === steps.length,
  };
}
