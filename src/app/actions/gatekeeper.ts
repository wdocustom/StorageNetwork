"use server";

import { getServiceClient } from "@/lib/supabase-server";

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
 * Add an email to the waitlist for an unserviced ZIP code.
 */
export async function joinWaitlist(
  email: string,
  zip: string
): Promise<{ success: boolean; error?: string }> {
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedZip = zip.trim();

  if (!/^\d{5}$/.test(trimmedZip)) {
    return { success: false, error: "Invalid ZIP code." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return { success: false, error: "Invalid email address." };
  }

  // Dedup check
  const { data: existing } = await supabase
    .from("waitlist")
    .select("id")
    .eq("email", trimmedEmail)
    .eq("zip_code", trimmedZip)
    .maybeSingle();

  if (existing) {
    return { success: true }; // Already on list, treat as success
  }

  const { error } = await supabase
    .from("waitlist")
    .insert({ email: trimmedEmail, zip_code: trimmedZip });

  if (error) {
    return { success: false, error: "Failed to join waitlist. Please try again." };
  }

  return { success: true };
}
