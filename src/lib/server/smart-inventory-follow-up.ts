import "server-only";

import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Smart Inventory follow-up queue (plan_buyer_campaigns rows)
//
//   SMART_INVENTORY_FOLLOW_UP_QUEUE  queued at purchase; sent_at = when queued
//   SMART_INVENTORY_CAMPAIGN         the email went out (also the Nov 16, 2026
//                                    announcement to earlier buyers)
//
// Fulfilment queues a buyer when their purchase email does NOT pitch Smart
// Inventory; the daily job emails queued buyers 4+ days later. Buyers from
// before this queue existed were told in their purchase email or the
// announcement, so they're never queued and never emailed again.
// ═══════════════════════════════════════════════════════════════════════════

export const SMART_INVENTORY_CAMPAIGN = "smart_inventory_nov2026";
export const SMART_INVENTORY_FOLLOW_UP_QUEUE = "smart_inventory_followup_queued";

/**
 * Queue the follow-up for a new buyer: only on their FIRST real tote plan
 * purchase (an earlier one means an earlier purchase email, which may have
 * pitched Smart Inventory already). Idempotent: one row per email. Never throws.
 */
export async function queueSmartInventoryFollowUp(rawEmail: string, thisAccessToken: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return;
  try {
    const db = getServiceClient();
    const { data: earlier } = await db
      .from("public_plan_purchases")
      .select("access_token")
      .eq("email", email)
      .eq("plan_id", "tote-organizer")
      .is("included_from", null)
      .neq("access_token", thisAccessToken)
      .limit(1);
    if ((earlier as unknown[] | null)?.length) return;
    const { error } = await db
      .from("plan_buyer_campaigns")
      .insert({ email, campaign: SMART_INVENTORY_FOLLOW_UP_QUEUE });
    // 23505: already queued (an earlier purchase), which is fine.
    if (error && (error as { code?: string }).code !== "23505") {
      console.error("[SmartInventoryFollowUp] queue failed:", error.message);
    }
  } catch (err) {
    console.error("[SmartInventoryFollowUp] queue failed:", err);
  }
}
