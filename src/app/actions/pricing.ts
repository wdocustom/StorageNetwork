"use server";

import { createClient } from "@supabase/supabase-js";
import type { InstallerPricing } from "@/types/viewModels";

// ═══════════════════════════════════════════════════════════════════════════
// Pricing — Server actions for installer custom pricing (Pro feature)
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

    if (!data.is_pro) {
      return { success: false, error: "Custom pricing requires a Pro subscription." };
    }

    const pricing = (data.pricing_config as InstallerPricing) ?? {};
    return { success: true, pricing };
  } catch {
    return { success: false, error: "Failed to load pricing." };
  }
}

/**
 * Save installer's custom pricing config.
 * Only Pro installers can set custom pricing.
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

    if (!profile.is_pro) {
      return { success: false, error: "Custom pricing requires a Pro subscription." };
    }

    // Validate pricing values — must be positive numbers or undefined/null
    const validated: InstallerPricing = {};
    const fields: (keyof InstallerPricing)[] = [
      "standard_slot", "mini_slot",
      "standard_tote", "standard_tote_clear", "mini_tote",
      "standard_wheels", "mini_wheels",
      "plywood_top",
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

    // If all values match platform defaults, store null (use defaults)
    const hasCustomValues = fields.some(
      (f) => validated[f] !== undefined
    );

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
