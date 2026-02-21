"use server";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

import type { InstallerPricing } from "@/types/viewModels";

export interface AvailabilityResult {
  available: boolean;
  installer_id: string | null;
  installer_name: string | null;
  installer_stripe_id: string | null;
  installer_avatar_url: string | null;
  installer_phone: string | null;
  installer_lead_time: number;
  installer_working_days: string[];
  installer_is_pro: boolean;
  installer_logo_url: string | null;
  installer_pricing: InstallerPricing | null;
  message: string;
}

const INSTALLER_SELECT =
  "id, business_name, stripe_account_id, avatar_url, phone, lead_time_days, working_days, max_monthly_leads, current_month_leads, leads_reset_at, is_pro, logo_url, pricing_config";

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
      installer_is_pro: false,
      installer_logo_url: null,
      installer_pricing: null,
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
    installer_is_pro: !!(data.is_pro),
    installer_logo_url: (data.logo_url as string) ?? null,
    installer_pricing: (data.pricing_config as InstallerPricing) ?? null,
    message: `${name} serves your area.`,
  };
}

/**
 * Check if any installer covers the given ZIP code.
 * Uses service_zips array first, falls back to service_zip exact match.
 * Returns full installer context needed for booking flow.
 *
 * When multiple installers cover a ZIP:
 * - Pro installers get priority over Basic
 * - Among same tier, installer with fewer current leads gets the job
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
    // Sort by Pro status (Pro first), then by current_month_leads (lowest first)
    // Only include active installers
    const { data: matches, error } = await supabase
      .from("profiles")
      .select(INSTALLER_SELECT)
      .contains("service_zips", [trimmed])
      .neq("active", false)  // Exclude deactivated accounts
      .order("is_pro", { ascending: false })
      .order("current_month_leads", { ascending: true, nullsFirst: true });

    if (!error && matches && matches.length > 0) {
      // Find the first installer who isn't at capacity
      for (const installer of matches) {
        // Lead cap check: reset if needed
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        if (installer.leads_reset_at && new Date(installer.leads_reset_at as string) < new Date(monthStart)) {
          await supabase
            .from("profiles")
            .update({ current_month_leads: 0, leads_reset_at: monthStart })
            .eq("id", installer.id);
          (installer as Record<string, unknown>).current_month_leads = 0;
        }

        const currentLeads = (installer.current_month_leads as number) ?? 0;
        const maxLeads = (installer.max_monthly_leads as number) ?? 25;

        if (currentLeads < maxLeads) {
          return toResult(installer, "");
        }
      }
      // All installers at capacity
      return toResult(null, "All installers in this area are currently at capacity. Join the waitlist?");
    }

    // Fallback: exact match on service_zip (the installer's base ZIP)
    const { data: fallbackMatches, error: fbErr } = await supabase
      .from("profiles")
      .select(INSTALLER_SELECT)
      .eq("service_zip", trimmed)
      .order("is_pro", { ascending: false })
      .order("current_month_leads", { ascending: true, nullsFirst: true });

    if (!fbErr && fallbackMatches && fallbackMatches.length > 0) {
      for (const installer of fallbackMatches) {
        const currentLeads = (installer.current_month_leads as number) ?? 0;
        const maxLeads = (installer.max_monthly_leads as number) ?? 25;

        if (currentLeads < maxLeads) {
          return toResult(installer, "");
        }
      }
      return toResult(null, "All installers in this area are currently at capacity. Join the waitlist?");
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
 * Re-route an out-of-area lead to the nearest local installer.
 * Used by the Network Referral Bounty system: when a customer uses
 * Installer A's link but enters a ZIP outside their radius, find the
 * best local Pro and return them so the lead can be handed off.
 *
 * Returns the local installer result (or unavailable if none found).
 */
export async function rerouteToLocalInstaller(
  customerZip: string,
  originalInstallerId: string
): Promise<AvailabilityResult> {
  const trimmed = customerZip.trim();
  if (!/^\d{5}$/.test(trimmed)) {
    return toResult(null, "Please enter a valid 5-digit ZIP code.");
  }

  try {
    // Find installers covering this ZIP, excluding the original installer
    const { data: matches, error } = await supabase
      .from("profiles")
      .select(INSTALLER_SELECT)
      .contains("service_zips", [trimmed])
      .neq("id", originalInstallerId)
      .neq("active", false)
      .order("is_pro", { ascending: false })
      .order("current_month_leads", { ascending: true, nullsFirst: true });

    if (!error && matches && matches.length > 0) {
      for (const installer of matches) {
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        if (installer.leads_reset_at && new Date(installer.leads_reset_at as string) < new Date(monthStart)) {
          await supabase
            .from("profiles")
            .update({ current_month_leads: 0, leads_reset_at: monthStart })
            .eq("id", installer.id);
          (installer as Record<string, unknown>).current_month_leads = 0;
        }

        const currentLeads = (installer.current_month_leads as number) ?? 0;
        const maxLeads = (installer.max_monthly_leads as number) ?? 25;

        if (currentLeads < maxLeads) {
          return toResult(installer, "");
        }
      }
      return toResult(null, "All installers in this area are currently at capacity.");
    }

    // Fallback: exact match on service_zip
    const { data: fallbackMatches, error: fbErr } = await supabase
      .from("profiles")
      .select(INSTALLER_SELECT)
      .eq("service_zip", trimmed)
      .neq("id", originalInstallerId)
      .order("is_pro", { ascending: false })
      .order("current_month_leads", { ascending: true, nullsFirst: true });

    if (!fbErr && fallbackMatches && fallbackMatches.length > 0) {
      for (const installer of fallbackMatches) {
        const currentLeads = (installer.current_month_leads as number) ?? 0;
        const maxLeads = (installer.max_monthly_leads as number) ?? 25;
        if (currentLeads < maxLeads) {
          return toResult(installer, "");
        }
      }
      return toResult(null, "All installers in this area are currently at capacity.");
    }

    return toResult(null, "No installer available in this area yet.");
  } catch {
    return toResult(null, "Unable to find a local installer.");
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
 * Fetch installer profile by vanity slug (for URL param ?installer=slug).
 */
export async function getInstallerBySlug(
  slug: string
): Promise<AvailabilityResult> {
  if (!slug) return toResult(null, "No installer specified.");

  try {
    // Use ilike for case-insensitive matching in case slug was stored with mixed case
    const { data, error } = await supabase
      .from("profiles")
      .select(INSTALLER_SELECT)
      .ilike("slug", slug.trim())
      .maybeSingle();

    if (error || !data) {
      // Fallback: try ref_slug for backward compat
      return getInstallerByRef(slug);
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
    // Use ilike for case-insensitive matching in case ref_slug was stored with mixed case
    const { data, error } = await supabase
      .from("profiles")
      .select(INSTALLER_SELECT)
      .ilike("ref_slug", slug.trim())
      .maybeSingle();

    if (error || !data) {
      return toResult(null, "Installer not found.");
    }

    return toResult(data, "");
  } catch {
    return toResult(null, "Unable to load installer profile.");
  }
}
