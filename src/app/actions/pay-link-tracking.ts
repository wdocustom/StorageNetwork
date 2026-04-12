"use server";

import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Pay Link Tracking — Record customer engagement with /pay links
//
// Public (no auth required) — called from the customer-facing /pay page.
// Uses the service client to bypass RLS since the customer is anonymous.
// ═══════════════════════════════════════════════════════════════════════════

const supabase = getServiceClient();

/**
 * Record that a customer opened a /pay link.
 * Sets viewed_at on first view, increments view_count on every view.
 */
export async function recordPayLinkView(leadId: string): Promise<void> {
  if (!leadId) return;

  try {
    // Fetch current state to decide if this is the first view
    const { data: lead } = await supabase
      .from("leads")
      .select("viewed_at, view_count")
      .eq("id", leadId)
      .single();

    if (!lead) return;

    const updates: Record<string, unknown> = {
      view_count: (lead.view_count || 0) + 1,
    };

    // Only set viewed_at on first view
    if (!lead.viewed_at) {
      updates.viewed_at = new Date().toISOString();
    }

    await supabase
      .from("leads")
      .update(updates)
      .eq("id", leadId);
  } catch (err) {
    console.error("[PayLinkTracking] recordPayLinkView failed:", err);
  }
}

/**
 * Record the furthest checkout step the customer reached.
 * Only updates if the new step is "deeper" than what's already stored.
 */
export async function recordPayLinkStep(
  leadId: string,
  step: "address" | "review" | "payment"
): Promise<void> {
  if (!leadId) return;

  const STEP_ORDER: Record<string, number> = {
    address: 1,
    review: 2,
    payment: 3,
  };

  try {
    const { data: lead } = await supabase
      .from("leads")
      .select("last_step_reached")
      .eq("id", leadId)
      .single();

    if (!lead) return;

    const currentDepth = STEP_ORDER[lead.last_step_reached || ""] || 0;
    const newDepth = STEP_ORDER[step] || 0;

    // Only update if the customer went deeper
    if (newDepth > currentDepth) {
      await supabase
        .from("leads")
        .update({ last_step_reached: step })
        .eq("id", leadId);
    }
  } catch (err) {
    console.error("[PayLinkTracking] recordPayLinkStep failed:", err);
  }
}
