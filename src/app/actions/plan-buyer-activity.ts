"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Admin: what DIY plan buyers do with their plans (plan_buyer_activity).
// Platform Analytics → Plans → "Buyer activity". Admins only, checked from
// the signed-in session.
// ═══════════════════════════════════════════════════════════════════════════

import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getPlanById } from "@/lib/plans-config";
import { LADDER_JIG_NAME, LADDER_JIG_PLAN_ID } from "@/lib/ladder-jig";
import { TOTE_PLAN_ID, parseTotePlanDesign, totePlanName } from "@/lib/tote-plans";
import {
  buyerTimeline,
  summarizeBuyerActivity,
  type ActivityRow,
  type BuyerActivityReport,
  type BuyerPurchaseRow,
  type TimelineEntry,
} from "@/lib/plan-activity-analytics";

const ACTIVITY_COLUMNS = "access_token, email, plan_id, event, detail, value, total, device_hash, created_at";

async function isAdmin(): Promise<boolean> {
  const user = await getAuthenticatedUser();
  if (!user) return false;
  const { data } = await getServiceClient().from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  return data?.is_admin === true;
}

export async function getPlanBuyerActivity(
  days: number = 30
): Promise<{ success: true; data: BuyerActivityReport } | { success: false; error: string }> {
  try {
    if (!(await isAdmin())) return { success: false, error: "Not authorized." };
    const span = Math.max(1, Math.min(365, Math.round(days)));
    const since = new Date(Date.now() - span * 24 * 60 * 60 * 1000).toISOString();
    const db = getServiceClient();
    const [activityRes, purchasesRes] = await Promise.all([
      db.from("plan_buyer_activity").select(ACTIVITY_COLUMNS).gte("created_at", since).order("created_at", { ascending: false }).limit(20000),
      // Real purchases only: plans built free under All-Access aren't buyers.
      db
        .from("public_plan_purchases")
        .select("email, plan_id, purchased_at, stripe_session_id")
        .gte("purchased_at", since)
        .is("included_from", null)
        .limit(5000),
    ]);
    if (activityRes.error) console.error("[PlanBuyerActivity] activity fetch failed:", activityRes.error);
    if (purchasesRes.error) console.error("[PlanBuyerActivity] purchases fetch failed:", purchasesRes.error);
    return {
      success: true,
      data: summarizeBuyerActivity(
        (activityRes.data ?? []) as ActivityRow[],
        (purchasesRes.data ?? []) as BuyerPurchaseRow[]
      ),
    };
  } catch (err) {
    console.error("[PlanBuyerActivity]", err);
    return { success: false, error: "Couldn't load buyer activity." };
  }
}

export async function getPlanBuyerTimeline(
  rawEmail: string
): Promise<{ success: true; data: TimelineEntry[] } | { success: false; error: string }> {
  try {
    if (!(await isAdmin())) return { success: false, error: "Not authorized." };
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    if (!email) return { success: false, error: "No buyer." };
    const db = getServiceClient();
    const [{ data: rows }, { data: plans }] = await Promise.all([
      db.from("plan_buyer_activity").select(ACTIVITY_COLUMNS).eq("email", email).order("created_at", { ascending: false }).limit(300),
      db.from("public_plan_purchases").select("access_token, plan_id, build_config").eq("email", email),
    ]);
    const names = new Map<string, string>();
    for (const p of (plans ?? []) as { access_token: string; plan_id: string; build_config: unknown }[]) {
      if (p.plan_id === TOTE_PLAN_ID) {
        const design = parseTotePlanDesign(p.build_config);
        names.set(p.access_token, design ? totePlanName(design) : "Tote plan");
      } else if (p.plan_id === LADDER_JIG_PLAN_ID) names.set(p.access_token, LADDER_JIG_NAME);
      else names.set(p.access_token, getPlanById(p.plan_id)?.name ?? p.plan_id);
    }
    return {
      success: true,
      data: buyerTimeline((rows ?? []) as ActivityRow[], (r) => names.get(r.access_token) ?? "Plan (link replaced)"),
    };
  } catch (err) {
    console.error("[PlanBuyerTimeline]", err);
    return { success: false, error: "Couldn't load this buyer's activity." };
  }
}
