// ═══════════════════════════════════════════════════════════════════════════
// Freebie planner — finding real locations near the veteran
//
// Locations come from files we host ourselves: public/freebies/locations/
// <lat>_<lon>.json, one per 1°×1° map square, built from the All The Places
// open dataset of chain store locators (scripts/freebies/build-locations.mjs).
// A plan reads the one to four squares its driving radius touches.
//
// This replaced live searches of free map services (Overpass, then Photon),
// which dropped or refused too many requests on Veterans Day 2026 to rely on.
//
// Each place is signed so the email route can trust a plan the browser
// sends back.
//
// Not a "use server" module: nothing here is callable from a browser.
// ═══════════════════════════════════════════════════════════════════════════

import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import zipcodes from "zipcodes";

import { getOffer } from "./offers";
import { formatUsPhone, nearestPerOffer, type RawPlace } from "./places";
import { milesBetween, type LatLon, type Place } from "./schedule";

// ── Starting point ──────────────────────────────────────────────────────────

export interface Origin extends LatLon {
  /** "Austin, TX" */
  label: string;
}

export function originFromZip(zip: string): Origin | null {
  const hit = zipcodes.lookup(zip);
  if (!hit || hit.country !== "US") return null;
  return { lat: hit.latitude, lon: hit.longitude, label: `${hit.city}, ${hit.state}` };
}

export function originFromCoords(lat: number, lon: number): Origin {
  // The area's name is the commonest city among the nearest ZIP centroids —
  // the single nearest is sometimes one building's private ZIP ("City
  // National Bank"). (The package's own lookupByCoords leaks a global, which
  // throws once bundled in strict mode.)
  const near: { mi: number; label: string }[] = [];
  for (const code of Object.values(zipcodes.codes)) {
    if (code.country !== "US" || !code.latitude || !code.longitude) continue;
    if (Math.abs(code.latitude - lat) > 0.4 || Math.abs(code.longitude - lon) > 0.5) continue;
    const mi = milesBetween({ lat, lon }, { lat: code.latitude, lon: code.longitude });
    if (mi < 25) near.push({ mi, label: `${code.city}, ${code.state}` });
  }
  near.sort((a, b) => a.mi - b.mi);
  const votes = new Map<string, number>();
  for (const n of near.slice(0, 7)) votes.set(n.label, (votes.get(n.label) ?? 0) + 1);
  // Map order is nearest-first, so a tie goes to the closer city.
  const label = [...votes].reduce<[string, number] | null>((best, v) => (!best || v[1] > best[1] ? v : best), null);
  return { lat, lon, label: label?.[0] ?? "your location" };
}

// ── Signing ─────────────────────────────────────────────────────────────────

function secret(): string {
  const s =
    process.env.FREEBIES_SIGNING_SECRET ||
    process.env.REQUEST_LINK_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("No secret configured for freebie plans.");
  return "dev-only-freebie-plan-secret";
}

function signature(p: RawPlace): string {
  const payload = [p.id, p.offerId, p.address ?? "", p.city ?? "", p.phone ?? "", p.lat, p.lon].join("|");
  return createHmac("sha256", secret()).update(`freebie-place:${payload}`).digest("base64url").slice(0, 24);
}

/** True when this place came from our own lookup, unaltered. */
export function verifyPlace(p: Place): boolean {
  const expected = Buffer.from(signature(p));
  const given = Buffer.from(String(p.sig ?? ""));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// ── Location files ──────────────────────────────────────────────────────────

/** [offerId, lat, lon, street, city, state, postcode, phoneDigits, sourceId] */
export type LocationRow = [string, number, number, string, string, string, string, string, string];

export class PlaceLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlaceLookupError";
  }
}

/** The 1°×1° squares a radius around the point touches, as file keys ("41_-96"). */
export function locationFileKeys(origin: LatLon, radiusMi: number): string[] {
  const dLat = radiusMi / 69;
  const dLon = radiusMi / (69 * Math.max(0.2, Math.cos((origin.lat * Math.PI) / 180)));
  const keys: string[] = [];
  for (let lat = Math.floor(origin.lat - dLat); lat <= Math.floor(origin.lat + dLat); lat++) {
    for (let lon = Math.floor(origin.lon - dLon); lon <= Math.floor(origin.lon + dLon); lon++) {
      keys.push(`${lat}_${lon}`);
    }
  }
  return keys;
}

/** A file row as a place, or null when it names an offer we no longer run. */
export function rowToPlace(row: LocationRow): RawPlace | null {
  const [offerId, lat, lon, street, city, state, rawPostcode, phone, sourceId] = row;
  // Some chains publish ZIP+4 without the hyphen ("681143632").
  const postcode = /^\d{9}$/.test(rawPostcode) ? rawPostcode.slice(0, 5) : rawPostcode;
  if (!getOffer(offerId) || typeof lat !== "number" || typeof lon !== "number") return null;
  const cityLine = [city, [state, postcode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return {
    id: `atp/${sourceId || `${lat},${lon}`}`,
    offerId,
    address: street ? [street, cityLine].filter(Boolean).join(", ") : null,
    city: city || null,
    phone: formatUsPhone(phone),
    lat,
    lon,
  };
}

export type ReadLocationFile = (key: string) => Promise<LocationRow[]>;

// Files only change on a deploy, so an isolate can keep what it has read.
const fileCache = new Map<string, LocationRow[]>();

/**
 * Reads a location file from this site's static assets: through the ASSETS
 * binding on Cloudflare, or over HTTP from `siteUrl` elsewhere (next dev).
 * A square with no file has no stores.
 */
export function assetFileReader(siteUrl: string): ReadLocationFile {
  return async (key) => {
    const cached = fileCache.get(key);
    if (cached) return cached;
    const url = new URL(`/freebies/locations/${key}.json`, siteUrl);
    let res: Response | null = null;
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const assets = (getCloudflareContext().env as { ASSETS?: { fetch: typeof fetch } }).ASSETS;
      if (assets) res = await assets.fetch(url);
    } catch {
      // Not running on Cloudflare.
    }
    if (!res) res = await fetch(url);
    if (res.status === 404) {
      fileCache.set(key, []);
      return [];
    }
    if (!res.ok) throw new PlaceLookupError(`Location file ${key} → ${res.status}`);
    const rows = (await res.json()) as LocationRow[];
    if (fileCache.size > 400) fileCache.clear();
    fileCache.set(key, rows);
    return rows;
  };
}

/** The nearest few locations of each offer within the radius, measured and signed. */
export async function findPlacesNear(origin: LatLon, radiusMi: number, read: ReadLocationFile): Promise<Place[]> {
  const files = await Promise.all(locationFileKeys(origin, radiusMi).map(read));
  const places = files.flat().map(rowToPlace).filter((p): p is RawPlace => p !== null);
  return nearestPerOffer(places, origin, radiusMi).map((p) => {
    const { distanceMi, ...fields } = p;
    return { ...fields, distanceMi, sig: signature(fields) };
  });
}
