"use server";

import { getServiceClient } from "@/lib/supabase-server";
import type { InstallerPricing } from "@/types/viewModels";
import { invalidateInstallerCacheForUser } from "@/lib/cache";
import { roundMoney } from "@/utils/mathHelpers";

// ═══════════════════════════════════════════════════════════════════════════
// Pricing — Server actions for installer custom pricing
// ═══════════════════════════════════════════════════════════════════════════

const supabase = getServiceClient();

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
    // Verify Pro status and fetch slug for cache invalidation
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_pro, slug, ref_slug")
      .eq("id", installerId)
      .single();

    if (profileError || !profile) {
      return { success: false, error: "Installer not found." };
    }

    // Validate pricing values — must be positive numbers or undefined/null
    const validated: InstallerPricing = {};
    const fields: Exclude<keyof InstallerPricing, "mini_disabled" | "mini_enabled" | "open_shelving_disabled" | "open_shelving_enabled" | "overhead_storage_enabled" | "raised_bed_enabled" | "adirondack_chair_enabled" | "use_2x4_rails" | "bestseller_indiana_joe_disabled" | "bestseller_long_ranger_disabled" | "bestseller_gas_station_disabled" | "addon_pricing">[] = [
      "standard_slot", "mini_slot",
      "standard_tote", "standard_tote_clear", "mini_tote",
      "standard_wheels", "mini_wheels",
      "plywood_top",
      "bestseller_indiana_joe", "bestseller_long_ranger",
      "bestseller_gas_station", "bestseller_track_norris",
      "bestseller_rack_city_roller", "bestseller_mayor_of_rack_city",
      "shelving_shelf_4ft_short", "shelving_shelf_5ft_short", "shelving_shelf_6ft_short",
      "shelving_shelf_4ft_tall", "shelving_shelf_5ft_tall", "shelving_shelf_6ft_tall",
      "overhead_2x2", "overhead_2x3", "overhead_3x2",
      "overhead_3x3", "overhead_3x4", "overhead_4x4",
      "adirondack_chair",
      "adirondack_chair_paint_addon",
    ];

    for (const field of fields) {
      const val = pricing[field];
      if (val !== undefined && val !== null) {
        const num = Number(val);
        if (isNaN(num) || num < 0) {
          return { success: false, error: `Invalid value for ${field}. Must be a positive number.` };
        }
        // Round to 2 decimal places
        (validated as Record<string, number>)[field] = roundMoney(num);
      }
      // undefined/null fields are omitted — they'll use platform defaults
    }

    // Carry over boolean toggles if set (opt-in: features are OFF by default)
    if (pricing.totes_disabled === true) {
      (validated as Record<string, unknown>).totes_disabled = true;
    }
    if (pricing.mini_enabled === true) {
      (validated as Record<string, unknown>).mini_enabled = true;
    }
    if (pricing.open_shelving_enabled === true) {
      (validated as Record<string, unknown>).open_shelving_enabled = true;
    }
    if (pricing.overhead_storage_enabled === true) {
      (validated as Record<string, unknown>).overhead_storage_enabled = true;
    }
    if (pricing.raised_bed_enabled === true) {
      (validated as Record<string, unknown>).raised_bed_enabled = true;
    }
    if (pricing.adirondack_chair_enabled === true) {
      (validated as Record<string, unknown>).adirondack_chair_enabled = true;
    }
    if (pricing.use_2x4_rails === true) {
      (validated as Record<string, unknown>).use_2x4_rails = true;
    }
    for (const bk of ["bestseller_indiana_joe_disabled", "bestseller_long_ranger_disabled", "bestseller_gas_station_disabled", "bestseller_track_norris_disabled", "bestseller_rack_city_roller_disabled", "bestseller_mayor_of_rack_city_disabled"] as const) {
      if (pricing[bk] === true) {
        (validated as Record<string, unknown>)[bk] = true;
      }
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
          validatedAddon[field] = roundMoney(num);
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

    // Carry over slot_volume_discount_config if provided
    if (pricing.slot_volume_discount_config) {
      const vc = pricing.slot_volume_discount_config;
      const validatedTiers: { min_slots: number; max_slots: number; price_per_slot: number }[] = [];

      for (const tier of vc.tiers ?? []) {
        const minSlots = Number(tier.min_slots);
        const maxSlots = Number(tier.max_slots);
        const pricePerSlot = Number(tier.price_per_slot);
        if (
          isNaN(minSlots) || isNaN(maxSlots) || isNaN(pricePerSlot) ||
          minSlots < 1 || maxSlots < minSlots || pricePerSlot < 0
        ) {
          return { success: false, error: "Invalid volume discount tier. Check min/max slots and price." };
        }
        validatedTiers.push({
          min_slots: Math.round(minSlots),
          max_slots: Math.round(maxSlots),
          price_per_slot: roundMoney(pricePerSlot),
        });
      }
      validatedTiers.sort((a, b) => a.min_slots - b.min_slots);

      (validated as Record<string, unknown>).slot_volume_discount_config = {
        enabled: vc.enabled === true,
        tiers: validatedTiers,
      };
    }

    // If all values match platform defaults, store null (use defaults)
    const v = validated as Record<string, unknown>;
    const hasCustomValues = fields.some(
      (f) => validated[f] !== undefined
    ) || v.mini_disabled === true
      || v.open_shelving_disabled === true
      || v.bestseller_indiana_joe_disabled === true
      || v.bestseller_long_ranger_disabled === true
      || v.bestseller_gas_station_disabled === true
      || v.addon_pricing !== undefined
      || v.slot_volume_discount_config !== undefined;

    const pricingConfig = hasCustomValues ? validated : null;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ pricing_config: pricingConfig })
      .eq("id", installerId);

    if (updateError) {
      console.error("[Pricing Update] Error:", updateError);
      return { success: false, error: "Failed to save pricing." };
    }

    // Invalidate installer cache so /design pages pick up changes immediately
    const slug = (profile as Record<string, unknown>).slug as string | null;
    const refSlug = (profile as Record<string, unknown>).ref_slug as string | null;
    await invalidateInstallerCacheForUser(installerId, slug, refSlug);

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
