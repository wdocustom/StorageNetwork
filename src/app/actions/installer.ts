"use server";

import { createClient } from "@supabase/supabase-js";
import zipcodes from "zipcodes";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

  const { error } = await supabase
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

// ═══════════════════════════════════════════════════════════════════════════
// Service Area Validation — checks if a customer ZIP is within an
// installer's service coverage. Used by submit-lead (server gate) and
// client-side real-time validation on booking forms.
// ═══════════════════════════════════════════════════════════════════════════

export interface ServiceAreaCheckResult {
  inArea: boolean;
  installerName?: string;
  serviceZip?: string;
  radiusMiles?: number;
  error?: string;
}

/**
 * Check if a customer ZIP code falls within an installer's service area.
 * Returns { inArea: true } if the ZIP is covered, or { inArea: false }
 * with the installer's base ZIP and radius for the error message.
 */
export async function validateServiceArea(
  installerId: string,
  customerZip: string
): Promise<ServiceAreaCheckResult> {
  if (!installerId || !customerZip) {
    return { inArea: true }; // No installer or no ZIP = skip validation
  }

  const trimmedZip = customerZip.trim();
  if (!/^\d{5}$/.test(trimmedZip)) {
    return { inArea: false, error: "Please enter a valid 5-digit ZIP code." };
  }

  try {
    const { data: installer, error } = await supabase
      .from("profiles")
      .select("business_name, service_zip, service_radius_miles, service_zips")
      .eq("id", installerId)
      .single();

    if (error || !installer) {
      // If we can't find the installer, don't block the booking
      return { inArea: true };
    }

    const serviceZips = installer.service_zips as string[] | null;
    const baseZip = installer.service_zip as string | null;
    const radius = installer.service_radius_miles as number | null;
    const name = installer.business_name as string | null;

    // If the installer hasn't set up a service area, allow all ZIPs
    if (!serviceZips || serviceZips.length === 0) {
      return { inArea: true };
    }

    // Check if customer ZIP is in the service_zips array
    if (serviceZips.includes(trimmedZip)) {
      return { inArea: true };
    }

    return {
      inArea: false,
      installerName: name || undefined,
      serviceZip: baseZip || undefined,
      radiusMiles: radius || undefined,
    };
  } catch {
    // On error, don't block the booking
    return { inArea: true };
  }
}
