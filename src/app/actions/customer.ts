"use server";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AvailabilityResult {
  available: boolean;
  installer_name: string | null;
  message: string;
}

/**
 * Check if any installer covers the given ZIP code.
 * Looks up the zip in the service_zips array across all profiles.
 */
export async function checkAvailability(
  zip: string
): Promise<AvailabilityResult> {
  const trimmed = zip.trim();
  if (!/^\d{5}$/.test(trimmed)) {
    return {
      available: false,
      installer_name: null,
      message: "Please enter a valid 5-digit ZIP code.",
    };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("business_name")
    .contains("service_zips", [trimmed])
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      available: false,
      installer_name: null,
      message: "Unable to check availability. Please try again.",
    };
  }

  if (data) {
    return {
      available: true,
      installer_name: data.business_name,
      message: `${data.business_name ?? "A local installer"} serves your area.`,
    };
  }

  return {
    available: false,
    installer_name: null,
    message: "No local partner found. Routing to HQ.",
  };
}
