// ═══════════════════════════════════════════════════════════════════════════
// Freebie planner — finding real locations near the veteran
//
// Looks up catalog brands in OpenStreetMap (Overpass API: free, no key).
// Results are cached per ~3.5-mile map cell so a busy Veterans Day morning
// doesn't hammer a volunteer-run service, and each place is signed so the
// email route can trust a plan the browser sends back.
//
// Not a "use server" module: nothing here is callable from a browser.
// ═══════════════════════════════════════════════════════════════════════════

import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { Redis } from "@upstash/redis";
import zipcodes from "zipcodes";

import {
  buildOverpassQuery,
  nearestPerOffer,
  parseOverpassElements,
  type OsmElement,
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
  // Nearest ZIP centroid names the area. (The package's own lookupByCoords
  // leaks a global, which throws once bundled in strict mode.)
  let best: { city: string; state: string } | null = null;
  let bestMi = 25;
  for (const code of Object.values(zipcodes.codes)) {
    if (code.country !== "US" || !code.latitude || !code.longitude) continue;
    if (Math.abs(code.latitude - lat) > 0.4 || Math.abs(code.longitude - lon) > 0.5) continue;
    const mi = milesBetween({ lat, lon }, { lat: code.latitude, lon: code.longitude });
    if (mi < bestMi) {
      bestMi = mi;
      best = code;
    }
  }
  return { lat, lon, label: best ? `${best.city}, ${best.state}` : "your location" };
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
          "User-Agent": "StorageNetwork-VeteransDayPlanner/1.0 (+https://storage-network.app/veterans-day)",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(16_000),
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
  const key = `freebies:v1:${cell.lat.toFixed(2)}:${cell.lon.toFixed(2)}:${radiusMi}`;

  let raw = await cacheGet(key);
  if (!raw) {
    const query = buildOverpassQuery(cell, (radiusMi + CELL_PAD_MI) * MILE_M);
    raw = parseOverpassElements(await queryOverpass(query));
    await cacheSet(key, raw);
  }

  return nearestPerOffer(raw, origin, radiusMi).map((p) => {
    const { distanceMi, ...fields } = p;
    return { ...fields, distanceMi, sig: signature(fields) };
  });
}
