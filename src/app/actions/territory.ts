"use server";

import { getServiceClient } from "@/lib/supabase-server";
import zipcodes from "zipcodes";

// ═══════════════════════════════════════════════════════════════════════════
// Territory Exclusivity — Enforces 85-mile minimum distance between
// installer home bases (service_zip). No two installers can operate
// within 85 miles of each other.
//
// This is the Node.js layer of defense. A PostgreSQL trigger
// (migration 072) provides a database-level safety net for race conditions.
// ═══════════════════════════════════════════════════════════════════════════

const TERRITORY_RADIUS_MILES = 85;

export interface TerritoryCheckResult {
  available: boolean;
  reason?: string;
  nearestInstaller?: {
    distance: number;
    city?: string;
    state?: string;
  };
}

/**
 * Check if a ZIP code is available for a new installer to claim.
 *
 * Rules:
 * - No active (non-suspended) installer can have their service_zip
 *   within 85 miles of the requested ZIP.
 * - The `excludeInstallerId` param allows an installer to update
 *   their own ZIP without conflicting with themselves.
 *
 * Uses zipcodes.distance() which computes great-circle (haversine)
 * distance between ZIP code centroids.
 */
export async function checkTerritoryAvailability(
  zip: string,
  excludeInstallerId?: string
): Promise<TerritoryCheckResult> {
  const trimmed = zip.trim();

  // ── Validate ZIP format ──
  if (!/^\d{5}$/.test(trimmed)) {
    return { available: false, reason: "Invalid ZIP code format." };
  }

  // ── Validate ZIP exists in database ──
  const zipInfo = zipcodes.lookup(trimmed);
  if (!zipInfo) {
    return { available: false, reason: "ZIP code not found." };
  }

  const supabase = getServiceClient();

  // ── Fetch all active installers with a service_zip ──
  let query = supabase
    .from("profiles")
    .select("id, service_zip, business_name, is_suspended")
    .not("service_zip", "is", null)
    .eq("is_suspended", false);

  // Exclude self when updating own profile
  if (excludeInstallerId) {
    query = query.neq("id", excludeInstallerId);
  }

  const { data: installers, error } = await query;

  if (error) {
    console.error("[Territory] Failed to query installers:", error);
    // Fail closed — if we can't verify, don't allow
    return {
      available: false,
      reason: "Unable to verify territory availability. Please try again.",
    };
  }

  if (!installers || installers.length === 0) {
    // No installers exist yet — territory is wide open
    return { available: true };
  }

  // ── Check distance to every active installer ──
  let nearestDistance = Infinity;
  let nearestCity: string | undefined;
  let nearestState: string | undefined;

  for (const installer of installers) {
    if (!installer.service_zip) continue;

    const distance = zipcodes.distance(trimmed, installer.service_zip);

    // zipcodes.distance() returns null if either ZIP is invalid
    if (distance === null) continue;

    if (distance < nearestDistance) {
      nearestDistance = distance;
      const installerZipInfo = zipcodes.lookup(installer.service_zip);
      nearestCity = installerZipInfo?.city;
      nearestState = installerZipInfo?.state;
    }

    if (distance < TERRITORY_RADIUS_MILES) {
      const conflictZipInfo = zipcodes.lookup(installer.service_zip);
      return {
        available: false,
        reason: `This territory is within ${Math.round(distance)} miles of an existing installer. Territories require ${TERRITORY_RADIUS_MILES}-mile minimum spacing.`,
        nearestInstaller: {
          distance: Math.round(distance),
          city: conflictZipInfo?.city,
          state: conflictZipInfo?.state,
        },
      };
    }
  }

  return { available: true };
}
