"use server";

import { getServiceClient } from "@/lib/supabase-server";
import zipcodes from "zipcodes";

// ═══════════════════════════════════════════════════════════════════════════
// Delivery Fee Calculator — Server-side distance-based fee resolution
//
// Uses the `zipcodes` library to calculate distance between installer's
// service ZIP and customer ZIP, then matches against installer's delivery
// fee tiers to determine the applicable fee.
//
// Key rules:
//   - Delivery fee is NOT subject to sales tax
//   - Delivery fee IS included in the total for platform fee calculation
//   - Only enabled tiers are considered
// ═══════════════════════════════════════════════════════════════════════════

const supabase = getServiceClient();

export interface DeliveryFeeTier {
  max_miles: number;
  fee: number;
  enabled: boolean;
  label: string;
}

export interface IndoorDeliveryConfig {
  enabled: boolean;
  fee: number; // per-item fee in dollars (default $19)
}

export interface DeliveryFeeConfig {
  enabled: boolean;
  tiers: DeliveryFeeTier[];
  indoor_delivery?: IndoorDeliveryConfig;
}

export interface DeliveryFeeResult {
  applicable: boolean;
  fee: number;
  distance: number;
  tierLabel: string;
}

/**
 * Calculate the delivery fee for a customer ZIP given an installer ID.
 *
 * Returns { applicable: false } if:
 *   - Installer has no delivery fee config or it's disabled
 *   - No tier matches the calculated distance
 *   - ZIP codes can't be resolved
 */
export async function calculateDeliveryFee(
  installerId: string,
  customerZip: string
): Promise<DeliveryFeeResult> {
  const noFee: DeliveryFeeResult = { applicable: false, fee: 0, distance: 0, tierLabel: "" };

  if (!installerId || !customerZip) return noFee;

  const trimmedZip = customerZip.trim();
  if (!/^\d{5}$/.test(trimmedZip)) return noFee;

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("service_zip, delivery_fee_config")
      .eq("id", installerId)
      .single();

    if (!profile?.service_zip || !profile?.delivery_fee_config) return noFee;

    const config = profile.delivery_fee_config as DeliveryFeeConfig;
    if (!config.enabled || !config.tiers || config.tiers.length === 0) return noFee;

    // Calculate distance between installer ZIP and customer ZIP
    const distance = zipcodes.distance(profile.service_zip, trimmedZip);
    if (distance === null || distance === undefined) return noFee;

    // Find the matching tier (tiers should be sorted by max_miles ascending)
    const sortedTiers = [...config.tiers]
      .filter((t) => t.enabled)
      .sort((a, b) => a.max_miles - b.max_miles);

    for (const tier of sortedTiers) {
      if (distance <= tier.max_miles) {
        return {
          applicable: true,
          fee: tier.fee,
          distance: Math.round(distance),
          tierLabel: tier.label,
        };
      }
    }

    // Distance exceeds all tiers — no delivery fee applies
    // (this means the customer is beyond the farthest tier but still in service area)
    return noFee;
  } catch {
    return noFee;
  }
}

// ── Indoor Delivery Fee ─────────────────────────────────────────────────

const DEFAULT_INDOOR_FEE = 19;

/**
 * Fetch the installer's indoor delivery fee config.
 * Returns { enabled, fee } — default $19 per item if no custom config.
 */
export async function getIndoorDeliveryConfig(
  installerId: string
): Promise<IndoorDeliveryConfig> {
  const defaultConfig: IndoorDeliveryConfig = { enabled: true, fee: DEFAULT_INDOOR_FEE };

  if (!installerId) return defaultConfig;

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("delivery_fee_config, indoor_delivery_fee_config")
      .eq("id", installerId)
      .single();

    // Check the dedicated column first (new schema)
    if (profile?.indoor_delivery_fee_config) {
      const cfg = profile.indoor_delivery_fee_config as IndoorDeliveryConfig;
      if (typeof cfg.enabled === "boolean" && typeof cfg.fee === "number") {
        return cfg;
      }
    }

    // Fall back to sub-object in delivery_fee_config (legacy)
    if (profile?.delivery_fee_config) {
      const dfc = profile.delivery_fee_config as DeliveryFeeConfig;
      if (dfc.indoor_delivery && typeof dfc.indoor_delivery.enabled === "boolean") {
        return dfc.indoor_delivery;
      }
    }

    return defaultConfig;
  } catch {
    return defaultConfig;
  }
}
