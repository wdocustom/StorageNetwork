"use server";

import { getServiceClient } from "@/lib/supabase-server";
import zipcodes from "zipcodes";

// ═══════════════════════════════════════════════════════════════════════════
// Installer Map — Public data for the interactive network map on /guides
//
// Fetches all active installers with their base ZIP, geocodes them
// server-side using the `zipcodes` package, and returns lightweight
// pin data for the SVG map. No lat/lng stored in DB — computed on read.
// ═══════════════════════════════════════════════════════════════════════════

const supabase = getServiceClient();

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
}

/**
 * Fetch all active installers with geocoded positions for the network map.
 * Results are cached via Next.js unstable_cache or ISR on the page level.
 */
export async function getMapInstallers(): Promise<MapInstaller[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, business_name, slug, city, state, service_zip, service_radius_miles, is_pro, avatar_url, is_suspended"
    )
    .not("service_zip", "is", null)
    .eq("is_suspended", false);

  if (error || !data) {
    console.error("[getMapInstallers]", error?.message);
    return [];
  }

  const results: MapInstaller[] = [];

  for (const row of data) {
    const zip = row.service_zip as string;
    if (!zip) continue;

    // Geocode using the zipcodes package (offline lookup, no API call)
    const geo = zipcodes.lookup(zip);
    if (!geo) continue;

    results.push({
      id: row.id as string,
      name: (row.business_name as string) || "Storage Network Installer",
      slug: (row.slug as string) || null,
      city: (row.city as string) || geo.city || null,
      state: (row.state as string) || geo.state || null,
      lat: geo.latitude,
      lng: geo.longitude,
      radiusMiles: (row.service_radius_miles as number) || 25,
      isPro: !!(row.is_pro),
      avatarUrl: (row.avatar_url as string) || null,
    });
  }

  return results;
}
