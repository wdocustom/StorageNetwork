import "server-only";

// ═══════════════════════════════════════════════════════════════════════════
// Record DIY plan buyer activity (plan_buyer_activity). See @/lib/plan-activity.
// Best effort: logging never fails or slows the page it describes beyond one
// insert, and never throws.
// ═══════════════════════════════════════════════════════════════════════════

import { getServiceClient } from "@/lib/supabase-server";
import { currentDeviceHash } from "@/lib/server/plan-device";
import { cleanActivityPayload, isAccessToken, type PlanActivityEvent, type PlanActivityPayload } from "@/lib/plan-activity";

export interface ActivityOwner {
  access_token: string;
  email: string;
  plan_id: string;
}

export async function recordPlanActivity(
  owner: ActivityOwner,
  event: PlanActivityEvent,
  payload: PlanActivityPayload & { sessionId?: string | null; inApp?: string | null } = {}
): Promise<void> {
  try {
    if (!isAccessToken(owner.access_token) || !owner.email) return;
    const { detail, value, total } = cleanActivityPayload(payload);
    const deviceHash = await currentDeviceHash().catch(() => null);
    const { error } = await getServiceClient()
      .from("plan_buyer_activity")
      .insert({
        access_token: owner.access_token,
        email: owner.email.trim().toLowerCase(),
        plan_id: owner.plan_id,
        event,
        detail,
        value,
        total,
        device_hash: deviceHash,
        session_id: typeof payload.sessionId === "string" ? payload.sessionId.slice(0, 64) : null,
        in_app: typeof payload.inApp === "string" ? payload.inApp.slice(0, 32) : null,
      });
    if (error) console.error("[PlanActivity] insert failed:", event, error.message);
  } catch (err) {
    console.error("[PlanActivity] record failed:", event, err);
  }
}

/** The purchase behind an access token, for recording against it. */
export async function activityOwnerByToken(token: unknown): Promise<ActivityOwner | null> {
  if (!isAccessToken(token)) return null;
  const { data } = await getServiceClient()
    .from("public_plan_purchases")
    .select("access_token, email, plan_id")
    .eq("access_token", token)
    .maybeSingle();
  return (data as ActivityOwner | null) ?? null;
}
