import { getServiceClient } from "@/lib/supabase-server";

/** installer_activity_log action written when an installer finishes or skips the dashboard tour. */
export const TOUR_ENDED_ACTION = "dashboard_tour_ended";

/**
 * Whether the dashboard tour should auto-start for this user: an installer
 * (not a realtor-only account) who has never finished or skipped it.
 * Fails closed: on any error the tour stays off rather than nagging.
 */
export async function shouldAutoStartDashboardTour(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const db = getServiceClient();
    const [{ data: profile }, { data: seen, error }] = await Promise.all([
      db.from("profiles").select("is_realtor, is_pro").eq("id", userId).maybeSingle(),
      db.from("installer_activity_log").select("id").eq("installer_id", userId).eq("action", TOUR_ENDED_ACTION).limit(1),
    ]);
    if (error || !profile) return false;
    if (profile.is_realtor && !profile.is_pro) return false;
    return (seen ?? []).length === 0;
  } catch {
    return false;
  }
}
