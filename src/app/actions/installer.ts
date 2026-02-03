"use server";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import zipcodes from "zipcodes";

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

export interface UpdateProfileInput {
  installer_id: string;
  business_name?: string;
  service_zip: string;
  service_radius_miles: number;
  service_settings?: Record<string, unknown>;
}

export interface UpdateProfileResult {
  success: boolean;
  zips_covered: number;
  error?: string;
}

/**
 * Update an installer's profile and auto-compute the service_zips
 * array using zipcodes.radius() based on their base ZIP and radius.
 */
export async function updateInstallerProfile(
  input: UpdateProfileInput
): Promise<UpdateProfileResult> {
  const { installer_id, service_zip, service_radius_miles } = input;

  // Validate the base zip
  if (!/^\d{5}$/.test(service_zip)) {
    return { success: false, zips_covered: 0, error: "Invalid ZIP code." };
  }

  const zipInfo = zipcodes.lookup(service_zip);
  if (!zipInfo) {
    return { success: false, zips_covered: 0, error: "ZIP code not found." };
  }

  // Clamp radius to reasonable bounds
  const radius = Math.max(1, Math.min(service_radius_miles, 150));

  // Compute all zips within the radius
  const coveredZips = zipcodes.radius(service_zip, radius) ?? [];

  const updateData: Record<string, unknown> = {
    service_zip,
    service_radius_miles: radius,
    service_zips: coveredZips,
    service_settings: input.service_settings ?? {},
  };

  if (input.business_name !== undefined) {
    updateData.business_name = input.business_name;
  }

  const { error } = await getSupabase()
    .from("profiles")
    .update(updateData)
    .eq("id", installer_id);

  if (error) {
    return {
      success: false,
      zips_covered: 0,
      error: "Failed to save profile. Please try again.",
    };
  }

  return { success: true, zips_covered: coveredZips.length };
}
