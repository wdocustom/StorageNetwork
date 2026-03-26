"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { unstable_cache } from "next/cache";
import zipcodes from "zipcodes";

// ═══════════════════════════════════════════════════════════════════════════
// Installer Map — Public data for the interactive network map
//
// Fetches all active installers from BOTH sources:
//   1. profiles.service_zip (legacy onboarding)
//   2. installer_zip_codes table (new onboarding via /installers/join)
//
// Geocodes server-side using the `zipcodes` package. Returns one pin per
// installer using their first/primary ZIP for positioning.
// ═══════════════════════════════════════════════════════════════════════════

export interface MapInstaller {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  radiusMiles: number;
  isPro: boolean;
  avatarUrl: string | null;
  zipCount: number;
}

/**
 * Fetch all active installers with geocoded positions for the network map.
 * Pulls from both profiles.service_zip and installer_zip_codes to capture
 * installers from both the old and new onboarding flows.
 * Cached for 5 min via unstable_cache.
 */
export const getMapInstallers = unstable_cache(
  async (): Promise<MapInstaller[]> => {
    const supabase = getServiceClient();

    // 1. Get all non-suspended installer profiles
    const { data: profiles, error: profileErr } = await supabase
      .from("profiles")
      .select(
        "id, business_name, slug, city, state, service_zip, service_radius_miles, is_pro, avatar_url, is_suspended"
      )
      .eq("is_suspended", false);

    if (profileErr || !profiles) {
      console.error("[getMapInstallers] Profile fetch error:", profileErr?.message);
      return [];
    }

    // 2. Get all ZIP codes from installer_zip_codes table
    const profileIds = profiles.map((p) => p.id as string);
    let zipsByInstaller: Record<string, string[]> = {};

    if (profileIds.length > 0) {
      const { data: zipRows } = await supabase
        .from("installer_zip_codes")
        .select("installer_id, zip_code")
        .in("installer_id", profileIds);

      if (zipRows) {
        for (const row of zipRows) {
          const iid = row.installer_id as string;
          if (!zipsByInstaller[iid]) zipsByInstaller[iid] = [];
          zipsByInstaller[iid].push(row.zip_code as string);
        }
      }
    }

    // 3. Build map pins — use first available ZIP from either source
    const results: MapInstaller[] = [];
    const seen = new Set<string>();

    for (const row of profiles) {
      const id = row.id as string;
      if (seen.has(id)) continue;

      // Collect all ZIPs for this installer
      const installerZips = zipsByInstaller[id] || [];
      const legacyZip = row.service_zip as string | null;

      // Pick the best ZIP for map positioning:
      // prefer installer_zip_codes (newer), fall back to service_zip (legacy)
      const primaryZip = installerZips[0] || legacyZip;
      if (!primaryZip) continue;

      const geo = zipcodes.lookup(primaryZip);
      if (!geo) continue;

      seen.add(id);
      results.push({
        id,
        name: (row.business_name as string) || "Storage Network Installer",
        slug: (row.slug as string) || null,
        city: (row.city as string) || geo.city || null,
        state: (row.state as string) || geo.state || null,
        lat: geo.latitude,
        lng: geo.longitude,
        radiusMiles: (row.service_radius_miles as number) || 25,
        isPro: !!(row.is_pro),
        avatarUrl: (row.avatar_url as string) || null,
        zipCount: installerZips.length || (legacyZip ? 1 : 0),
      });
    }

    return results;
  },
  ["map-installers"],
  { revalidate: 300 }
);
