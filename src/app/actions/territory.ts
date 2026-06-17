"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";
import zipcodes from "zipcodes";
import type { DeliveryFeeConfig } from "@/app/actions/delivery-fee";

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
// Manual ZIP Additions — installer-initiated, one at a time
//
// Lets an installer add a single extra ZIP (e.g. a regular customer just
// outside their normal cluster) without recomputing their whole territory.
// Bounded by the larger of their service_radius_miles and the farthest
// enabled delivery fee tier — if they've configured a fee tier that reaches
// further than their base radius, that's already a signal they're willing
// to travel that far for the right price, so manual adds are allowed out
// to that distance too.
// ═══════════════════════════════════════════════════════════════════════════

export interface AddServiceZipResult {
  success: boolean;
  zip?: string;
  distance?: number;
  feeTierLabel?: string | null;
  zips_covered?: number;
  error?: string;
}

export async function addServiceZip(
  installerId: string,
  zip: string
): Promise<AddServiceZipResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (user.id !== installerId) return { success: false, error: "Not authorized." };

  const trimmed = zip.trim();
  if (!/^\d{5}$/.test(trimmed)) {
    return { success: false, error: "Please enter a valid 5-digit ZIP code." };
  }

  const zipInfo = zipcodes.lookup(trimmed);
  if (!zipInfo) {
    return { success: false, error: "ZIP code not found." };
  }

  const supabase = getServiceClient();

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("service_zip, service_radius_miles, service_zips, delivery_fee_config")
    .eq("id", installerId)
    .single();

  if (!profileRow?.service_zip) {
    return { success: false, error: "Set your home base ZIP and service radius first." };
  }

  const currentZips: string[] = profileRow.service_zips ?? [];
  if (currentZips.includes(trimmed)) {
    return { success: false, error: `${trimmed} is already in your service area.` };
  }

  const distance = zipcodes.distance(profileRow.service_zip, trimmed);
  if (distance === null || distance === undefined) {
    return { success: false, error: "Could not calculate distance to that ZIP code." };
  }

  const baseRadius = profileRow.service_radius_miles ?? 25;

  const feeConfig = profileRow.delivery_fee_config as DeliveryFeeConfig | null;
  const enabledTiers = feeConfig?.enabled ? (feeConfig.tiers ?? []).filter((t) => t.enabled) : [];
  const maxTierMiles = enabledTiers.reduce((max, t) => Math.max(max, t.max_miles), 0);
  const maxAllowedRadius = Math.max(baseRadius, maxTierMiles);

  if (distance > maxAllowedRadius) {
    return {
      success: false,
      error: `${trimmed} is ${Math.round(distance)} mi away — outside your ${maxAllowedRadius} mi max service range (${
        maxTierMiles > baseRadius
          ? "based on your farthest delivery fee tier"
          : "expand your service radius or add a farther delivery fee tier to cover it"
      }).`,
    };
  }

  const matchedTier = [...enabledTiers]
    .sort((a, b) => a.max_miles - b.max_miles)
    .find((t) => distance <= t.max_miles);

  const { error: insertError } = await supabase
    .from("territory_zips")
    .upsert(
      { zip: trimmed, installer_id: installerId, is_home_zip: false, is_manual: true },
      { onConflict: "zip,installer_id", ignoreDuplicates: true }
    );

  if (insertError) {
    console.error("[Territory] Failed to add manual ZIP:", insertError);
    return { success: false, error: "Failed to add ZIP code. Please try again." };
  }

  const updatedZips = [...currentZips, trimmed];

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ service_zips: updatedZips })
    .eq("id", installerId);

  if (updateError) {
    console.error("[Territory] Failed to sync service_zips after manual add:", updateError);
    return { success: false, error: "Failed to save ZIP code. Please try again." };
  }

  return {
    success: true,
    zip: trimmed,
    distance: Math.round(distance),
    feeTierLabel: matchedTier?.label ?? null,
    zips_covered: updatedZips.length,
  };
}

export interface RemoveServiceZipResult {
  success: boolean;
  zips_covered?: number;
  error?: string;
}

export async function removeServiceZip(
  installerId: string,
  zip: string
): Promise<RemoveServiceZipResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (user.id !== installerId) return { success: false, error: "Not authorized." };

  const trimmed = zip.trim();
  const supabase = getServiceClient();

  const { data: row } = await supabase
    .from("territory_zips")
    .select("is_home_zip")
    .eq("zip", trimmed)
    .eq("installer_id", installerId)
    .maybeSingle();

  if (row?.is_home_zip) {
    return { success: false, error: "Can't remove your home base ZIP — change it in Service Area settings instead." };
  }

  const { error: deleteError } = await supabase
    .from("territory_zips")
    .delete()
    .eq("zip", trimmed)
    .eq("installer_id", installerId);

  if (deleteError) {
    console.error("[Territory] Failed to remove manual ZIP:", deleteError);
    return { success: false, error: "Failed to remove ZIP code. Please try again." };
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("service_zips")
    .eq("id", installerId)
    .single();

  const updatedZips = (profileRow?.service_zips ?? []).filter((z: string) => z !== trimmed);

  await supabase.from("profiles").update({ service_zips: updatedZips }).eq("id", installerId);

  return { success: true, zips_covered: updatedZips.length };
}

export interface ManualServiceZip {
  zip: string;
  assigned_at: string;
}

/**
 * List the ZIPs an installer added individually (is_manual = true) —
 * separate from the auto-assigned cluster, for display/management in
 * the profile's Service Area section.
 */
export async function getManualServiceZips(installerId: string): Promise<ManualServiceZip[]> {
  const supabase = getServiceClient();

  const { data } = await supabase
    .from("territory_zips")
    .select("zip, assigned_at")
    .eq("installer_id", installerId)
    .eq("is_manual", true)
    .order("assigned_at", { ascending: false });

  return data ?? [];
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
