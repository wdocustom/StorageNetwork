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

// ── Types ────────────────────────────────────────────────────────────────

export interface BlackoutDate {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
}

// ── Get blackout dates for an installer ──────────────────────────────────

export async function getBlackoutDates(installerId: string): Promise<{
  success: boolean;
  dates: BlackoutDate[];
  error?: string;
}> {
  try {
    const { data, error } = await getSupabase()
      .from("installer_blackout_dates")
      .select("id, start_date, end_date, reason")
      .eq("installer_id", installerId)
      .order("start_date", { ascending: true });

    if (error) return { success: false, dates: [], error: error.message };
    return { success: true, dates: (data ?? []) as BlackoutDate[] };
  } catch {
    return { success: false, dates: [], error: "Failed to load blackout dates" };
  }
}

// ── Add a blackout date range ────────────────────────────────────────────

export async function addBlackoutDate(
  installerId: string,
  startDate: string,
  endDate: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await getSupabase()
      .from("installer_blackout_dates")
      .insert({
        installer_id: installerId,
        start_date: startDate,
        end_date: endDate,
        reason: reason || null,
      });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: "Failed to add blackout date" };
  }
}

// ── Remove a blackout date ───────────────────────────────────────────────

export async function removeBlackoutDate(
  installerId: string,
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await getSupabase()
      .from("installer_blackout_dates")
      .delete()
      .eq("id", id)
      .eq("installer_id", installerId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: "Failed to remove blackout date" };
  }
}

// ── Check if a date is blacked out for an installer (used by booking) ────

export async function isDateBlackedOut(
  installerId: string,
  date: string
): Promise<boolean> {
  try {
    const { data } = await getSupabase()
      .from("installer_blackout_dates")
      .select("id")
      .eq("installer_id", installerId)
      .lte("start_date", date)
      .gte("end_date", date)
      .limit(1);

    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
