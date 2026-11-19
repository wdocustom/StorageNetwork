import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppUrl } from "@/lib/url-helper";
import { sendDesignComebackEmail, type DesignComebackEmail } from "@/lib/emails/designComebackTemplates";
import {
  TOTE_PLAN_ID,
  comebackOfferFor,
  isMiniDesign,
  decodeTotePlanDesign,
  totePlanDesignHref,
  totePlanOfferPrice,
} from "@/lib/tote-plans";

// ═══════════════════════════════════════════════════════════════════════════
// Come-back email to design leads: people who used "email me my design"
// (plan_design_leads) and haven't bought tote plans. One email per person,
// ever (plan_buyer_campaigns), 48 hours after they saved it (everyone who
// saved one before launch gets it on the first run, all at once):
//   • their newest saved design
//   • the price they saved it at ($14 if they ever saved at $5 off, else $16)
//   • the Ladder Building Jig plans free (offer save5jig / save3jig)
// Run daily by /api/cron/design-lead-comeback; safe to re-run.
// ═══════════════════════════════════════════════════════════════════════════

export const DESIGN_COMEBACK_CAMPAIGN = "design_lead_comeback";
/** Hours after saving the design before the come-back email can go out. */
export const DESIGN_COMEBACK_DELAY_HOURS = 48;
/** Leads saved before launch: emailed on the first run, without the wait. */
export const DESIGN_COMEBACK_LAUNCH = "2026-11-19T00:30:00Z";

export interface ComebackRecipient {
  email: string;
  offer: string;
  email_data: DesignComebackEmail;
}

interface LeadRow {
  email: string;
  design: string;
  design_name: string | null;
  offer: string | null;
  created_at: string;
}

/** Who gets the email now, and what it says. Nothing is sent. */
export async function comebackRecipients(db: SupabaseClient, now = Date.now()): Promise<ComebackRecipient[]> {
  const waited = new Date(now - DESIGN_COMEBACK_DELAY_HOURS * 3600_000).toISOString();
  const before = waited > DESIGN_COMEBACK_LAUNCH ? waited : DESIGN_COMEBACK_LAUNCH;
  const [leads, buyers, already] = await Promise.all([
    db.from("plan_design_leads").select("email, design, design_name, offer, created_at").lt("created_at", before).order("created_at", { ascending: false }).limit(5000),
    db.from("public_plan_purchases").select("email").eq("plan_id", TOTE_PLAN_ID).limit(20000),
    db.from("plan_buyer_campaigns").select("email").eq("campaign", DESIGN_COMEBACK_CAMPAIGN).limit(20000),
  ]);
  for (const r of [leads, buyers, already]) if (r.error) throw new Error(r.error.message);

  const skip = new Set<string>([...(buyers.data ?? []), ...(already.data ?? [])].map((r) => String(r.email).toLowerCase()));
  const byEmail = new Map<string, LeadRow[]>();
  for (const l of (leads.data ?? []) as LeadRow[]) {
    const email = String(l.email ?? "").trim().toLowerCase();
    if (!email || skip.has(email)) continue;
    byEmail.set(email, [...(byEmail.get(email) ?? []), l]);
  }

  const out: ComebackRecipient[] = [];
  for (const [email, rows] of byEmail) {
    // Newest design that still opens; the best price they were ever offered.
    const newest = rows.map((r) => ({ r, design: decodeTotePlanDesign(r.design, r.design_name) })).find((x) => x.design);
    // The come-back offers are All-Access prices: not for Mini Tote Rack designs.
    if (!newest?.design || isMiniDesign(newest.design)) continue;
    const best = rows.reduce<string | null>((b, r) => (totePlanOfferPrice(r.offer) < totePlanOfferPrice(b) ? r.offer : b), null);
    const offer = comebackOfferFor(best);
    out.push({
      email,
      offer,
      email_data: {
        design: newest.design,
        link: `${getAppUrl()}${totePlanDesignHref(newest.design, "design_comeback")}&offer=${offer}`,
        priceCents: totePlanOfferPrice(offer),
      },
    });
  }
  return out;
}

export interface ComebackResult {
  eligible: number;
  sent: number;
  errors: string[];
}

export async function processDesignLeadComeback(
  db: SupabaseClient,
  send: typeof sendDesignComebackEmail = sendDesignComebackEmail,
  now = Date.now(),
  pause = 600
): Promise<ComebackResult> {
  const recipients = await comebackRecipients(db, now);
  const result: ComebackResult = { eligible: recipients.length, sent: 0, errors: [] };
  for (const r of recipients) {
    // Claim first: a concurrent run can't email the same person twice.
    const { error: claimError } = await db.from("plan_buyer_campaigns").insert({ email: r.email, campaign: DESIGN_COMEBACK_CAMPAIGN });
    if (claimError) continue;
    const sent = await send(r.email, r.email_data).catch((err) => ({ success: false, error: err instanceof Error ? err.message : String(err) }));
    if (sent.success) result.sent++;
    else {
      // Release the claim so the next run retries.
      await db.from("plan_buyer_campaigns").delete().eq("email", r.email).eq("campaign", DESIGN_COMEBACK_CAMPAIGN);
      result.errors.push(`${r.email}: ${sent.error ?? "send failed"}`);
    }
    if (pause) await new Promise((res) => setTimeout(res, pause)); // stay under the email rate limit
  }
  console.log("[DesignLeadComeback]", { eligible: result.eligible, sent: result.sent, errors: result.errors.length });
  return result;
}
