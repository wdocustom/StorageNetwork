// ═══════════════════════════════════════════════════════════════════════════
// Freebie planner — location search from the visitor's browser
//
// Photon (the OpenStreetMap search service) answers a phone in half a second
// but lets requests from our Cloudflare servers time out, so the search runs
// here, in the browser, and the raw results are posted to the plan route.
// The server still decides what counts: it re-checks brand, business type and
// distance, and cleans every text field, before a place is used or signed.
//
// Pure module — no server imports.
// ═══════════════════════════════════════════════════════════════════════════

import { OFFERS } from "./offers";
import { buildPhotonUrl, type PhotonFeature } from "./places";
import type { LatLon } from "./schedule";

/** Searches in flight at once. Photon answers 503 when pushed harder. */
const BATCH = 5;

async function search(url: string): Promise<PhotonFeature[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(7_000) });
  if (!res.ok) throw new Error(`Photon responded ${res.status}`);
  const json = (await res.json()) as { features?: PhotonFeature[] };
  if (!Array.isArray(json.features)) throw new Error("Malformed Photon response");
  // Keep only the fields the server reads.
  return json.features.map((f) => {
    const p = f.properties ?? {};
    return {
      geometry: { coordinates: f.geometry?.coordinates },
      properties: {
        osm_type: p.osm_type,
        osm_id: p.osm_id,
        osm_key: p.osm_key,
        osm_value: p.osm_value,
        name: p.name,
        housenumber: p.housenumber,
        street: p.street,
        city: p.city,
        state: p.state,
        postcode: p.postcode,
        countrycode: p.countrycode,
      },
    };
  });
}

/**
 * One search per catalog brand around the point, with one retry for searches
 * that fail. Returns null when too few searches answered to trust the result,
 * so the caller can let the server try instead.
 */
export async function searchPlacesInBrowser(center: LatLon, radiusMi: number): Promise<PhotonFeature[] | null> {
  const features: PhotonFeature[] = [];

  const run = async (urls: string[], batch: number): Promise<string[]> => {
    const failed: string[] = [];
    for (let i = 0; i < urls.length; i += batch) {
      const slice = urls.slice(i, i + batch);
      const results = await Promise.allSettled(slice.map(search));
      results.forEach((r, j) => {
        if (r.status === "fulfilled") features.push(...r.value);
        else failed.push(slice[j]);
      });
      // Nothing has answered yet: the service is unreachable. Stop asking.
      if (failed.length === i + slice.length && failed.length >= batch * 2) {
        failed.push(...urls.slice(i + batch));
        break;
      }
    }
    return failed;
  };

  const urls = OFFERS.map((offer) => buildPhotonUrl(offer, center, radiusMi));
  let failed = await run(urls, BATCH);
  if (failed.length === urls.length) return null;
  if (failed.length) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    failed = await run(failed, 3);
  }
  // A few brands missing is fine (the plan uses real places either way);
  // most missing means the service is down.
  return failed.length > urls.length / 2 ? null : features;
}
