"use server";

import { getServiceClient } from "@/lib/supabase-server";
import {
  summarizePlansAnalytics,
  type PlansAnalytics,
  type PlansPurchaseRow,
  type PlansSplitRow,
  type PlansViewRow,
} from "@/lib/plans-analytics";

// ═══════════════════════════════════════════════════════════════════════════
// DIY Plans analytics — admin-only data for the Platform Analytics "Plans" tab.
// Human page views under /plans, retail plan purchases (tote plans, chair,
// ladder jig) and installer split payouts for the period; aggregation lives
// in src/lib/plans-analytics.ts.
// ═══════════════════════════════════════════════════════════════════════════

const PAGE_SIZE = 1000;

async function fetchPlansViews(since: string): Promise<PlansViewRow[]> {
  const supabase = getServiceClient();
  const rows: PlansViewRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("platform_page_views")
      .select("page_path, visitor_id, session_id, referrer, created_at")
      .like("page_path", "/plans%")
      .eq("is_bot", false)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.error("[PlansAnalytics] page views fetch failed at offset", offset, error);
      break;
    }
    rows.push(...((data ?? []) as PlansViewRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function getAdminPlansAnalytics(
  userId: string,
  days: number = 30,
): Promise<{ success: boolean; data?: PlansAnalytics; error?: string }> {
  try {
    const supabase = getServiceClient();
    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", userId).single();
    if (!profile?.is_admin) return { success: false, error: "Not authorized." };

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const purchaseCols = "plan_id, tier, email, purchased_at, upgraded_at";

    const [views, purchasesRes, upgradesRes, splitsRes] = await Promise.all([
      fetchPlansViews(since),
      supabase.from("public_plan_purchases").select(purchaseCols).gte("purchased_at", since),
      supabase.from("public_plan_purchases").select(purchaseCols).gte("upgraded_at", since),
      supabase
        .from("plan_split_payouts")
        .select("amount_cents, status, reason, created_at, recipient:profiles!plan_split_payouts_recipient_id_fkey(business_name, first_name, last_name)")
        .gte("created_at", since),
    ]);
    if (purchasesRes.error) console.error("[PlansAnalytics] purchases fetch failed", purchasesRes.error);
    if (splitsRes.error) console.error("[PlansAnalytics] splits fetch failed", splitsRes.error);

    const purchases = (purchasesRes.data ?? []) as PlansPurchaseRow[];
    const upgrades = (upgradesRes.data ?? []) as PlansPurchaseRow[];

    // Ladder jig buyers who own a tote plan paid the owner price
    const jigEmails = [...new Set(purchases.filter((p) => p.plan_id === "ladder-jig").map((p) => p.email))];
    let toteOwners = new Set<string>();
    if (jigEmails.length > 0) {
      const { data } = await supabase
        .from("public_plan_purchases")
        .select("email")
        .eq("plan_id", "tote-organizer")
        .in("email", jigEmails);
      toteOwners = new Set((data ?? []).map((r) => (r.email as string).toLowerCase()));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const splits: PlansSplitRow[] = (splitsRes.data ?? []).map((s: any) => {
      const r = Array.isArray(s.recipient) ? s.recipient[0] : s.recipient;
      return {
        amount_cents: s.amount_cents,
        status: s.status,
        reason: s.reason,
        created_at: s.created_at,
        recipient_name: r?.business_name || [r?.first_name, r?.last_name].filter(Boolean).join(" ") || "Installer",
      };
    });

    return { success: true, data: summarizePlansAnalytics(views, purchases, upgrades, splits, toteOwners) };
  } catch (err) {
    console.error("[PlansAnalytics] failed:", err);
    return { success: false, error: "Failed to load plans analytics." };
  }
}
