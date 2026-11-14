"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { MAX_DEVICES } from "@/lib/server/plan-device";
import {
  excludeStaffTraffic,
  summarizeDesignerEvents,
  summarizeDeviceSharing,
  summarizePlansAnalytics,
  type PlanDeviceRow,
  type PlansAnalytics,
  type PlansCheckoutStartRow,
  type PlansEventRow,
  type PlansPurchaseRow,
  type PlansSplitRow,
  type PlansViewRow,
} from "@/lib/plans-analytics";
import { detectInAppBrowser } from "@/lib/in-app-browser";

// ═══════════════════════════════════════════════════════════════════════════
// DIY Plans analytics — admin-only data for the Platform Analytics "Plans" tab.
// Human page views under /plans, retail plan purchases (tote plans, chair,
// ladder jig) and installer split payouts for the period; aggregation lives
// in src/lib/plans-analytics.ts.
// ═══════════════════════════════════════════════════════════════════════════

const PAGE_SIZE = 1000;

type ViewWithMeta = PlansViewRow & { ip: string | null; user_agent: string | null };

async function fetchPlansViews(since: string): Promise<ViewWithMeta[]> {
  const supabase = getServiceClient();
  const rows: ViewWithMeta[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("platform_page_views")
      .select("page_path, visitor_id, session_id, referrer, created_at, ip, user_agent")
      .like("page_path", "/plans%")
      .eq("is_bot", false)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.error("[PlansAnalytics] page views fetch failed at offset", offset, error);
      break;
    }
    rows.push(...((data ?? []) as ViewWithMeta[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

/** Visitors and IPs that used the dashboard: the owner, installers, staff. */
async function fetchStaffMarkers(since: string): Promise<{ visitors: Set<string>; ips: Set<string> }> {
  const supabase = getServiceClient();
  const visitors = new Set<string>();
  const ips = new Set<string>();
  for (let offset = 0; offset < 50 * PAGE_SIZE; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("platform_page_views")
      .select("visitor_id, ip")
      .like("page_path", "/dashboard%")
      .gte("created_at", since)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.error("[PlansAnalytics] staff markers fetch failed", error);
      break;
    }
    for (const r of data ?? []) {
      if (r.visitor_id) visitors.add(r.visitor_id as string);
      if (r.ip) ips.add(r.ip as string);
    }
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { visitors, ips };
}

async function fetchPlanEvents(since: string): Promise<PlansEventRow[]> {
  const { data, error } = await getServiceClient()
    .from("plan_events")
    .select("event, visitor_id, session_id")
    .gte("created_at", since)
    .limit(20000);
  if (error) console.error("[PlansAnalytics] events fetch failed", error);
  return (data ?? []) as PlansEventRow[];
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
    const purchaseCols = "plan_id, tier, email, purchased_at, upgraded_at, stripe_session_id";

    // Staff markers look back further than the period: the owner's phone may
    // not have opened the dashboard this week.
    const staffSince = new Date(Date.now() - (days + 60) * 24 * 60 * 60 * 1000).toISOString();
    const [allViews, staff, eventsAll, purchasesRes, upgradesRes, splitsRes, devicesRes, codesRes, startsRes] = await Promise.all([
      fetchPlansViews(since),
      fetchStaffMarkers(staffSince),
      fetchPlanEvents(since),
      // Plans built free under All-Access (included_from set) aren't sales.
      supabase.from("public_plan_purchases").select(purchaseCols).gte("purchased_at", since).is("included_from", null),
      supabase.from("public_plan_purchases").select(purchaseCols).gte("upgraded_at", since),
      supabase
        .from("plan_split_payouts")
        .select("amount_cents, status, reason, created_at, recipient:profiles!plan_split_payouts_recipient_id_fkey(business_name, first_name, last_name)")
        .gte("created_at", since),
      supabase.from("plan_buyer_devices").select("email, verified_by, revoked_at, last_seen_at").limit(5000),
      supabase.from("plan_access_codes").select("email").gte("created_at", since).limit(5000),
      supabase
        .from("plan_checkout_starts")
        .select("stripe_session_id, plan_id, tier, amount_cents, visitor_id, created_at")
        .gte("created_at", since)
        .limit(10000),
    ]);
    if (startsRes.error) console.error("[PlansAnalytics] checkout starts fetch failed", startsRes.error);
    if (purchasesRes.error) console.error("[PlansAnalytics] purchases fetch failed", purchasesRes.error);
    if (splitsRes.error) console.error("[PlansAnalytics] splits fetch failed", splitsRes.error);

    // Leave the owner, installers and test browsers out of every number.
    const { views: customerViews, excluded } = excludeStaffTraffic(allViews, staff.visitors, staff.ips);
    const views: PlansViewRow[] = customerViews.map(({ ip: _ip, user_agent: _ua, ...v }) => v);
    // A buy click counts only from someone with a real (non-bot, non-staff)
    // page view: automated test browsers click buy without being people.
    const humans = new Set(customerViews.map((v) => v.visitor_id).filter(Boolean) as string[]);
    const starts = ((startsRes.data ?? []) as PlansCheckoutStartRow[]).filter(
      (s) => !s.visitor_id || humans.has(s.visitor_id),
    );
    const events = eventsAll.filter((e) => !e.visitor_id || (!excluded.has(e.visitor_id) && !staff.visitors.has(e.visitor_id)));
    const designerInApp = new Set(
      customerViews
        .filter((v) => v.page_path === "/plans/checkout" && detectInAppBrowser(v.user_agent))
        .map((v) => v.visitor_id ?? v.session_id),
    ).size;

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

    const sharing = summarizeDeviceSharing(
      (devicesRes.data ?? []) as PlanDeviceRow[],
      (codesRes.data ?? []).map((r) => r.email as string),
      MAX_DEVICES,
    );

    // "Email me my design" leads, and whether that email has bought since
    const { data: leadRows } = await supabase
      .from("plan_design_leads")
      .select("email, design, design_name, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100);
    const leadEmails = [...new Set((leadRows ?? []).map((l) => (l.email as string).toLowerCase()))];
    const buyers = new Set<string>();
    if (leadEmails.length) {
      const { data: bought } = await supabase
        .from("public_plan_purchases")
        .select("email")
        .eq("plan_id", "tote-organizer")
        .in("email", leadEmails);
      for (const b of bought ?? []) buyers.add((b.email as string).toLowerCase());
    }
    const designLeads = (leadRows ?? []).map((l) => ({
      email: l.email as string,
      design: (l.design_name as string | null) ?? (l.design as string),
      createdAt: l.created_at as string,
      bought: buyers.has((l.email as string).toLowerCase()),
    }));

    return {
      success: true,
      data: {
        designLeads,
        ...summarizePlansAnalytics(views, purchases, upgrades, splits, toteOwners, starts),
        sharing,
        excludedVisitors: excluded.size,
        designer: summarizeDesignerEvents(events),
        designerInApp,
      },
    };
  } catch (err) {
    console.error("[PlansAnalytics] failed:", err);
    return { success: false, error: "Failed to load plans analytics." };
  }
}
