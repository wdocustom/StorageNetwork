"use server";

// ═══════════════════════════════════════════════════════════════════════════
// "Email me my design + this price" (the designer's $5-off offer)
//
// Saves the visitor's email and design (plan_design_leads) and emails them a
// link that reopens the exact design with the offer applied. Rate-limited;
// the design is validated, the price comes from the offer code.
// ═══════════════════════════════════════════════════════════════════════════

import { enforceActionRateLimit, RateLimitError } from "@/lib/server/action-rate-limit";
import { getServiceClient } from "@/lib/supabase-server";
import { getAppUrl } from "@/lib/url-helper";
import { sendPlanDesignSavedEmail } from "@/lib/emails/plansTemplates";
import {
  TOTE_PLAN_EXIT_OFFER,
  encodeTotePlanDesign,
  formatPlanPrice,
  parseTotePlanDesign,
  totePlanDesignHref,
  totePlanOfferPrice,
} from "@/lib/tote-plans";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function emailMyDesign(input: {
  email: string;
  design: unknown;
  offer?: string | null;
  visitorId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await enforceActionRateLimit({ action: "plan-design-lead", limit: 5, window: "60 s", identify: "user-or-ip" });
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }
  const email = (input.email ?? "").trim().toLowerCase().slice(0, 200);
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address." };
  const design = parseTotePlanDesign(input.design);
  if (!design) return { ok: false, error: "Something's off with this design. Refresh and try again." };
  const offer = input.offer === TOTE_PLAN_EXIT_OFFER.code ? TOTE_PLAN_EXIT_OFFER.code : null;
  const visitorId = typeof input.visitorId === "string" && /^[\w-]{1,64}$/.test(input.visitorId) ? input.visitorId : null;

  const db = getServiceClient();
  const { data: row, error } = await db
    .from("plan_design_leads")
    .insert({ email, design: encodeTotePlanDesign(design), design_name: design.name ?? null, offer, visitor_id: visitorId })
    .select("id")
    .single();
  if (error) {
    console.error("[PlanDesignLead] insert failed:", error.message);
    return { ok: false, error: "We couldn't save that. Please try again." };
  }

  const link = `${getAppUrl()}${totePlanDesignHref(design, "design_email")}${offer ? `&offer=${offer}` : ""}`;
  const sent = await sendPlanDesignSavedEmail(email, design, link, formatPlanPrice(totePlanOfferPrice(offer)));
  if (sent.success) await db.from("plan_design_leads").update({ emailed: true }).eq("id", row.id);
  else console.error("[PlanDesignLead] email failed for lead", row.id);
  return { ok: true };
}
