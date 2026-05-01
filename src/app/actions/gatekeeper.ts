"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { sendWaitlistJoinedNotice } from "@/lib/email";

const supabase = getServiceClient();

// ═══════════════════════════════════════════════════════════════════════════
// Gatekeeper — Smart ZIP matchmaking + waitlist capture
// ═══════════════════════════════════════════════════════════════════════════

export interface GatekeeperResult {
  available: boolean;
  installer_id: string | null;
  installer_name: string | null;
}

/**
 * Check if any installer covers the given ZIP code.
 * Returns the highest-priority installer for routing.
 *
 * Tiered priority: is_pro DESC, completed_jobs DESC, current_month_leads ASC
 */
export async function gatekeeperCheck(
  zip: string
): Promise<GatekeeperResult> {
  const trimmed = zip.trim();
  if (!/^\d{5}$/.test(trimmed)) {
    return { available: false, installer_id: null, installer_name: null };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, business_name, is_pro, is_suspended, completed_jobs, current_month_leads, max_monthly_leads")
    .contains("service_zips", [trimmed])
    .neq("is_suspended", true)
    .order("is_pro", { ascending: false, nullsFirst: false })
    .order("completed_jobs", { ascending: false, nullsFirst: false })
    .order("current_month_leads", { ascending: true, nullsFirst: true });

  if (error || !data || data.length === 0) {
    return { available: false, installer_id: null, installer_name: null };
  }

  for (const inst of data) {
    const current = (inst.current_month_leads as number) ?? 0;
    const max = (inst.max_monthly_leads as number) ?? 25;
    if (current < max) {
      return {
        available: true,
        installer_id: inst.id,
        installer_name: inst.business_name,
      };
    }
  }

  return { available: false, installer_id: null, installer_name: null };
}

/**
 * Add an email to the waitlist for an unserviced ZIP code, and fire a
 * confirmation email so the customer knows we got them.
 *
 * Idempotent: re-submitting the same (email, zip) just resends the
 * confirmation rather than erroring or creating dupes.
 */
export async function joinWaitlist(
  email: string,
  zip: string,
  name?: string
): Promise<{ success: boolean; error?: string }> {
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedZip = zip.trim();
  const trimmedName = name?.trim() || undefined;

  if (!/^\d{5}$/.test(trimmedZip)) {
    return { success: false, error: "Invalid ZIP code." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return { success: false, error: "Invalid email address." };
  }

  const { data: existing } = await supabase
    .from("waitlist")
    .select("id")
    .eq("email", trimmedEmail)
    .eq("zip_code", trimmedZip)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase
      .from("waitlist")
      .insert({ email: trimmedEmail, zip_code: trimmedZip });

    if (error) {
      console.error("[Waitlist] Insert failed:", error.message);
      return { success: false, error: "Failed to join waitlist. Please try again." };
    }
  }

  // Confirmation email — non-blocking. Customer gets a "we got you" note
  // immediately, even if they were already on the list.
  try {
    await sendWaitlistJoinedNotice(trimmedEmail, { zip: trimmedZip, name: trimmedName });
  } catch (err) {
    console.error("[Waitlist] Confirmation email failed:", err);
    // Don't fail the request — the row is in the DB, that's what matters.
  }

  return { success: true };
}
