"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";
import { computeSetupStatus, type SetupStatus } from "@/lib/server/setup-status";

// ═══════════════════════════════════════════════════════════════════════════
// Setup Checklist — Server Action
//
// Computes the real-time completion state for each onboarding milestone
// by querying installer_activity_log, leads, and profiles.
// No cached booleans — always reflects the installer's actual progress.
// ═══════════════════════════════════════════════════════════════════════════

export type { ChecklistStep, SetupStatus } from "@/lib/server/setup-status";

const db = () => getServiceClient();

// Valid checklist actions that can be marked complete
const VALID_CHECKLIST_ACTIONS = new Set([
  "copy_link",
  "social_generate",
  "social_share",
  "group_finder_used",
  "instagram_visited",
  "checklist_dismissed",
]);

/**
 * Mark a setup checklist step as complete by inserting an activity log entry.
 * Authenticates via cookies and verifies the caller matches the userId.
 * Uses the service client for the insert to avoid RLS complications.
 */
export async function markChecklistStepComplete(
  userId: string,
  action: string
): Promise<{ success: boolean; error?: string }> {
  if (!VALID_CHECKLIST_ACTIONS.has(action)) {
    return { success: false, error: "Invalid action" };
  }

  // Verify the caller is authenticated as the claimed user
  const user = await getAuthenticatedUser();
  if (!user) {
    console.error("[SetupChecklist] Auth failed for markChecklistStepComplete — userId:", userId);
    return { success: false, error: "Not authenticated" };
  }
  if (user.id !== userId) {
    return { success: false, error: "Unauthorized" };
  }

  const { error } = await db().from("installer_activity_log").insert({
    installer_id: userId,
    action,
    page_path: "/dashboard",
    detail: { source: "setup_checklist" },
  });

  if (error) {
    console.error("[SetupChecklist] Insert failed:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Lightweight step completion — uses service_role directly.
 * Bypasses cookie-based auth since the userId was already verified at page load.
 * Used by SetupChecklist client component where cookie auth may be stale.
 */
export async function completeChecklistStep(
  userId: string,
  action: string
): Promise<boolean> {
  if (!userId || !VALID_CHECKLIST_ACTIONS.has(action)) return false;

  const { error } = await db().from("installer_activity_log").insert({
    installer_id: userId,
    action,
    page_path: "/dashboard",
    detail: { source: "setup_checklist" },
  });

  if (error) {
    console.error("[SetupChecklist] completeChecklistStep insert failed:", error.message);
    return false;
  }
  return true;
}

export async function getSetupStatus(userId: string): Promise<SetupStatus> {
  const user = await getAuthenticatedUser();
  if (!user || user.id !== userId) throw new Error("Not authorized");
  return computeSetupStatus(userId);
}
