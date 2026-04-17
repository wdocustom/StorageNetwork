"use server";

import { getServiceClient } from "@/lib/supabase-server";
import zipcodes from "zipcodes";

// ═══════════════════════════════════════════════════════════════════════════
// Territory System — Shared ZIP-Cluster Model with Tiered Priority
//
// Multiple installers can cover the same ZIP codes. Cluster size
// adapts to population density:
//
//   Urban core (NYC, SF):  ~15 ZIPs within ~7 miles
//   Urban (Dallas, ATL):   ~25 ZIPs within ~12 miles
//   Suburban:               ~40 ZIPs within ~20 miles
//   Rural:                  ~60 ZIPs within ~35 miles
//
// When multiple installers share a ZIP, leads are routed via tiered
// priority: Pro > Basic, then by completed_jobs DESC, then by
// current_month_leads ASC (fair distribution).
//
// PRIMARY KEY is (zip, installer_id) — each installer can claim a ZIP
// once, but multiple installers can share the same ZIP.
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
  existingInstallerCount?: number;
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
 * Check territory status for a ZIP code.
 *
 * Shared territories: always returns available=true for valid ZIPs.
 * Also reports how many installers already cover this ZIP so the
 * signup UI can show informational messaging.
 */
export async function checkTerritoryAvailability(
  zip: string,
  excludeInstallerId?: string
): Promise<TerritoryCheckResult> {
  const trimmed = zip.trim();

  if (!/^\d{5}$/.test(trimmed)) {
    return { available: false, reason: "Invalid ZIP code format." };
  }

  const zipInfo = zipcodes.lookup(trimmed);
  if (!zipInfo) {
    return { available: false, reason: "ZIP code not found." };
  }

  const supabase = getServiceClient();

  let query = supabase
    .from("territory_zips")
    .select("installer_id")
    .eq("zip", trimmed);

  if (excludeInstallerId) {
    query = query.neq("installer_id", excludeInstallerId);
  }

  const { data: existing, error } = await query;

  if (error) {
    console.error("[Territory] DB query failed:", error);
    return {
      available: false,
      reason: "Unable to verify territory availability. Please try again.",
    };
  }

  const tier = detectDensityTier(trimmed);
  const existingCount = existing?.length ?? 0;

  return {
    available: true,
    existingInstallerCount: existingCount,
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
 * Assign a ZIP cluster to an installer.
 *
 * Shared territories: multiple installers can cover the same ZIPs.
 * The composite PK (zip, installer_id) prevents an installer from
 * claiming the same ZIP twice, but allows different installers to
 * share ZIPs freely.
 *
 * Flow:
 * 1. INSERT home ZIP into territory_zips
 * 2. Compute density-aware cluster of nearby ZIPs
 * 3. INSERT cluster ZIPs (ON CONFLICT DO NOTHING for this installer)
 * 4. Update profiles.service_zips with assigned ZIPs
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

  // ── Step 1: Claim home ZIP ──
  const { error: homeError } = await supabase
    .from("territory_zips")
    .upsert(
      { zip: trimmed, installer_id: installerId, is_home_zip: true },
      { onConflict: "zip,installer_id", ignoreDuplicates: true }
    );

  if (homeError) {
    console.error("[Territory] Failed to claim home ZIP:", homeError);
    return { success: false, error: "Failed to claim territory. Please try again." };
  }

  // ── Step 2: Compute cluster ──
  const tier = detectDensityTier(trimmed);
  const candidateZips = zipcodes.radius(trimmed, tier.searchRadiusMiles) ?? [];

  // Get this installer's already-claimed ZIPs in this radius
  const { data: ownedRows } = await supabase
    .from("territory_zips")
    .select("zip")
    .eq("installer_id", installerId)
    .in("zip", candidateZips);

  const ownedSet = new Set(ownedRows?.map((r) => r.zip) ?? []);
  ownedSet.add(trimmed);

  // Sort candidates by distance (closest first), exclude already owned by this installer
  const sortedCandidates = candidateZips
    .filter((z) => !ownedSet.has(z))
    .map((z) => ({
      zip: z,
      dist: zipcodes.distance(trimmed, z) ?? Infinity,
    }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, tier.targetZips - 1);

  // ── Step 3: Claim nearby ZIPs ──
  if (sortedCandidates.length > 0) {
    const rows = sortedCandidates.map((c) => ({
      zip: c.zip,
      installer_id: installerId,
      is_home_zip: false,
    }));

    await supabase
      .from("territory_zips")
      .upsert(rows, { onConflict: "zip,installer_id", ignoreDuplicates: true });
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

/**
 * Expand an incomplete territory cluster.
 *
 * Adds nearby ZIPs to fill the cluster to the expected size for the
 * installer's density tier. Shared territories: other installers may
 * already cover these ZIPs — that's fine.
 *
 * Idempotent — safe to call multiple times. Skips if cluster already full.
 */
export async function expandTerritoryCluster(
  installerId: string,
  homeZip: string
): Promise<{ assignedZips: string[] }> {
  const trimmed = homeZip.trim();
  const supabase = getServiceClient();

  const { data: currentRows } = await supabase
    .from("territory_zips")
    .select("zip")
    .eq("installer_id", installerId);

  const currentZips = new Set(currentRows?.map((r) => r.zip) ?? []);

  if (currentZips.size === 0) {
    await supabase
      .from("territory_zips")
      .upsert(
        { zip: trimmed, installer_id: installerId, is_home_zip: true },
        { onConflict: "zip,installer_id", ignoreDuplicates: true }
      );
    currentZips.add(trimmed);
  }

  const tier = detectDensityTier(trimmed);

  if (currentZips.size >= tier.targetZips) {
    return { assignedZips: Array.from(currentZips) };
  }

  const candidateZips = zipcodes.radius(trimmed, tier.searchRadiusMiles) ?? [];

  // Only exclude ZIPs this installer already owns
  const slotsNeeded = tier.targetZips - currentZips.size;
  const newCandidates = candidateZips
    .filter((z) => !currentZips.has(z))
    .map((z) => ({ zip: z, dist: zipcodes.distance(trimmed, z) ?? Infinity }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, slotsNeeded);

  if (newCandidates.length > 0) {
    await supabase
      .from("territory_zips")
      .upsert(
        newCandidates.map((c) => ({
          zip: c.zip,
          installer_id: installerId,
          is_home_zip: false,
        })),
        { onConflict: "zip,installer_id", ignoreDuplicates: true }
      );
  }

  const { data: finalRows } = await supabase
    .from("territory_zips")
    .select("zip")
    .eq("installer_id", installerId);

  const assignedZips = finalRows?.map((r) => r.zip) ?? [trimmed];

  const zipInfo = zipcodes.lookup(trimmed);
  await supabase
    .from("profiles")
    .update({
      service_zips: assignedZips,
      latitude: zipInfo?.latitude ?? null,
      longitude: zipInfo?.longitude ?? null,
    })
    .eq("id", installerId);

  console.log(
    `[Territory] Expanded cluster for ${installerId}: ${currentZips.size} → ${assignedZips.length} ZIPs ` +
    `(tier: ${tier.label}, home: ${trimmed})`
  );

  return { assignedZips };
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
