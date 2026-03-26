"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { unstable_cache } from "next/cache";
import zipcodes from "zipcodes";

// ═══════════════════════════════════════════════════════════════════════════
// Installer Map — Public data for the interactive network map
//
// Strategy:
//   1. Start from user_roles (role = 'installer') — source of truth
//   2. Join to profiles for name/slug/avatar
//   3. Pull ZIPs from installer_zip_codes (primary) + profiles.service_zip (legacy)
//   4. Geocode via zipcodes package (offline, no API)
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
      console.error("[getMapInstallers] Roles query:", rolesErr?.message || "no installers");
      return [];
    }

    const installerIds = roles.map((r) => r.user_id as string);

    // 2. Get profiles for these installers
    const { data: profiles, error: profileErr } = await supabase
      .from("profiles")
      .select(
        "id, user_id, business_name, first_name, last_name, slug, city, state, service_zip, service_radius_miles, is_pro, avatar_url, is_suspended, status"
      )
      .in("user_id", installerIds);

    if (profileErr) {
      console.error("[getMapInstallers] Profile fetch error:", profileErr.message);
      return [];
    }

    // Build lookup by user_id
    const profileByUserId: Record<string, (typeof profiles)[number]> = {};
    for (const p of profiles || []) {
      const uid = (p.user_id ?? p.id) as string;
      profileByUserId[uid] = p;
    }

    // 3. Get all ZIP codes from installer_zip_codes
    const { data: zipRows } = await supabase
      .from("installer_zip_codes")
      .select("installer_id, zip_code")
      .in("installer_id", installerIds);

    const zipsByInstaller: Record<string, string[]> = {};
    if (zipRows) {
      for (const row of zipRows) {
        const iid = row.installer_id as string;
        if (!zipsByInstaller[iid]) zipsByInstaller[iid] = [];
        zipsByInstaller[iid].push(row.zip_code as string);
      }
    }

    // 4. Build map pins
    const results: MapInstaller[] = [];

    for (const installerId of installerIds) {
      const profile = profileByUserId[installerId];

      // Skip suspended or inactive installers
      if (profile) {
        const suspended = profile.is_suspended === true;
        const inactive = (profile.status as string) === "inactive";
        if (suspended || inactive) continue;
      }

      // Collect ZIPs from both sources
      const tableZips = zipsByInstaller[installerId] || [];
      const legacyZip = profile ? (profile.service_zip as string | null) : null;
      const primaryZip = tableZips[0] || legacyZip;

      if (!primaryZip) continue;

      const geo = zipcodes.lookup(primaryZip);
      if (!geo) continue;

      const name = profile
        ? (profile.business_name as string) ||
          [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
          "Storage Network Installer"
        : "Storage Network Installer";

      results.push({
        id: installerId,
        name,
        slug: profile ? (profile.slug as string) || null : null,
        city: profile ? (profile.city as string) || geo.city || null : geo.city || null,
        state: profile ? (profile.state as string) || geo.state || null : geo.state || null,
        lat: geo.latitude,
        lng: geo.longitude,
        radiusMiles: profile ? (profile.service_radius_miles as number) || 25 : 25,
        isPro: profile ? !!(profile.is_pro) : false,
        avatarUrl: profile ? (profile.avatar_url as string) || null : null,
        zipCount: tableZips.length || (legacyZip ? 1 : 0),
      });
    }

    console.log(`[getMapInstallers] Found ${results.length} installers with geocodable ZIPs (from ${installerIds.length} total)`);
    return results;
  },
  ["map-installers"],
  { revalidate: 300 }
);
