"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";

// ═══════════════════════════════════════════════════════════════════════════
// Installer Activity Logging
//
// Tracks authenticated installer actions across the platform:
//   - Dashboard page views (which pages they browse)
//   - Lead interactions (viewing, updating, emailing)
//   - Profile edits, downloads, settings changes
//   - Used by platform admin to monitor behavior patterns
//
// Every log is tied to the authenticated installer's profile ID.
// ═══════════════════════════════════════════════════════════════════════════

const db = () => getServiceClient();

// ── Log an installer action ──────────────────────────────────────────────

export async function logInstallerActivity(input: {
  action: string;
  pagePath?: string;
  detail?: Record<string, unknown>;
}): Promise<{ success: boolean }> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false };

    await db().from("installer_activity_log").insert({
      installer_id: user.id,
      action: input.action,
      page_path: input.pagePath || null,
      detail: input.detail || {},
    });

    return { success: true };
  } catch {
    return { success: false };
  }
}

// ── Log from server actions (when we already have the installer ID) ──────

export async function logActivityInternal(
  installerId: string,
  action: string,
  detail?: Record<string, unknown>
): Promise<void> {
  try {
    await db().from("installer_activity_log").insert({
      installer_id: installerId,
      action,
      detail: detail || {},
    });
  } catch {
    // Non-blocking — never break the parent action
  }
}

// ── Get installer activity for admin dashboard ───────────────────────────

export interface InstallerActivitySummary {
  installerId: string;
  installerName: string;
  businessName: string | null;
  email: string;
  avatarUrl: string | null;
  totalActions: number;
  lastActive: string;
  topPages: Array<{ page: string; count: number }>;
  topActions: Array<{ action: string; count: number }>;
  recentActivity: Array<{
    action: string;
    page_path: string | null;
    detail: Record<string, unknown>;
    created_at: string;
  }>;
}

export async function getInstallerActivityReport(
  adminUserId: string,
  days: number = 30
): Promise<{ installers: InstallerActivitySummary[]; error?: string }> {
  // Verify admin
  const { data: adminProfile } = await db()
    .from("profiles")
    .select("is_admin")
    .eq("id", adminUserId)
    .maybeSingle();

  if (!adminProfile?.is_admin) {
    return { installers: [], error: "Unauthorized" };
  }

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString();

  // Get all activity in the period
  const { data: logs } = await db()
    .from("installer_activity_log")
    .select("installer_id, action, page_path, detail, created_at")
    .gte("created_at", sinceStr)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (!logs || logs.length === 0) {
    return { installers: [] };
  }

  // Group by installer
  type LogEntry = (typeof logs)[number];
  const byInstaller: Record<string, LogEntry[]> = {};
  for (const log of logs) {
    const id = log.installer_id as string;
    if (!byInstaller[id]) byInstaller[id] = [];
    byInstaller[id].push(log);
  }

  // Fetch installer profiles
  const installerIds = Object.keys(byInstaller);
  const { data: profiles } = await db()
    .from("profiles")
    .select("id, first_name, last_name, business_name, email, avatar_url")
    .in("id", installerIds);

  const profileMap = new Map(
    (profiles || []).map((p) => [p.id, p])
  );

  // Build summaries
  const installers: InstallerActivitySummary[] = [];

  for (const installerId of Object.keys(byInstaller)) {
    const entries = byInstaller[installerId];
    const profile = profileMap.get(installerId);
    if (!profile) continue;

    // Count pages
    const pageCounts = new Map<string, number>();
    const actionCounts = new Map<string, number>();

    for (const e of entries) {
      if (e.page_path) {
        pageCounts.set(e.page_path, (pageCounts.get(e.page_path) || 0) + 1);
      }
      actionCounts.set(e.action, (actionCounts.get(e.action) || 0) + 1);
    }

    const topPages = Array.from(pageCounts.entries())
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topActions = Array.from(actionCounts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    installers.push({
      installerId,
      installerName: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Unknown",
      businessName: profile.business_name || null,
      email: profile.email || "",
      avatarUrl: profile.avatar_url || null,
      totalActions: entries.length,
      lastActive: entries[0].created_at as string,
      topPages,
      topActions,
      recentActivity: entries.slice(0, 25).map((e) => ({
        action: e.action as string,
        page_path: e.page_path as string | null,
        detail: (e.detail || {}) as Record<string, unknown>,
        created_at: e.created_at as string,
      })),
    });
  }

  // Sort by most recent activity first
  installers.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());

  return { installers };
}
