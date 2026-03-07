"use server";

import { createClient } from "@supabase/supabase-js";
import type { InstallerPricing } from "@/types/viewModels";

// ═══════════════════════════════════════════════════════════════════════════
// Pricing — Server actions for installer custom pricing
// ═══════════════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PricingResult {
  success: boolean;
  pricing?: InstallerPricing;
  error?: string;
}

/**
 * Get installer's current custom pricing config.
 * Returns platform defaults merged with any custom overrides.
 */
export async function getInstallerPricing(
  installerId: string
): Promise<PricingResult> {
  if (!installerId) {
    return { success: false, error: "No installer ID provided." };
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("is_pro, pricing_config")
      .eq("id", installerId)
      .single();

    if (error || !data) {
      return { success: false, error: "Installer not found." };
    }

    const pricing = (data.pricing_config as InstallerPricing) ?? {};
    return { success: true, pricing };
  } catch {
    return { success: false, error: "Failed to load pricing." };
  }
}

/**
 * Save installer's custom pricing config.
 * NULL values fall back to platform defaults.
 */
export async function updateInstallerPricing(
  installerId: string,
  pricing: InstallerPricing
): Promise<PricingResult> {
  if (!installerId) {
    return { success: false, error: "No installer ID provided." };
  }

  try {
    // Verify Pro status
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_pro")
      .eq("id", installerId)
      .single();

    if (profileError || !profile) {
      return { success: false, error: "Installer not found." };
    }

    // Validate pricing values — must be positive numbers or undefined/null
    const validated: InstallerPricing = {};
    const fields: Exclude<keyof InstallerPricing, "mini_disabled">[] = [
      "standard_slot", "mini_slot",
      "standard_tote", "standard_tote_clear", "mini_tote",
      "standard_wheels", "mini_wheels",
      "plywood_top",
      "bestseller_indiana_joe", "bestseller_cornhusker", "bestseller_long_ranger",
    ];

    for (const field of fields) {
      const val = pricing[field];
      if (val !== undefined && val !== null) {
        const num = Number(val);
        if (isNaN(num) || num < 0) {
          return { success: false, error: `Invalid value for ${field}. Must be a positive number.` };
        }
        // Round to 2 decimal places
        validated[field] = Math.round(num * 100) / 100;
      }
      // undefined/null fields are omitted — they'll use platform defaults
    }

    // Carry over the mini_disabled boolean if set
    if (pricing.mini_disabled === true) {
      (validated as Record<string, unknown>).mini_disabled = true;
    }

    // Carry over addon_pricing if provided
    if (pricing.addon_pricing) {
      const ap = pricing.addon_pricing;
      const validatedAddon: Record<string, unknown> = {};

      // Validate numeric addon pricing fields
      const addonNumericFields = ["plywood_door", "side_panel", "concealed_hinge_pair", "rail_removal", "shelf", "paint_frame_price", "paint_doors_panels_price"] as const;
      for (const field of addonNumericFields) {
        const val = ap[field];
        if (val !== undefined && val !== null) {
          const num = Number(val);
          if (isNaN(num) || num < 0) {
            return { success: false, error: `Invalid addon pricing value for ${field}. Must be a non-negative number.` };
          }
          validatedAddon[field] = Math.round(num * 100) / 100;
        }
      }

      // Toggle booleans
      const addonToggleFields = [
        "organizer_customization_enabled",
        "plywood_door_enabled",
        "side_panel_enabled",
        "hinge_concealed_enabled",
        "rail_removal_enabled",
        "shelf_enabled",
        "paint_enabled",
      ] as const;
      for (const field of addonToggleFields) {
        if (ap[field] !== undefined) {
          validatedAddon[field] = ap[field];
        }
      }

      if (Object.keys(validatedAddon).length > 0) {
        (validated as Record<string, unknown>).addon_pricing = validatedAddon;
      }
    }

    // If all values match platform defaults, store null (use defaults)
    const hasCustomValues = fields.some(
      (f) => validated[f] !== undefined
    ) || (validated as Record<string, unknown>).mini_disabled === true
      || (validated as Record<string, unknown>).addon_pricing !== undefined;

    const pricingConfig = hasCustomValues ? validated : null;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ pricing_config: pricingConfig })
      .eq("id", installerId);

    if (updateError) {
      console.error("[Pricing Update] Error:", updateError);
      return { success: false, error: "Failed to save pricing." };
    }

    return { success: true, pricing: validated };
  } catch {
    return { success: false, error: "Failed to save pricing." };
  }
}

/**
 * Reset installer pricing to platform defaults.
 */
export async function resetInstallerPricing(
  installerId: string
): Promise<PricingResult> {
  if (!installerId) {
    return { success: false, error: "No installer ID provided." };
  }

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ pricing_config: null })
      .eq("id", installerId);

    if (error) {
      return { success: false, error: "Failed to reset pricing." };
    }

    return { success: true, pricing: {} };
  } catch {
    return { success: false, error: "Failed to reset pricing." };
  }
}
