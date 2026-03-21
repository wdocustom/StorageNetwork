"use server";

import { getServiceClient } from "@/lib/supabase-server";
import zipcodes from "zipcodes";

// ═══════════════════════════════════════════════════════════════════════════
// Territory System — ZIP-Cluster Model
//
// Each installer owns an exclusive cluster of ZIP codes. Cluster size
// adapts to population density:
//
//   Urban core (NYC, SF):  ~15 ZIPs within ~7 miles
//   Urban (Dallas, ATL):   ~25 ZIPs within ~12 miles
//   Suburban:               ~40 ZIPs within ~20 miles
//   Rural:                  ~60 ZIPs within ~35 miles
//
// Exclusivity is enforced by PRIMARY KEY on territory_zips.zip — it is
// physically impossible for two installers to own the same ZIP code.
//
// All customer-facing queries continue to use profiles.service_zips
// (GIN-indexed array). territory_zips is the source of truth;
// service_zips is a denormalized cache kept in sync.
// ═══════════════════════════════════════════════════════════════════════════

// ── Density tiers ──
// The "density probe" counts ZIPs within 10 miles of the home ZIP.
// More ZIPs = denser area = smaller territory (but plenty of customers).
const DENSITY_PROBE_RADIUS = 10; // miles

interface DensityTier {
  label: string;
  minDensityCount: number; // min ZIPs within probe radius to qualify
  targetZips: number;      // max ZIPs to assign
  searchRadiusMiles: number; // how far to look for candidate ZIPs
}

const DENSITY_TIERS: DensityTier[] = [
  // Order matters: checked top-to-bottom, first match wins
  { label: "urban_core", minDensityCount: 200, targetZips: 15, searchRadiusMiles: 7 },
  { label: "urban",      minDensityCount: 100, targetZips: 25, searchRadiusMiles: 12 },
  { label: "suburban",   minDensityCount: 40,  targetZips: 40, searchRadiusMiles: 20 },
  { label: "rural",      minDensityCount: 0,   targetZips: 60, searchRadiusMiles: 35 },
];

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

export interface TerritoryCheckResult {
  available: boolean;
  reason?: string;
  nearestInstaller?: {
    distance: number;
    city?: string;
    state?: string;
  };
  clusterPreview?: {
    estimatedZips: number;
    tier: string;
  };
}

/**
 * Check if a ZIP code is available as a new installer's home base.
 *
 * This checks the territory_zips table for the exact ZIP.
 * If available, it also returns a preview of how many ZIPs
 * the installer would get in their cluster.
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

  // ── Validate ZIP exists ──
  const zipInfo = zipcodes.lookup(trimmed);
  if (!zipInfo) {
    return { available: false, reason: "ZIP code not found." };
  }

  const supabase = getServiceClient();

  // ── Check if this ZIP is already claimed ──
  let query = supabase
    .from("territory_zips")
    .select("installer_id")
    .eq("zip", trimmed);

  if (excludeInstallerId) {
    query = query.neq("installer_id", excludeInstallerId);
  }

  const { data: existing, error } = await query.maybeSingle();

  if (error) {
    console.error("[Territory] DB query failed:", error);
    // Fail closed
    return {
      available: false,
      reason: "Unable to verify territory availability. Please try again.",
    };
  }

  if (existing) {
    // ZIP is claimed — find who owns it for a helpful message
    // (Don't reveal the installer's identity, just the general area)
    return {
      available: false,
      reason: `ZIP code ${trimmed} (${zipInfo.city}, ${zipInfo.state}) is already claimed by another installer.`,
      nearestInstaller: {
        distance: 0,
        city: zipInfo.city,
        state: zipInfo.state,
      },
    };
  }

  // ── ZIP is available — compute cluster preview ──
  const tier = detectDensityTier(trimmed);

  return {
    available: true,
    clusterPreview: {
      estimatedZips: tier.targetZips,
      tier: tier.label,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Cluster Assignment
// ═══════════════════════════════════════════════════════════════════════════

export interface ClusterAssignResult {
  success: boolean;
  assignedZips?: string[];
  tier?: string;
  error?: string;
}

/**
 * Assign an exclusive ZIP cluster to an installer.
 *
 * Flow:
 * 1. INSERT home ZIP into territory_zips (atomic claim via PRIMARY KEY)
 * 2. If home ZIP is already taken → fail immediately
 * 3. Compute density-aware cluster of nearby unclaimed ZIPs
 * 4. INSERT cluster ZIPs (ON CONFLICT DO NOTHING — skip any claimed)
 * 5. Update profiles.service_zips with actual assigned ZIPs
 *
 * The PRIMARY KEY on territory_zips.zip makes step 1 atomic.
 * No race condition is possible — the DB enforces uniqueness.
 */
export async function assignTerritoryCluster(
  installerId: string,
  homeZip: string
): Promise<ClusterAssignResult> {
  const trimmed = homeZip.trim();

  if (!/^\d{5}$/.test(trimmed)) {
    return { success: false, error: "Invalid ZIP code." };
  }

  const zipInfo = zipcodes.lookup(trimmed);
  if (!zipInfo) {
    return { success: false, error: "ZIP code not found." };
  }

  const supabase = getServiceClient();

  // ── Step 1: Claim home ZIP (atomic — PRIMARY KEY prevents duplicates) ──
  const { error: homeError } = await supabase
    .from("territory_zips")
    .insert({
      zip: trimmed,
      installer_id: installerId,
      is_home_zip: true,
    });

  if (homeError) {
    // 23505 = unique_violation (ZIP already exists in table)
    if (homeError.code === "23505") {
      return {
        success: false,
        error: `ZIP code ${trimmed} (${zipInfo.city}, ${zipInfo.state}) is already claimed by another installer.`,
      };
    }
    console.error("[Territory] Failed to claim home ZIP:", homeError);
    return { success: false, error: "Failed to claim territory. Please try again." };
  }

  // ── Step 2: Compute cluster ──
  const tier = detectDensityTier(trimmed);
  const candidateZips = zipcodes.radius(trimmed, tier.searchRadiusMiles) ?? [];

  // Get already-claimed ZIPs in this radius
  const { data: claimedRows } = await supabase
    .from("territory_zips")
    .select("zip")
    .in("zip", candidateZips);

  const claimedSet = new Set(claimedRows?.map((r) => r.zip) ?? []);
  // Home ZIP is already claimed (by us) — don't try to re-insert
  claimedSet.add(trimmed);

  // Sort candidates by distance (closest first), exclude claimed
  const sortedCandidates = candidateZips
    .filter((z) => !claimedSet.has(z))
    .map((z) => ({
      zip: z,
      dist: zipcodes.distance(trimmed, z) ?? Infinity,
    }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, tier.targetZips - 1); // -1 because home ZIP already counts

  // ── Step 3: Claim nearby ZIPs (best effort — skip any that got claimed) ──
  if (sortedCandidates.length > 0) {
    const rows = sortedCandidates.map((c) => ({
      zip: c.zip,
      installer_id: installerId,
      is_home_zip: false,
    }));

    // upsert with ignoreDuplicates = INSERT ... ON CONFLICT DO NOTHING
    // If another installer claimed a ZIP between our check and insert,
    // it's silently skipped — the installer just gets a slightly smaller cluster.
    await supabase
      .from("territory_zips")
      .upsert(rows, { onConflict: "zip", ignoreDuplicates: true });
  }

  // ── Step 4: Read back actual assigned ZIPs ──
  const { data: assignedRows } = await supabase
    .from("territory_zips")
    .select("zip")
    .eq("installer_id", installerId);

  const assignedZips = assignedRows?.map((r) => r.zip) ?? [trimmed];

  // ── Step 5: Sync profiles.service_zips (denormalized cache) ──
  await supabase
    .from("profiles")
    .update({
      service_zips: assignedZips,
      latitude: zipInfo.latitude,
      longitude: zipInfo.longitude,
    })
    .eq("id", installerId);

  console.log(
    `[Territory] Assigned ${assignedZips.length} ZIPs to installer ${installerId} ` +
    `(tier: ${tier.label}, home: ${trimmed}, ${zipInfo.city}, ${zipInfo.state})`
  );

  return {
    success: true,
    assignedZips,
    tier: tier.label,
  };
}

/**
 * Release all territory ZIPs owned by an installer.
 * Used when an installer changes their home ZIP.
 */
export async function releaseTerritoryCluster(
  installerId: string
): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await supabase
    .from("territory_zips")
    .delete()
    .eq("installer_id", installerId);

  if (error) {
    console.error("[Territory] Failed to release cluster:", error);
    throw new Error("Failed to release territory.");
  }

  // Clear the denormalized cache
  await supabase
    .from("profiles")
    .update({ service_zips: [] })
    .eq("id", installerId);

  console.log(`[Territory] Released all ZIPs for installer ${installerId}`);
}

/**
 * Get territory details for an installer.
 */
export async function getInstallerTerritory(
  installerId: string
): Promise<{ zips: string[]; homeZip: string | null; tier: string | null }> {
  const supabase = getServiceClient();

  const { data } = await supabase
    .from("territory_zips")
    .select("zip, is_home_zip")
    .eq("installer_id", installerId);

  if (!data || data.length === 0) {
    return { zips: [], homeZip: null, tier: null };
  }

  const homeRow = data.find((r) => r.is_home_zip);
  const homeZip = homeRow?.zip ?? null;
  const tier = homeZip ? detectDensityTier(homeZip).label : null;

  return {
    zips: data.map((r) => r.zip),
    homeZip,
    tier,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect the density tier for a ZIP code by counting how many
 * ZIPs exist within the probe radius.
 */
function detectDensityTier(zip: string): DensityTier {
  const probeZips = zipcodes.radius(zip, DENSITY_PROBE_RADIUS) ?? [];
  const density = probeZips.length;

  for (const tier of DENSITY_TIERS) {
    if (density >= tier.minDensityCount) {
      return tier;
    }
  }

  // Fallback (should never happen — last tier has minDensityCount: 0)
  return DENSITY_TIERS[DENSITY_TIERS.length - 1];
}
