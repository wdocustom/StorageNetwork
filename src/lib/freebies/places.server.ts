// ═══════════════════════════════════════════════════════════════════════════
// Freebie planner — finding real locations near the veteran
//
// Normally the visitor's browser runs the location search and posts the
// results here (placesFromBrowserSearch): Photon lets requests from our
// Cloudflare servers time out, but answers a phone at once. findPlacesNear
// is the server-side fallback for when the browser search fails: Photon
// first (one search per brand), then the Overpass API. The public Overpass servers were all down or timing out on
// Veterans Day morning 2026, which is why they are no longer the first choice.
//
// Results are cached per ~3.5-mile map cell so a busy morning doesn't hammer
// volunteer-run services, and each place is signed so the email route can
// trust a plan the browser sends back.
//
// Not a "use server" module: nothing here is callable from a browser.
// ═══════════════════════════════════════════════════════════════════════════

import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { Redis } from "@upstash/redis";
import zipcodes from "zipcodes";

import { OFFERS } from "./offers";
import {
  buildOverpassQuery,
  buildPhotonUrl,
  nearestPerOffer,
  parseOsmElements,
  photonToElements,
  sanitizePhotonFeatures,
  type OsmElement,
  type PhotonFeature,
  type RawPlace,
} from "./places";
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

// ── Cache ───────────────────────────────────────────────────────────────────

const CELL_DEG = 0.05;
/** Farthest a point can be from its cell's center, in miles (with margin). */
const CELL_PAD_MI = 2.6;
const CACHE_TTL_S = 12 * 60 * 60;
const MILE_M = 1609.344;

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
    : null;

const memory = new Map<string, { at: number; places: RawPlace[] }>();

async function cacheGet(key: string): Promise<RawPlace[] | null> {
  const local = memory.get(key);
  if (local && Date.now() - local.at < CACHE_TTL_S * 1000) return local.places;
  if (!redis) return null;
  try {
    return (await redis.get<RawPlace[]>(key)) ?? null;
  } catch (err) {
    console.warn("[Freebies] cache read failed:", err);
    return null;
  }
}

async function cacheSet(key: string, places: RawPlace[]): Promise<void> {
  if (memory.size > 200) memory.clear();
  memory.set(key, { at: Date.now(), places });
  if (!redis) return;
  try {
    await redis.set(key, places, { ex: CACHE_TTL_S });
  } catch (err) {
    console.warn("[Freebies] cache write failed:", err);
  }
}

const USER_AGENT = "StorageNetwork-VeteransDayPlanner/1.0 (+https://storage-network.app/veterans-day)";

// ── Photon ──────────────────────────────────────────────────────────────────

/** Searches in flight at once. Photon answers 503 when pushed harder. */
const PHOTON_BATCH = 5;

async function photonSearch(url: string): Promise<OsmElement[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(7_000),
  });
  if (!res.ok) throw new Error(`Photon responded ${res.status}`);
  const json = (await res.json()) as { features?: PhotonFeature[] };
  if (!Array.isArray(json.features)) throw new Error("Malformed Photon response");
  return photonToElements(json.features);
}

/**
 * One Photon search per catalog brand, with one retry for searches that
 * fail. `complete` is false when some brands still couldn't be searched;
 * throws when most couldn't, so the caller falls back.
 */
async function queryPhoton(
  center: LatLon,
  radiusMi: number
): Promise<{ elements: OsmElement[]; complete: boolean }> {
  const elements: OsmElement[] = [];
  let lastError = "unknown error";

  const run = async (urls: string[], batch: number): Promise<string[]> => {
    const failed: string[] = [];
    for (let i = 0; i < urls.length; i += batch) {
      const slice = urls.slice(i, i + batch);
      const results = await Promise.allSettled(slice.map(photonSearch));
      results.forEach((r, j) => {
        if (r.status === "fulfilled") elements.push(...r.value);
        else {
          failed.push(slice[j]);
          lastError = r.reason instanceof Error ? r.reason.message : String(r.reason);
        }
      });
      // Nothing has answered yet: the service is down, not busy. Stop asking.
      if (failed.length === i + slice.length && failed.length >= batch * 2) {
        failed.push(...urls.slice(i + batch));
        break;
      }
    }
    return failed;
  };

  const urls = OFFERS.map((offer) => buildPhotonUrl(offer, center, radiusMi));
  let failed = await run(urls, PHOTON_BATCH);
  if (failed.length === urls.length) throw new PlaceLookupError(`Photon lookup failed: ${lastError}`);
  if (failed.length) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    failed = await run(failed, 3);
  }
  if (failed.length > urls.length / 2) throw new PlaceLookupError(`Photon lookup failed: ${lastError}`);
  if (failed.length) {
    console.warn(`[Freebies] Photon: ${failed.length} of ${urls.length} brand searches failed (${lastError})`);
  }
  return { elements, complete: failed.length === 0 };
}

// ── Overpass ────────────────────────────────────────────────────────────────

// Public Overpass instances, tried in order. OVERPASS_URLS (comma-separated)
// replaces the list, e.g. to point at a private instance.
const OVERPASS_ENDPOINTS = process.env.OVERPASS_URLS?.split(",").map((u) => u.trim()).filter(Boolean) ?? [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export class PlaceLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlaceLookupError";
  }
}

async function queryOverpass(query: string): Promise<OsmElement[]> {
  let lastError: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(9_000),
      });
      if (!res.ok) throw new Error(`${endpoint} responded ${res.status}`);
      const json = (await res.json()) as { elements?: OsmElement[]; remark?: string };
      // A timed-out query still answers 200, with a remark and partial data.
      if (json.remark && /error|timed out/i.test(json.remark)) throw new Error(json.remark);
      if (!Array.isArray(json.elements)) throw new Error("Malformed Overpass response");
      return json.elements;
    } catch (err) {
      lastError = err;
      console.warn("[Freebies] Overpass attempt failed:", err instanceof Error ? err.message : err);
    }
  }
  throw new PlaceLookupError(
    `Location lookup failed: ${lastError instanceof Error ? lastError.message : "unknown error"}`
  );
}

/**
 * Catalog places within `radiusMi` of the starting point — the nearest few
 * of each chain, measured and signed. Throws PlaceLookupError when the map
 * service can't be reached.
 */
export async function findPlacesNear(origin: LatLon, radiusMi: number): Promise<Place[]> {
  const cell = {
    lat: Math.round(origin.lat / CELL_DEG) * CELL_DEG,
    lon: Math.round(origin.lon / CELL_DEG) * CELL_DEG,
  };
  const key = `freebies:v2:${cell.lat.toFixed(2)}:${cell.lon.toFixed(2)}:${radiusMi}`;

  let raw = await cacheGet(key);
  if (!raw) {
    const reach = radiusMi + CELL_PAD_MI;
    let complete = true;
    try {
      const photon = await queryPhoton(cell, reach);
      raw = parseOsmElements(photon.elements);
      complete = photon.complete;
    } catch (err) {
      console.warn("[Freebies] Photon failed, trying Overpass:", err instanceof Error ? err.message : err);
      raw = parseOsmElements(await queryOverpass(buildOverpassQuery(cell, reach * MILE_M)));
    }
    // A partial answer is fine to show once, but not to remember.
    if (complete) await cacheSet(key, raw);
  }

  return sign(nearestPerOffer(raw, origin, radiusMi));
}

function sign(places: (RawPlace & { distanceMi: number })[]): Place[] {
  return places.map((p) => {
    const { distanceMi, ...fields } = p;
    return { ...fields, distanceMi, sig: signature(fields) };
  });
}

/**
 * Places from a search the visitor's browser ran (see photon-browser.ts).
 * Nothing in it is taken on trust: the results are cleaned, then put through
 * the same brand, business-type and distance checks as our own lookups.
 * Not cached — it came from outside.
 */
export function placesFromBrowserSearch(features: unknown, origin: LatLon, radiusMi: number): Place[] {
  const clean = sanitizePhotonFeatures(features).filter((f) => f.properties?.countrycode === "US");
  return sign(nearestPerOffer(parseOsmElements(photonToElements(clean)), origin, radiusMi));
}
