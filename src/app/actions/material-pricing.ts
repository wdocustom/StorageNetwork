"use server";

import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Material Pricing — Server actions for installer material cost configuration
//
// Manages per-installer wholesale/material pricing and custom screw packaging.
// Stored in profiles.material_pricing_config (JSONB).
// ═══════════════════════════════════════════════════════════════════════════

const supabase = getServiceClient();

/** Custom screw/bolt package — installer buys in bulk at a custom qty & price */
export interface ScrewPackage {
  count: number;  // e.g. 1000 screws in a 25 lbs bucket
  price: number;  // e.g. $45.00 for the whole package
  label?: string; // e.g. "25 lbs bucket"
}

/** Full material pricing config stored in DB */
export interface MaterialPricingConfig {
  // Simple price overrides (per-unit)
  lumber_2x4_8ft?: number;
  plywood_sheet?: number;
  tote?: number;
  wheels_4pk?: number;
  // Custom screw/bolt packages (count + price per package)
  screw_1in?: ScrewPackage;
  screw_1_5_8in?: ScrewPackage;
  screw_3in?: ScrewPackage;
  overhead_lag_bolt?: ScrewPackage;
  overhead_structural_screw?: ScrewPackage;
}

interface Result {
  success: boolean;
  config?: MaterialPricingConfig;
  error?: string;
}

const SCREW_KEYS = [
  "screw_1in",
  "screw_1_5_8in",
  "screw_3in",
  "overhead_lag_bolt",
  "overhead_structural_screw",
] as const;

const SIMPLE_KEYS = [
  "lumber_2x4_8ft",
  "plywood_sheet",
  "tote",
  "wheels_4pk",
] as const;

/** Load installer's material pricing config. */
export async function getMaterialPricing(installerId: string): Promise<Result> {
  if (!installerId) return { success: false, error: "No installer ID." };

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("material_pricing_config")
      .eq("id", installerId)
      .single();

    if (error || !data) return { success: false, error: "Installer not found." };

    return {
      success: true,
      config: (data.material_pricing_config as MaterialPricingConfig) ?? {},
    };
  } catch {
    return { success: false, error: "Failed to load material pricing." };
  }
}

/** Save installer's material pricing config. Validates all values. */
export async function saveMaterialPricing(
  installerId: string,
  config: MaterialPricingConfig,
): Promise<Result> {
  if (!installerId) return { success: false, error: "No installer ID." };

  try {
    const validated: MaterialPricingConfig = {};

    // Validate simple price fields
    for (const key of SIMPLE_KEYS) {
      const val = config[key];
      if (val !== undefined && val !== null) {
        const num = Number(val);
        if (isNaN(num) || num < 0) {
          return { success: false, error: `Invalid value for ${key}.` };
        }
        validated[key] = Math.round(num * 100) / 100;
      }
    }

    // Validate screw packages
    for (const key of SCREW_KEYS) {
      const pkg = config[key];
      if (pkg && typeof pkg === "object") {
        const count = Number(pkg.count);
        const price = Number(pkg.price);
        if (isNaN(count) || count < 1) {
          return { success: false, error: `Invalid count for ${key}. Must be at least 1.` };
        }
        if (isNaN(price) || price < 0) {
          return { success: false, error: `Invalid price for ${key}.` };
        }
        validated[key] = {
          count: Math.round(count),
          price: Math.round(price * 100) / 100,
          label: pkg.label?.trim() || undefined,
        };
      }
    }

    const hasValues =
      SIMPLE_KEYS.some((k) => validated[k] !== undefined) ||
      SCREW_KEYS.some((k) => validated[k] !== undefined);

    const { error } = await supabase
      .from("profiles")
      .update({ material_pricing_config: hasValues ? validated : null })
      .eq("id", installerId);

    if (error) {
      console.error("[MaterialPricing] Save failed:", error);
      return { success: false, error: `Failed to save: ${error.message}` };
    }

    return { success: true, config: validated };
  } catch (err) {
    console.error("[MaterialPricing] Exception:", err);
    return { success: false, error: `Failed to save material pricing: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** Reset material pricing to defaults (clear all custom values). */
export async function resetMaterialPricing(installerId: string): Promise<Result> {
  if (!installerId) return { success: false, error: "No installer ID." };

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ material_pricing_config: null })
      .eq("id", installerId);

    if (error) return { success: false, error: "Failed to reset." };
    return { success: true, config: {} };
  } catch {
    return { success: false, error: "Failed to reset material pricing." };
  }
}
