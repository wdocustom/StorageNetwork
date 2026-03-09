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


export interface DeliveryFeeTier {
  max_miles: number;
  fee: number;
  enabled: boolean;
  label: string;
}

export interface DeliveryFeeConfig {
  enabled: boolean;
  tiers: DeliveryFeeTier[];
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
    const { data: profile } = await getServiceClient()
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
