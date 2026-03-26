"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { unstable_cache } from "next/cache";
import zipcodes from "zipcodes";

// ═══════════════════════════════════════════════════════════════════════════
// Installer Map — Public data for the interactive network map
//
// Strategy:
//   1. Get all installer user IDs from user_roles
//   2. Get their profiles (which contain service_zip and service_zips array)
//   3. Geocode primary ZIP via zipcodes package (offline, no API)
//
// The service_zips array on profiles is the denormalized cache of each
// installer's territory. service_zip is their home/base ZIP.
//
// Cached 5 min via unstable_cache for ISR.
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

export const getMapInstallers = unstable_cache(
  async (): Promise<MapInstaller[]> => {
    const supabase = getServiceClient();

    // 1. Get all installer user IDs
    const { data: roles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "installer");

    if (rolesErr || !roles || roles.length === 0) {
      console.error("[getMapInstallers] Roles query:", rolesErr?.message || "no installers found");
      return [];
    }

    const installerIds = roles.map((r) => r.user_id as string);
    console.log(`[getMapInstallers] Found ${installerIds.length} installer role(s)`);

    // 2. Get profiles — filter out suspended/inactive
    const { data: profiles, error: profileErr } = await supabase
      .from("profiles")
      .select(
        "id, business_name, first_name, last_name, slug, city, state, service_zip, service_zips, service_radius_miles, is_pro, avatar_url, is_suspended, status"
      )
      .in("id", installerIds);

    if (profileErr) {
      console.error("[getMapInstallers] Profile fetch error:", profileErr.message);
      return [];
    }

    console.log(`[getMapInstallers] Found ${(profiles || []).length} matching profile(s)`);

    // 3. Build map pins
    const results: MapInstaller[] = [];

    for (const row of profiles || []) {
      // Skip suspended or inactive
      if (row.is_suspended === true) continue;
      if ((row.status as string) === "inactive") continue;

      // Get ZIP — prefer service_zip (home base), fall back to first service_zips entry
      const serviceZips = (row.service_zips as string[]) || [];
      const primaryZip = (row.service_zip as string) || serviceZips[0];

      if (!primaryZip) {
        console.log(`[getMapInstallers] Skipping ${row.id} — no ZIP`);
        continue;
      }

      const geo = zipcodes.lookup(primaryZip);
      if (!geo) {
        console.log(`[getMapInstallers] Skipping ${row.id} — ZIP ${primaryZip} not geocodable`);
        continue;
      }

      const name =
        (row.business_name as string) ||
        [row.first_name, row.last_name].filter(Boolean).join(" ") ||
        "Storage Network Installer";

      results.push({
        id: row.id as string,
        name,
        slug: (row.slug as string) || null,
        city: (row.city as string) || geo.city || null,
        state: (row.state as string) || geo.state || null,
        lat: geo.latitude,
        lng: geo.longitude,
        radiusMiles: (row.service_radius_miles as number) || 25,
        isPro: !!(row.is_pro),
        avatarUrl: (row.avatar_url as string) || null,
        zipCount: serviceZips.length || (primaryZip ? 1 : 0),
      });
    }

    console.log(`[getMapInstallers] Returning ${results.length} geocoded installer(s)`);
    return results;
  },
  ["map-installers"],
  { revalidate: 300 }
);
