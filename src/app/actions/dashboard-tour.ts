"use server";

import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { TOUR_ENDED_ACTION } from "@/lib/server/dashboard-tour";

// ═══════════════════════════════════════════════════════════════════════════
// Installer dashboard tour: remembers that an installer has seen it.
//
// Stored as an installer_activity_log row (the same way the setup checklist
// remembers it was dismissed), so there's no schema change and the rows
// double as drop-off data: `detail.step` says where people left.
// ═══════════════════════════════════════════════════════════════════════════

export async function endDashboardTour(input: { completed: boolean; step: string; stepIndex: number }): Promise<void> {
  const user = await getAuthenticatedUser().catch(() => null);
  if (!user) return;
  const { error } = await getServiceClient()
    .from("installer_activity_log")
    .insert({
      installer_id: user.id,
      action: TOUR_ENDED_ACTION,
      page_path: "/dashboard",
      detail: { completed: input.completed, step: String(input.step).slice(0, 64), step_index: input.stepIndex },
    });
  if (error) console.error("[DashboardTour] insert failed:", error.message);
}
