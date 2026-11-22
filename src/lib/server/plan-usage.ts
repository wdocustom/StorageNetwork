import "server-only";

import { getServiceClient } from "@/lib/supabase-server";
import { planUsage, type PlanUsage } from "@/lib/plan-reviews";

// Has each buyer opened their plans? Reads all three records for a batch of
// buyers (see planUsage in @/lib/plan-reviews). Throws if a lookup fails, so
// callers never mistake a failed query for "never opened".

export async function plansOpenedBy(buyers: { email: string; purchasedAt: string }[]): Promise<Map<string, PlanUsage>> {
  const out = new Map<string, PlanUsage>();
  if (!buyers.length) return out;
  const db = getServiceClient();
  const emails = [...new Set(buyers.map((b) => b.email.toLowerCase()))];

  const [activityRes, devicesRes] = await Promise.all([
    db.from("plan_buyer_activity").select("email, event, detail, created_at").in("email", emails).limit(50000),
    db.from("plan_buyer_devices").select("email, verified_by, created_at, last_seen_at, ip").in("email", emails).limit(10000),
  ]);
  if (activityRes.error) throw new Error(`activity lookup failed: ${activityRes.error.message}`);
  if (devicesRes.error) throw new Error(`device lookup failed: ${devicesRes.error.message}`);
  const devices = (devicesRes.data ?? []) as { email: string; verified_by: string; created_at: string; last_seen_at: string | null; ip: string | null }[];

  // Page views of the plans page from the buyers' connections
  const ips = [...new Set(devices.map((d) => d.ip).filter((ip): ip is string => !!ip))];
  const earliest = buyers.reduce((m, b) => (b.purchasedAt < m ? b.purchasedAt : m), buyers[0].purchasedAt);
  let views: { ip: string; page_path: string; created_at: string }[] = [];
  if (ips.length) {
    const viewsRes = await db
      .from("platform_page_views")
      .select("ip, page_path, created_at")
      .in("ip", ips)
      .or("page_path.like./plans/build%,page_path.like./plans/library%")
      .gte("created_at", earliest)
      .limit(20000);
    if (viewsRes.error) throw new Error(`page view lookup failed: ${viewsRes.error.message}`);
    views = (viewsRes.data ?? []) as typeof views;
  }

  for (const b of buyers) {
    const email = b.email.toLowerCase();
    const mine = devices.filter((d) => d.email.toLowerCase() === email);
    const myIps = new Set(mine.map((d) => d.ip).filter(Boolean));
    out.set(
      email,
      planUsage({
        purchasedAt: b.purchasedAt,
        activity: (activityRes.data ?? []).filter((a) => String(a.email).toLowerCase() === email) as {
          event: string;
          detail: string | null;
          created_at: string;
        }[],
        devices: mine,
        pageViews: views.filter((v) => myIps.has(v.ip)),
      }),
    );
  }
  return out;
}
