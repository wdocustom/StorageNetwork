import "server-only";

import { getServiceClient } from "@/lib/supabase-server";
import { describeQuote } from "@/lib/quote-describe";

// ═══════════════════════════════════════════════════════════════════════════
// Marketing tab — one parallel load:
//   open quotes to close (unpaid, last 30 days, hottest first)
//   recent finished jobs to post about (real facts only)
//   when each quote was last followed up from here
// ═══════════════════════════════════════════════════════════════════════════

const DAY = 24 * 60 * 60 * 1000;
const QUOTE_WINDOW_DAYS = 30;

export interface MarketingProfile {
  id: string;
  slug: string | null;
  is_pro: boolean;
  is_admin: boolean | null;
  city: string | null;
  state: string | null;
  service_zip: string | null;
  business_name: string | null;
  first_name: string | null;
}

export type QuoteHeat = "payment" | "review" | "opened" | "sent";

export interface OpenQuote {
  id: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  total: number;
  built: string;
  heat: QuoteHeat;
  views: number;
  sentAt: string;
  lastFollowUpAt: string | null;
}

export interface RecentJob {
  id: string;
  label: string; // "4×4 Tote Rack · Omaha · 2 weeks ago" — no customer names
}

const HEAT_ORDER: Record<QuoteHeat, number> = { payment: 0, review: 1, opened: 2, sent: 3 };

export function heatOf(q: { viewed_at: string | null; last_step_reached: string | null }): QuoteHeat {
  if (q.last_step_reached === "payment") return "payment";
  if (q.last_step_reached === "review" || q.last_step_reached === "address") return "review";
  return q.viewed_at ? "opened" : "sent";
}

export function ago(iso: string, now = Date.now()): string {
  const days = Math.floor((now - new Date(iso).getTime()) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

export async function loadMarketing(userId: string) {
  const db = getServiceClient();
  const since = new Date(Date.now() - QUOTE_WINDOW_DAYS * DAY).toISOString();

  const [profileRes, quotesRes, jobsRes, followRes] = await Promise.all([
    db
      .from("profiles")
      .select("id, slug, is_pro, is_admin, city, state, service_zip, business_name, first_name")
      .eq("id", userId)
      .single(),
    db
      .from("leads")
      .select("id, customer_name, customer_phone, customer_email, estimated_price, viewed_at, view_count, last_step_reached, created_at, quote_data")
      .eq("installer_id", userId)
      .eq("deposit_paid", false)
      .eq("status", "pending_payment")
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
    db
      .from("leads")
      .select("id, address_city, quote_data, scheduled_at, updated_at")
      .eq("installer_id", userId)
      .eq("payout_status", "paid")
      .order("updated_at", { ascending: false })
      .limit(6),
    db
      .from("installer_activity_log")
      .select("detail, created_at")
      .eq("installer_id", userId)
      .eq("action", "quote_followup")
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
  ]);

  const lastFollowUp = new Map<string, string>();
  for (const row of followRes.data ?? []) {
    const leadId = (row.detail as { lead_id?: string } | null)?.lead_id;
    if (leadId && !lastFollowUp.has(leadId)) lastFollowUp.set(leadId, row.created_at as string);
  }

  const quotes: OpenQuote[] = (quotesRes.data ?? [])
    .map((q) => ({
      id: q.id as string,
      customerName: (q.customer_name as string) || "Customer",
      phone: (q.customer_phone as string | null) || null,
      email: (q.customer_email as string | null) || null,
      total: Number(q.estimated_price) || 0,
      built: describeQuote(q.quote_data),
      heat: heatOf(q as { viewed_at: string | null; last_step_reached: string | null }),
      views: (q.view_count as number) || 0,
      sentAt: q.created_at as string,
      lastFollowUpAt: lastFollowUp.get(q.id as string) ?? null,
    }))
    .sort((a, b) => HEAT_ORDER[a.heat] - HEAT_ORDER[b.heat] || b.sentAt.localeCompare(a.sentAt));

  const jobs: RecentJob[] = (jobsRes.data ?? [])
    .map((j) => {
      const built = describeQuote(j.quote_data, 2);
      if (!built) return null;
      const when = (j.scheduled_at as string | null) || (j.updated_at as string);
      return {
        id: j.id as string,
        label: [built, j.address_city as string | null, when ? ago(when) : null].filter(Boolean).join(" · "),
      };
    })
    .filter((j): j is RecentJob => !!j);

  return { profile: profileRes.data as MarketingProfile | null, quotes, jobs };
}

/** Facts about one of the installer's own finished jobs, for a post. Null if it isn't theirs. */
export async function realJobFacts(userId: string, leadId: string): Promise<string | null> {
  const { data } = await getServiceClient()
    .from("leads")
    .select("address_city, address_state, quote_data, scheduled_at, updated_at")
    .eq("id", leadId)
    .eq("installer_id", userId)
    .eq("payout_status", "paid")
    .maybeSingle();
  if (!data) return null;
  const built = describeQuote(data.quote_data, 4);
  const when = (data.scheduled_at as string | null) || (data.updated_at as string);
  return [
    built && `What I built: ${built}`,
    data.address_city && `Where: ${data.address_city}${data.address_state ? `, ${data.address_state}` : ""}`,
    when && `When: ${ago(when)}`,
  ]
    .filter(Boolean)
    .join("\n");
}
