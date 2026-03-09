"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";
import zipcodes from "zipcodes";
import { sendWaitlistAlert, sendWaitlistCustomerConfirmation } from "@/lib/email";
import { recordWaitlistDemand, activateDemandSignals } from "@/app/actions/demand-signals";

const supabase = getServiceClient();

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

  // Auth check: verify the caller is the installer being updated
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, zips_covered: 0, error: "Not authenticated." };
  if (user.id !== installer_id) return { success: false, zips_covered: 0, error: "Not authorized." };

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

  // Activate demand signals: email waitlisted customers in the new coverage area
  // Fire-and-forget — don't block the profile update response
  const installerName = input.business_name || "A local installer";
  activateDemandSignals(installer_id, coveredZips, installerName).catch((err) => {
    console.error("[Installer] Demand signal activation failed (non-fatal):", err);
  });

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

// ═══════════════════════════════════════════════════════════════════════════
// Waitlist — out-of-area customer requests notification to installer
// ═══════════════════════════════════════════════════════════════════════════

export interface WaitlistInput {
  installer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  customer_zip: string;
  quote_data?: unknown[];
}

export async function submitWaitlistRequest(input: WaitlistInput): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!input.customer_name?.trim() || !input.customer_email?.trim()) {
    return { success: false, error: "Name and email are required." };
  }
  if (!input.customer_zip?.trim() || !/^\d{5}$/.test(input.customer_zip.trim())) {
    return { success: false, error: "A valid 5-digit ZIP code is required." };
  }

  try {
    // Fetch installer info for the email
    const { data: installer } = await supabase
      .from("profiles")
      .select("email, business_name, service_radius_miles")
      .eq("id", input.installer_id)
      .single();

    if (!installer?.email) {
      return { success: false, error: "Installer not found." };
    }

    // Persist waitlist demand signal in DB (so we can activate later)
    await recordWaitlistDemand({
      zip: input.customer_zip.trim(),
      customerName: input.customer_name.trim(),
      customerEmail: input.customer_email.trim(),
      customerPhone: input.customer_phone?.trim(),
      sourceInstallerId: input.installer_id,
      quoteData: input.quote_data,
    });

    // Send the waitlist email to the installer (existing behavior)
    await sendWaitlistAlert(installer.email, {
      installerName: installer.business_name || "Installer",
      customerName: input.customer_name.trim(),
      customerEmail: input.customer_email.trim(),
      customerPhone: input.customer_phone?.trim() || undefined,
      customerZip: input.customer_zip.trim(),
      radiusMiles: installer.service_radius_miles || undefined,
    });

    // Send the customer a waitlist confirmation email
    await sendWaitlistCustomerConfirmation(input.customer_email.trim(), {
      customerName: input.customer_name.trim(),
      installerBusinessName: installer.business_name || "Storage Network",
      zip: input.customer_zip.trim(),
      quoteData: input.quote_data as Array<{ desc?: string; cols?: number; rows?: number; price?: number }>,
    }).catch((err) => {
      console.error("[Waitlist] Customer confirmation email failed (non-fatal):", err);
    });

    return { success: true };
  } catch (err) {
    console.error("[Waitlist] Failed to submit:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
