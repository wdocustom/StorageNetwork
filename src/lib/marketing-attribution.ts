import type { SupabaseClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════
// Marketing attribution — server-side only.
//
// A platform-sent campaign email carries `?mc=<marketing_email_sends.id>` on
// its links. When the customer books, submitNetworkLead resolves that token
// here. Only a token that (1) exists, (2) was issued for THIS installer, and
// (3) is inside the campaign's attribution window earns the
// "platform_campaign" source (15% network fee). The client never gets to
// assert the source itself.
// ═══════════════════════════════════════════════════════════════════════════

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MarketingAttribution {
  sendId: string;
}

export function isWithinAttributionWindow(
  sentAtIso: string,
  attributionDays: number,
  now: Date = new Date()
): boolean {
  const sentAt = new Date(sentAtIso).getTime();
  if (Number.isNaN(sentAt)) return false;
  return now.getTime() - sentAt <= attributionDays * 24 * 60 * 60 * 1000;
}

export async function resolveMarketingAttribution(
  db: SupabaseClient,
  token: string | undefined | null,
  installerId: string | undefined | null
): Promise<MarketingAttribution | null> {
  if (!token || !installerId || !UUID_RE.test(token)) return null;

  const { data: send } = await db
    .from("marketing_email_sends")
    .select("id, installer_id, sent_at, marketing_campaigns(attribution_days)")
    .eq("id", token)
    .maybeSingle();
  if (!send) return null;
  if (send.installer_id !== installerId) return null;

  const campaign = Array.isArray(send.marketing_campaigns)
    ? send.marketing_campaigns[0]
    : send.marketing_campaigns;
  const days = (campaign as { attribution_days?: number } | null)?.attribution_days ?? 60;
  if (!isWithinAttributionWindow(send.sent_at as string, days)) return null;

  return { sendId: send.id as string };
}

/** Record the first booking that came from a send. Best-effort. */
export async function markSendConverted(
  db: SupabaseClient,
  sendId: string,
  leadId: string
): Promise<void> {
  await db
    .from("marketing_email_sends")
    .update({ converted_lead_id: leadId, converted_at: new Date().toISOString() })
    .eq("id", sendId)
    .is("converted_lead_id", null);
}
