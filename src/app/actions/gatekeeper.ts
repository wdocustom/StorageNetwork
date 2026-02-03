"use server";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy-initialize Supabase client to avoid build-time errors
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase environment variables not configured");
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

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
 * Returns installer_id for routing if found.
 */
export async function gatekeeperCheck(
  zip: string
): Promise<GatekeeperResult> {
  const trimmed = zip.trim();
  if (!/^\d{5}$/.test(trimmed)) {
    return { available: false, installer_id: null, installer_name: null };
  }

  const { data, error } = await getSupabase()
    .from("profiles")
    .select("id, business_name")
    .contains("service_zips", [trimmed])
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { available: false, installer_id: null, installer_name: null };
  }

  return {
    available: true,
    installer_id: data.id,
    installer_name: data.business_name,
  };
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
  const { data: existing } = await getSupabase()
    .from("waitlist")
    .select("id")
    .eq("email", trimmedEmail)
    .eq("zip_code", trimmedZip)
    .maybeSingle();

  if (existing) {
    return { success: true }; // Already on list, treat as success
  }

  const { error } = await getSupabase()
    .from("waitlist")
    .insert({ email: trimmedEmail, zip_code: trimmedZip });

  if (error) {
    return { success: false, error: "Failed to join waitlist. Please try again." };
  }

  return { success: true };
}
