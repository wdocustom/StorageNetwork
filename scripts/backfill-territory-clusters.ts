/**
 * One-time backfill: Assign ZIP clusters to existing installers.
 *
 * Run this AFTER migration 072 (which creates the territory_zips table
 * and backfills home ZIPs). This script computes the full density-aware
 * cluster for each installer and updates their service_zips array.
 *
 * Safe to run multiple times — uses ON CONFLICT DO NOTHING for ZIPs
 * and only updates profiles that need it.
 *
 * Run:
 *   npx tsx scripts/backfill-territory-clusters.ts
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import zipcodes from "zipcodes";
import "dotenv/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

// ── Density tiers (must match territory.ts) ──
const DENSITY_PROBE_RADIUS = 10;

const DENSITY_TIERS = [
  { label: "urban_core", minDensityCount: 200, targetZips: 15, searchRadiusMiles: 7 },
  { label: "urban",      minDensityCount: 100, targetZips: 25, searchRadiusMiles: 12 },
  { label: "suburban",   minDensityCount: 40,  targetZips: 40, searchRadiusMiles: 20 },
  { label: "rural",      minDensityCount: 0,   targetZips: 60, searchRadiusMiles: 35 },
];

function detectDensityTier(zip: string) {
  const probeZips = zipcodes.radius(zip, DENSITY_PROBE_RADIUS) ?? [];
  const density = probeZips.length;
  for (const tier of DENSITY_TIERS) {
    if (density >= tier.minDensityCount) return tier;
  }
  return DENSITY_TIERS[DENSITY_TIERS.length - 1];
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Territory Cluster Backfill");
  console.log("═══════════════════════════════════════════════════════\n");

  // 1. Fetch all installers with a home ZIP
  const { data: installers, error } = await supabase
    .from("profiles")
    .select("id, business_name, service_zip, is_suspended")
    .not("service_zip", "is", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch installers:", error.message);
    process.exit(1);
  }

  if (!installers || installers.length === 0) {
    console.log("No installers found. Nothing to backfill.");
    return;
  }

  console.log(`Found ${installers.length} installer(s) to process.\n`);

  // 2. Get all currently claimed ZIPs
  const { data: existingClaimed } = await supabase
    .from("territory_zips")
    .select("zip, installer_id");

  const claimedByZip = new Map<string, string>();
  for (const row of existingClaimed ?? []) {
    claimedByZip.set(row.zip, row.installer_id);
  }

  console.log(`${claimedByZip.size} ZIP(s) already claimed in territory_zips.\n`);

  // 3. Process each installer
  for (const installer of installers) {
    const homeZip = installer.service_zip;
    const name = installer.business_name || installer.id;

    if (!homeZip || homeZip.length !== 5) {
      console.log(`⏩ Skipping ${name} — invalid service_zip: "${homeZip}"`);
      continue;
    }

    const zipInfo = zipcodes.lookup(homeZip);
    if (!zipInfo) {
      console.log(`⏩ Skipping ${name} — ZIP ${homeZip} not found in zipcodes database`);
      continue;
    }

    // Check if home ZIP is already claimed by someone else
    const homeOwner = claimedByZip.get(homeZip);
    if (homeOwner && homeOwner !== installer.id) {
      console.log(`⚠️  ${name} — home ZIP ${homeZip} is claimed by another installer. Skipping.`);
      continue;
    }

    // Ensure home ZIP is in territory_zips
    if (!homeOwner) {
      const { error: homeErr } = await supabase
        .from("territory_zips")
        .upsert(
          { zip: homeZip, installer_id: installer.id, is_home_zip: true },
          { onConflict: "zip", ignoreDuplicates: true }
        );

      if (homeErr) {
        console.log(`⚠️  ${name} — failed to claim home ZIP ${homeZip}: ${homeErr.message}`);
        continue;
      }
      claimedByZip.set(homeZip, installer.id);
    }

    // Compute cluster
    const tier = detectDensityTier(homeZip);
    const candidates = zipcodes.radius(homeZip, tier.searchRadiusMiles) ?? [];

    const unclaimed = candidates
      .filter((z) => {
        const owner = claimedByZip.get(z);
        return !owner || owner === installer.id; // available or already ours
      })
      .filter((z) => z !== homeZip)
      .map((z) => ({
        zip: z,
        dist: zipcodes.distance(homeZip, z) ?? Infinity,
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, tier.targetZips - 1);

    // Insert cluster ZIPs
    if (unclaimed.length > 0) {
      const rows = unclaimed.map((c) => ({
        zip: c.zip,
        installer_id: installer.id,
        is_home_zip: false,
      }));

      await supabase
        .from("territory_zips")
        .upsert(rows, { onConflict: "zip", ignoreDuplicates: true });

      // Mark these as claimed
      for (const c of unclaimed) {
        claimedByZip.set(c.zip, installer.id);
      }
    }

    // Read back actual assigned ZIPs
    const { data: assigned } = await supabase
      .from("territory_zips")
      .select("zip")
      .eq("installer_id", installer.id);

    const assignedZips = assigned?.map((r) => r.zip) ?? [homeZip];

    // Update profiles.service_zips + lat/lng
    await supabase
      .from("profiles")
      .update({
        service_zips: assignedZips,
        latitude: zipInfo.latitude,
        longitude: zipInfo.longitude,
      })
      .eq("id", installer.id);

    console.log(
      `✅ ${name} — ${homeZip} (${zipInfo.city}, ${zipInfo.state}) — ` +
      `${assignedZips.length} ZIPs assigned (${tier.label})`
    );
  }

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  Backfill complete!");
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch(console.error);
