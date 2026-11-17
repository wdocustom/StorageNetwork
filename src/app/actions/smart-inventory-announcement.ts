"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Smart Inventory follow-up: one email to every tote plan buyer, sent
// SMART_INVENTORY_DELAY_DAYS after their first purchase (by then the rack is
// built or close), instead of pitching it in the purchase email. Skips buyers
// who already own it. One row per buyer in plan_buyer_campaigns, so re-runs
// never repeat; buyers from before Nov 16, 2026 got it once as an
// announcement under the same campaign key. Called daily (15:00 UTC) by
// /api/cron/smart-inventory-announcement, so it lands 4–5 days after buying.
// ═══════════════════════════════════════════════════════════════════════════

import { getServiceClient } from "@/lib/supabase-server";
import { sendSmartInventoryAnnouncementEmail } from "@/lib/emails/plansTemplates";
import { TOTE_PLAN_ID, parseTotePlanDesign, totePlanName } from "@/lib/tote-plans";

const SMART_INVENTORY_CAMPAIGN = "smart_inventory_nov2026";
/** Days after a buyer's first plan purchase before the email goes out. */
const SMART_INVENTORY_DELAY_DAYS = 4;

export interface CampaignResult {
  eligible: number;
  sent: number;
  errors: string[];
}

export async function processSmartInventoryAnnouncement(now = Date.now()): Promise<CampaignResult> {
  const result: CampaignResult = { eligible: 0, sent: 0, errors: [] };
  const db = getServiceClient();
  const dueBefore = new Date(now - SMART_INVENTORY_DELAY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [purchases, owners, already] = await Promise.all([
    db
      .from("public_plan_purchases")
      .select("email, access_token, build_config, customer_name, purchased_at")
      .eq("plan_id", TOTE_PLAN_ID)
      // Real purchases only (plans built free under All-Access aren't), at
      // least SMART_INVENTORY_DELAY_DAYS old.
      .is("included_from", null)
      .lt("purchased_at", dueBefore)
      .order("purchased_at", { ascending: false }),
    db.from("diy_inventory_access").select("email"),
    db.from("plan_buyer_campaigns").select("email").eq("campaign", SMART_INVENTORY_CAMPAIGN),
  ]);
  if (purchases.error) {
    result.errors.push(`Query failed: ${purchases.error.message}`);
    return result;
  }

  const skip = new Set<string>([
    ...(owners.data ?? []).map((r) => String(r.email).toLowerCase()),
    ...(already.data ?? []).map((r) => String(r.email).toLowerCase()),
  ]);

  // Newest plan per buyer (rows are newest first)
  const buyers = new Map<string, { token: string; name: string; customer: string | null }>();
  for (const p of purchases.data ?? []) {
    const email = String(p.email ?? "").toLowerCase();
    if (!email || skip.has(email) || buyers.has(email) || !p.access_token) continue;
    const design = parseTotePlanDesign(p.build_config);
    buyers.set(email, {
      token: p.access_token as string,
      name: design ? totePlanName(design) : "tote rack",
      customer: (p.customer_name as string | null) ?? null,
    });
  }
  result.eligible = buyers.size;

  for (const [email, b] of buyers) {
    // Claim first: a concurrent run can't send the same buyer twice.
    const { error: claimError } = await db.from("plan_buyer_campaigns").insert({ email, campaign: SMART_INVENTORY_CAMPAIGN });
    if (claimError) continue;
    let sent = false;
    let lastError = "";
    for (let attempt = 0; attempt < 3 && !sent; attempt++) {
      const r = await sendSmartInventoryAnnouncementEmail(email, { accessToken: b.token, designName: b.name, customerName: b.customer });
      if (r.success) sent = true;
      else {
        lastError = r.error || "Unknown error";
        if (!lastError.includes("Too many requests")) break;
        await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
      }
    }
    if (sent) result.sent++;
    else {
      // Release the claim so the next run retries this buyer.
      await db.from("plan_buyer_campaigns").delete().eq("email", email).eq("campaign", SMART_INVENTORY_CAMPAIGN);
      result.errors.push(`${email}: ${lastError}`);
    }
    await new Promise((res) => setTimeout(res, 600)); // stay under the email rate limit
  }
  console.log("[SmartInventoryAnnouncement]", { eligible: result.eligible, sent: result.sent, errors: result.errors.length });
  return result;
}
