import { getServiceClient } from "@/lib/supabase-server";
import { parseTotePlanDesign } from "@/lib/tote-plans";
import { sendSidewaysBrandNotice, type SidewaysNoticePlan } from "@/lib/emails/sidewaysBrandTemplates";

// ═══════════════════════════════════════════════════════════════════════════
// One-time "sideways tote brand" notice (migration 169, PR #301).
//
// Before PR #301 the DIY designer only offered "27 gallon" (= HDX), so every
// sideways plan made before it was cut for HDX-size totes. Owners of
// Greenmade-size totes need the 32" bays now available. This finds those
// plans, groups them by email, and sends each person ONE email with a button
// per sideways plan. Each plan is stamped (sideways_notice_sent_at) before
// its email goes out, and un-stamped if the send fails, so a person is never
// emailed twice and a failed send is retried on the next run.
// ═══════════════════════════════════════════════════════════════════════════

/** Plans made from this moment on had the brand choice; they don't get the notice. */
export const SIDEWAYS_NOTICE_CUTOFF = "2026-11-26T17:00:00Z";
/** Safety cap per run. The affected set was 8 people when this shipped. */
const MAX_EMAILS_PER_RUN = 25;

export interface NoticeRow {
  id: string;
  email: string;
  customer_name: string | null;
  access_token: string;
  build_config: unknown;
}

export interface NoticeRecipient {
  email: string;
  firstName: string | null;
  rowIds: string[];
  plans: SidewaysNoticePlan[];
}

/** True when a plan has a sideways 27-gal unit cut for HDX-size totes. */
export function needsSidewaysNotice(buildConfig: unknown): boolean {
  const design = parseTotePlanDesign(buildConfig);
  return !!design?.units.some((u) => u.sideways && u.toteType === "HDX");
}

/** One recipient per email address, with every one of their affected plans. */
export function groupNoticeRecipients(rows: NoticeRow[]): NoticeRecipient[] {
  const byEmail = new Map<string, NoticeRecipient>();
  for (const r of rows) {
    if (!r.email || !r.access_token || !needsSidewaysNotice(r.build_config)) continue;
    const email = r.email.trim().toLowerCase();
    const rec = byEmail.get(email) ?? { email, firstName: null, rowIds: [], plans: [] };
    rec.firstName ??= r.customer_name?.trim().split(/\s+/)[0] || null;
    rec.rowIds.push(r.id);
    rec.plans.push({ accessToken: r.access_token, buildConfig: r.build_config });
    byEmail.set(email, rec);
  }
  return [...byEmail.values()];
}

export async function sendSidewaysBrandNotices(): Promise<{ recipients: number; sent: number; failed: string[] }> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("public_plan_purchases")
    .select("id, email, customer_name, access_token, build_config")
    .is("sideways_notice_sent_at", null)
    .lt("purchased_at", SIDEWAYS_NOTICE_CUTOFF)
    .not("build_config", "is", null)
    .limit(1000);
  if (error) throw new Error(error.message);

  const recipients = groupNoticeRecipients((data ?? []) as NoticeRow[]).slice(0, MAX_EMAILS_PER_RUN);
  let sent = 0;
  const failed: string[] = [];

  for (const rec of recipients) {
    // Claim this person's plans first, so an overlapping run can't email them too.
    const { data: claimed } = await db
      .from("public_plan_purchases")
      .update({ sideways_notice_sent_at: new Date().toISOString() })
      .in("id", rec.rowIds)
      .is("sideways_notice_sent_at", null)
      .select("id");
    const claimedIds = new Set((claimed ?? []).map((c) => c.id as string));
    if (claimedIds.size === 0) continue;
    const plans = rec.plans.filter((_, i) => claimedIds.has(rec.rowIds[i]));

    const res = await sendSidewaysBrandNotice(rec.email, { firstName: rec.firstName, plans });
    if (res.success) {
      sent++;
    } else {
      failed.push(rec.email);
      await db.from("public_plan_purchases").update({ sideways_notice_sent_at: null }).in("id", [...claimedIds]);
    }
  }
  console.log(`[SidewaysNotice] ${sent}/${recipients.length} sent${failed.length ? `, failed: ${failed.length}` : ""}`);
  return { recipients: recipients.length, sent, failed };
}
