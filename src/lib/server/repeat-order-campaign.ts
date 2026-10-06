import { getServiceClient } from "@/lib/supabase-server";
import { isDisposableEmail } from "@/lib/disposable-emails";
import { sendRepeatOrderEmail } from "@/lib/emails/marketingTemplates";

// ═══════════════════════════════════════════════════════════════════════════
// Repeat-order campaign — one-time marketing email to past paying customers,
// pointing them back at the installer who served them.
//
// Intentionally NOT a "use server" file: these functions must not be
// reachable as public server actions. Called only from the CRON_SECRET-gated
// /api/cron/repeat-order-campaign route.
//
// Billing: the booking link carries a per-recipient token, so the resulting
// lead is stored as source="platform_campaign" and billed at the 15% network
// rate (see src/lib/lead-source.ts). Opt-outs live in
// customer_marketing_optouts and are consulted ONLY here.
// ═══════════════════════════════════════════════════════════════════════════

export const REPEAT_ORDER_CAMPAIGN_KEY = "repeat-order-2026-10";
const CAMPAIGN_NAME = "Repeat order — past customers";
const ATTRIBUTION_DAYS = 60;
const SEND_DELAY_MS = 600; // stay under Resend's per-second rate limit
const PAGE = 1000;

export interface CandidateLead {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  installer_id: string | null;
  created_at: string;
}

export interface InstallerInfo {
  id: string;
  name: string;
  is_pro: boolean;
  is_suspended: boolean;
}

export interface Recipient {
  email: string;
  customerName: string | null;
  installerId: string;
  installerName: string;
  sourceLeadId: string;
}

/**
 * Pure: turn paid leads into one recipient per customer email.
 * - one email per customer (case-insensitive), pointed at the installer of
 *   their MOST RECENT paid order
 * - skips opted-out and already-sent addresses
 * - skips installers who can't take a new order (not Pro, or suspended)
 */
export function selectRecipients(
  leads: CandidateLead[],
  installers: Map<string, InstallerInfo>,
  optedOut: Set<string>,
  alreadySent: Set<string>
): Recipient[] {
  const newestFirst = [...leads].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const seen = new Set<string>();
  const out: Recipient[] = [];

  for (const lead of newestFirst) {
    const email = lead.customer_email?.trim().toLowerCase();
    if (!email || !lead.installer_id) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email); // newest order decides; an older one never overrides it

    if (optedOut.has(email) || alreadySent.has(email)) continue;
    if (isDisposableEmail(email)) continue;

    const installer = installers.get(lead.installer_id);
    if (!installer || !installer.is_pro || installer.is_suspended) continue;

    out.push({
      email,
      customerName: lead.customer_name,
      installerId: installer.id,
      installerName: installer.name,
      sourceLeadId: lead.id,
    });
  }
  return out;
}

async function loadAudience(campaignId: string | null): Promise<Recipient[]> {
  const db = getServiceClient();

  // Paid orders only: deposit collected, or marked paid/completed. Never
  // cancelled, expired or waitlisted (waitlisted hides customer details).
  const leads: CandidateLead[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("leads")
      .select("id, customer_name, customer_email, installer_id, created_at")
      .or("deposit_paid.eq.true,status.eq.paid,status.eq.completed")
      .not("status", "in", "(cancelled,archived,expired,waitlisted)")
      .not("customer_email", "is", null)
      .not("installer_id", "is", null)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Lead query failed: ${error.message}`);
    leads.push(...((data ?? []) as CandidateLead[]));
    if (!data || data.length < PAGE) break;
  }

  const installerIds = Array.from(new Set(leads.map((l) => l.installer_id!)));
  const installers = new Map<string, InstallerInfo>();
  for (let i = 0; i < installerIds.length; i += 200) {
    const { data } = await db
      .from("profiles")
      .select("id, business_name, first_name, is_pro, is_suspended")
      .in("id", installerIds.slice(i, i + 200));
    for (const p of data ?? []) {
      installers.set(p.id as string, {
        id: p.id as string,
        name: (p.business_name as string) || (p.first_name as string) || "your installer",
        is_pro: p.is_pro === true,
        is_suspended: p.is_suspended === true,
      });
    }
  }

  const optedOut = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data } = await db
      .from("customer_marketing_optouts")
      .select("email")
      .range(from, from + PAGE - 1);
    for (const r of data ?? []) optedOut.add((r.email as string).toLowerCase());
    if (!data || data.length < PAGE) break;
  }

  const alreadySent = new Set<string>();
  if (campaignId) {
    for (let from = 0; ; from += PAGE) {
      const { data } = await db
        .from("marketing_email_sends")
        .select("email")
        .eq("campaign_id", campaignId)
        .range(from, from + PAGE - 1);
      for (const r of data ?? []) alreadySent.add((r.email as string).toLowerCase());
      if (!data || data.length < PAGE) break;
    }
  }

  return selectRecipients(leads, installers, optedOut, alreadySent);
}

async function getOrCreateCampaignId(): Promise<string> {
  const db = getServiceClient();
  const { data: existing } = await db
    .from("marketing_campaigns")
    .select("id")
    .eq("key", REPEAT_ORDER_CAMPAIGN_KEY)
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await db
    .from("marketing_campaigns")
    .insert({ key: REPEAT_ORDER_CAMPAIGN_KEY, name: CAMPAIGN_NAME, attribution_days: ATTRIBUTION_DAYS })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Campaign create failed: ${error?.message}`);
  return data.id as string;
}

export interface CampaignRunResult {
  mode: "dry-run" | "test" | "send";
  eligible: number; // remaining unsent recipients before this run
  attempted: number;
  sent: number;
  skipped: number;
  errors: string[];
  sample?: { email: string; installer: string }[];
}

export async function runRepeatOrderCampaign(opts: {
  send: boolean;
  limit: number;
  testTo?: string;
}): Promise<CampaignRunResult> {
  const result: CampaignRunResult = {
    mode: opts.testTo ? "test" : opts.send ? "send" : "dry-run",
    eligible: 0,
    attempted: 0,
    sent: 0,
    skipped: 0,
    errors: [],
  };

  const db = getServiceClient();
  const campaignId = opts.send && !opts.testTo ? await getOrCreateCampaignId() : null;
  // Dry runs/tests still need to exclude prior sends if the campaign exists.
  let lookupId = campaignId;
  if (!lookupId) {
    const { data } = await db
      .from("marketing_campaigns")
      .select("id")
      .eq("key", REPEAT_ORDER_CAMPAIGN_KEY)
      .maybeSingle();
    lookupId = (data?.id as string | undefined) ?? null;
  }

  const audience = await loadAudience(lookupId);
  result.eligible = audience.length;
  result.sample = audience.slice(0, 5).map((r) => ({
    email: r.email.replace(/^(.).*(@.*)$/, "$1***$2"),
    installer: r.installerName,
  }));

  // Test: one sample email to the given address. No send row is written, and
  // the all-zero token never attributes, so it can't affect real data.
  if (opts.testTo) {
    const sample = audience[0];
    result.attempted = 1;
    const res = await sendRepeatOrderEmail(
      opts.testTo,
      {
        customerName: sample?.customerName ?? "Alex",
        installerName: sample?.installerName ?? "Your Installer",
        installerId: sample?.installerId ?? "00000000-0000-4000-8000-000000000000",
        sendId: "00000000-0000-4000-8000-000000000000",
      },
      { subjectPrefix: "[TEST] " }
    );
    if (res.success) result.sent = 1;
    else result.errors.push(res.error || "send failed");
    return result;
  }

  if (!opts.send || !campaignId) return result;

  for (const r of audience.slice(0, opts.limit)) {
    result.attempted++;

    // Claim the recipient first. UNIQUE(campaign_id, email) makes concurrent
    // or repeated runs safe — a second run can't double-send.
    const { data: row, error: claimErr } = await db
      .from("marketing_email_sends")
      .insert({
        campaign_id: campaignId,
        email: r.email,
        installer_id: r.installerId,
        source_lead_id: r.sourceLeadId,
      })
      .select("id")
      .single();
    if (claimErr || !row) {
      result.skipped++;
      continue;
    }

    const res = await sendRepeatOrderEmail(r.email, {
      customerName: r.customerName,
      installerName: r.installerName,
      installerId: r.installerId,
      sendId: row.id as string,
    });

    if (res.success) {
      result.sent++;
      await db.from("marketing_email_sends").update({ message_id: res.messageId ?? null }).eq("id", row.id);
    } else {
      // Release the claim so a later run can retry this recipient.
      await db.from("marketing_email_sends").delete().eq("id", row.id);
      result.errors.push(`${r.email.replace(/^(.).*(@.*)$/, "$1***$2")}: ${res.error}`);
    }
    await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
  }
  return result;
}

/** Opt an email out of promotional email. Idempotent. Returns the email. */
export async function optOutBySendId(
  sendId: string
): Promise<{ success: boolean; email?: string; error?: string }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sendId)) {
    return { success: false, error: "This unsubscribe link is invalid." };
  }
  const db = getServiceClient();
  const { data: send } = await db
    .from("marketing_email_sends")
    .select("id, email")
    .eq("id", sendId)
    .maybeSingle();
  if (!send) return { success: false, error: "This unsubscribe link is invalid or expired." };

  const email = (send.email as string).toLowerCase();
  const { error } = await db
    .from("customer_marketing_optouts")
    .upsert({ email, source_send_id: send.id }, { onConflict: "email", ignoreDuplicates: true });
  if (error) return { success: false, error: "Could not process your request. Please try again." };
  return { success: true, email };
}
