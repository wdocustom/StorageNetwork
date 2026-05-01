"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { sendWaitlistJoinedNotice } from "@/lib/email";
import { recordWaitlistDemand } from "@/app/actions/demand-signals";

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
 * Add a customer to the waitlist for an unserviced ZIP code and fire a
 * confirmation email. Routes through the canonical demand_signals table
 * (migration 037) so the row gets picked up automatically by
 * activateDemandSignals() the moment an installer covers this ZIP — i.e.
 * this is the system the installer onboarding flow is already wired to.
 *
 * Idempotent at the email level: a duplicate (email, zip) row is harmless
 * because activateDemandSignals only fires once per row, but we keep
 * dedup on the demand_signals (email, zip, signal_type='waitlist') tuple
 * to avoid table bloat.
 */
export async function joinWaitlist(
  email: string,
  zip: string,
  name?: string
): Promise<{ success: boolean; error?: string }> {
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedZip = zip.trim();
  const trimmedName = name?.trim() || "Customer";

  if (!/^\d{5}$/.test(trimmedZip)) {
    return { success: false, error: "Invalid ZIP code." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return { success: false, error: "Invalid email address." };
  }

  // Dedup: if an unresolved waitlist signal already exists for this
  // (email, zip), skip the insert so we don't rack up duplicates. The
  // confirmation email still fires so the user gets feedback.
  const { data: existing } = await supabase
    .from("demand_signals")
    .select("id")
    .eq("zip", trimmedZip)
    .eq("customer_email", trimmedEmail)
    .eq("signal_type", "waitlist")
    .eq("status", "unresolved")
    .maybeSingle();

  if (!existing) {
    const result = await recordWaitlistDemand({
      zip: trimmedZip,
      customerName: trimmedName,
      customerEmail: trimmedEmail,
    });
    if (!result.success) {
      return { success: false, error: result.error || "Failed to join waitlist." };
    }
  }

  // Confirmation email — non-blocking.
  try {
    await sendWaitlistJoinedNotice(trimmedEmail, {
      zip: trimmedZip,
      name: name?.trim() || undefined,
    });
  } catch (err) {
    console.error("[Waitlist] Confirmation email failed:", err);
  }

  return { success: true };
}
