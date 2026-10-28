"use server";

import { getAuthenticatedUser } from "@/lib/auth";
import { computeDashboardNudge, type DashboardNudge } from "@/lib/server/dashboard-nudge";

export type { DashboardNudge } from "@/lib/server/dashboard-nudge";

/** The signed-in installer's coaching nudge (rules in @/lib/server/dashboard-nudge). */
export async function getDashboardNudge(userId: string): Promise<DashboardNudge | null> {
  const user = await getAuthenticatedUser();
  if (!user || user.id !== userId) return null;
  return computeDashboardNudge(userId);
}
