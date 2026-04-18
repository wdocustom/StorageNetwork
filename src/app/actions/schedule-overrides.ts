"use server";

import { getServiceClient } from "@/lib/supabase-server";

const supabase = getServiceClient();

export interface ScheduleOverride {
  id: string;
  date: string;
  morning_available: boolean;
  afternoon_available: boolean;
  note: string | null;
}

export interface ScheduledJob {
  id: string;
  customer_name: string;
  scheduled_at: string;
  time_preference: string | null;
  weight: number;
  estimated_price: number | null;
}

// Get overrides for a date range
export async function getScheduleOverrides(
  installerId: string,
  startDate: string,
  endDate: string
): Promise<{ success: boolean; overrides: ScheduleOverride[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("installer_schedule_overrides")
      .select("id, date, morning_available, afternoon_available, note")
      .eq("installer_id", installerId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });

    if (error) return { success: false, overrides: [], error: error.message };
    return { success: true, overrides: (data ?? []) as ScheduleOverride[] };
  } catch {
    return { success: false, overrides: [], error: "Failed to load schedule overrides" };
  }
}

// Set override for a specific date (upsert)
export async function setScheduleOverride(
  installerId: string,
  date: string,
  morningAvailable: boolean,
  afternoonAvailable: boolean,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // If both blocks match the default (both available), remove the override
    const { error } = await supabase
      .from("installer_schedule_overrides")
      .upsert(
        {
          installer_id: installerId,
          date,
          morning_available: morningAvailable,
          afternoon_available: afternoonAvailable,
          note: note || null,
        },
        { onConflict: "installer_id,date" }
      );

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update schedule" };
  }
}

// Remove override (revert to defaults)
export async function removeScheduleOverride(
  installerId: string,
  date: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("installer_schedule_overrides")
      .delete()
      .eq("installer_id", installerId)
      .eq("date", date);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: "Failed to remove override" };
  }
}

// Get scheduled jobs for a date range (for calendar visualization)
export async function getScheduledJobs(
  installerId: string,
  startDate: string,
  endDate: string
): Promise<{ success: boolean; jobs: ScheduledJob[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("leads")
      .select("id, customer_name, scheduled_at, time_preference, weight, estimated_price")
      .eq("installer_id", installerId)
      .gte("scheduled_at", startDate)
      .lte("scheduled_at", endDate + "T23:59:59")
      .not("status", "in", '("cancelled","archived","expired")')
      .order("scheduled_at", { ascending: true });

    if (error) return { success: false, jobs: [], error: error.message };
    return { success: true, jobs: (data ?? []) as ScheduledJob[] };
  } catch {
    return { success: false, jobs: [], error: "Failed to load scheduled jobs" };
  }
}

// Get overrides formatted for the customer-facing NativeScheduler
// Returns dates where specific blocks are unavailable
export async function getBlockAvailability(
  installerId: string,
  startDate: string,
  endDate: string
): Promise<{
  success: boolean;
  blocks: Record<string, { morning: boolean; afternoon: boolean }>;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("installer_schedule_overrides")
      .select("date, morning_available, afternoon_available")
      .eq("installer_id", installerId)
      .gte("date", startDate)
      .lte("date", endDate);

    if (error) return { success: false, blocks: {}, error: error.message };

    const blocks: Record<string, { morning: boolean; afternoon: boolean }> = {};
    for (const row of data ?? []) {
      blocks[row.date] = {
        morning: row.morning_available,
        afternoon: row.afternoon_available,
      };
    }

    return { success: true, blocks };
  } catch {
    return { success: false, blocks: {}, error: "Failed to load block availability" };
  }
}
