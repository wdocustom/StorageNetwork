"use server";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AvailabilityResult {
  available: boolean;
  installer_id: string | null;
  installer_name: string | null;
  installer_stripe_id: string | null;
  installer_avatar_url: string | null;
  installer_phone: string | null;
  installer_lead_time: number;
  installer_working_days: string[];
  message: string;
}

const INSTALLER_SELECT =
  "id, business_name, stripe_account_id, avatar_url, phone, lead_time_days, working_days";

function toResult(
  data: Record<string, unknown> | null,
  fallbackMsg: string
): AvailabilityResult {
  if (!data) {
    return {
      available: false,
      installer_id: null,
      installer_name: null,
      installer_stripe_id: null,
      installer_avatar_url: null,
      installer_phone: null,
      installer_lead_time: 5,
      installer_working_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      message: fallbackMsg,
    };
  }

  const name = (data.business_name as string) ?? "A local installer";
  return {
    available: true,
    installer_id: data.id as string,
    installer_name: name,
    installer_stripe_id: (data.stripe_account_id as string) ?? null,
    installer_avatar_url: (data.avatar_url as string) ?? null,
    installer_phone: (data.phone as string) ?? null,
    installer_lead_time: (data.lead_time_days as number) ?? 5,
    installer_working_days:
      (data.working_days as string[]) ?? ["Mon", "Tue", "Wed", "Thu", "Fri"],
    message: `${name} serves your area.`,
  };
}

/**
 * Check if any installer covers the given ZIP code.
 * Uses service_zips array first, falls back to service_zip exact match.
 * Returns full installer context needed for booking flow.
 */
export async function checkAvailability(
  zip: string
): Promise<AvailabilityResult> {
  const trimmed = zip.trim();
  if (!/^\d{5}$/.test(trimmed)) {
    return toResult(null, "Please enter a valid 5-digit ZIP code.");
  }

  try {
    // Primary: search the service_zips array (covers radius)
    const { data, error } = await supabase
      .from("profiles")
      .select(INSTALLER_SELECT)
      .contains("service_zips", [trimmed])
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return toResult(data, "");
    }

    // Fallback: exact match on service_zip (the installer's base ZIP)
    const { data: fallback, error: fbErr } = await supabase
      .from("profiles")
      .select(INSTALLER_SELECT)
      .eq("service_zip", trimmed)
      .limit(1)
      .maybeSingle();

    if (!fbErr && fallback) {
      return toResult(fallback, "");
    }

    return toResult(
      null,
      "We aren\u2019t in this area yet. Join the waitlist?"
    );
  } catch {
    return toResult(null, "Unable to check availability. Please try again.");
  }
}

/**
 * Fetch installer profile by ID (for URL param ?installer=xyz).
 */
export async function getInstallerById(
  id: string
): Promise<AvailabilityResult> {
  if (!id) return toResult(null, "No installer specified.");

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(INSTALLER_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return toResult(null, "Installer not found.");
    }

    return toResult(data, "");
  } catch {
    return toResult(null, "Unable to load installer profile.");
  }
}

/**
 * Fetch installer profile by ref slug (for URL param ?ref=slug).
 */
export async function getInstallerByRef(
  slug: string
): Promise<AvailabilityResult> {
  if (!slug) return toResult(null, "No installer specified.");

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(INSTALLER_SELECT)
      .eq("ref_slug", slug.toLowerCase().trim())
      .maybeSingle();

    if (error || !data) {
      return toResult(null, "Installer not found.");
    }

    return toResult(data, "");
  } catch {
    return toResult(null, "Unable to load installer profile.");
  }
}
