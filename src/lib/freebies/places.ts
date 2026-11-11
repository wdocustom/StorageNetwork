// ═══════════════════════════════════════════════════════════════════════════
// Freebie planner — turning OpenStreetMap results into catalog places
//
// The planner never invents a location. Every stop is an OpenStreetMap
// element whose brand matches a catalog offer AND whose tags say it is the
// right kind of business (a "Target" must be a shop, a "ZIPS" a car wash).
//
// Two OpenStreetMap search services are supported: Photon (one quick search
// per brand) and Overpass (one large query for every brand). Both are reduced
// to the same OsmElement shape and go through the same checks.
//
// Pure module: request text and response parsing. The network calls and
// signing live in places.server.ts.
// ═══════════════════════════════════════════════════════════════════════════

import { OFFERS, type Offer, type PlaceType } from "./offers";
import { milesBetween, type LatLon, type Place } from "./schedule";

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** A place before it's measured from a starting point and signed. */
export type RawPlace = Omit<Place, "distanceMi" | "sig">;

/** Overpass QL: every element near the point whose brand or name starts with a catalog brand. */
export function buildOverpassQuery(center: LatLon, radiusMeters: number): string {
  const brands = OFFERS.map((o) => o.osm).join("|");
  const around = `(around:${Math.round(radiusMeters)},${center.lat.toFixed(5)},${center.lon.toFixed(5)})`;
  return [
    "[out:json][timeout:25];",
    "(",
    `  nwr["brand"~"^(${brands})",i]${around};`,
    `  nwr[!"brand"]["name"~"^(${brands})",i]${around};`,
    ");",
    "out center tags 4000;",
  ].join("\n");
}

// ── Photon ──────────────────────────────────────────────────────────────────

export interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_type?: string;
    osm_id?: number;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    state?: string;
    postcode?: string;
    countrycode?: string;
  };
}

/** Photon search for one brand, limited to a box around the point. */
export function buildPhotonUrl(offer: Offer, center: LatLon, radiusMi: number): string {
  const dLat = radiusMi / 69;
  const dLon = radiusMi / (69 * Math.cos((center.lat * Math.PI) / 180));
  const params = new URLSearchParams({
    q: offer.search ?? offer.brand,
    lat: center.lat.toFixed(4),
    lon: center.lon.toFixed(4),
    bbox: [center.lon - dLon, center.lat - dLat, center.lon + dLon, center.lat + dLat]
      .map((n) => n.toFixed(4))
      .join(","),
    limit: "15",
    lang: "en",
  });
  return `https://photon.komoot.io/api/?${params}`;
}

const PHOTON_TYPE: Record<string, OsmElement["type"]> = { N: "node", W: "way", R: "relation" };

/** Photon results in the shape the Overpass parser already understands. */
export function photonToElements(features: PhotonFeature[]): OsmElement[] {
  const out: OsmElement[] = [];
  for (const f of features) {
    const p = f.properties;
    const coords = f.geometry?.coordinates;
    const type = PHOTON_TYPE[p?.osm_type ?? ""];
    if (!p || !coords || !type || typeof p.osm_id !== "number" || !p.name) continue;
    if (p.countrycode && p.countrycode !== "US") continue;
    const tags: Record<string, string> = { name: p.name };
    if (p.osm_key && p.osm_value) tags[p.osm_key] = p.osm_value;
    if (p.housenumber) tags["addr:housenumber"] = p.housenumber;
    // A way on two roads lists both, separated by ";".
    if (p.street) tags["addr:street"] = p.street.split(";")[0].trim();
    if (p.city) tags["addr:city"] = p.city;
    if (p.state) tags["addr:state"] = p.state;
    if (p.postcode) tags["addr:postcode"] = p.postcode;
    out.push({ type, id: p.osm_id, lon: coords[0], lat: coords[1], tags });
  }
  return out;
}

// ── Matching ────────────────────────────────────────────────────────────────

const FOOD_AMENITY = new Set(["restaurant", "fast_food", "cafe", "ice_cream", "bar", "pub", "food_court"]);
const FOOD_SHOP = new Set(["bakery", "coffee", "pastry", "confectionery"]);

function isPlaceType(tags: Record<string, string>, type: PlaceType): boolean {
  const { amenity, shop } = tags;
  switch (type) {
    case "food":
      return FOOD_AMENITY.has(amenity) || FOOD_SHOP.has(shop);
    case "convenience":
      return shop === "convenience" || amenity === "fuel" || amenity === "cafe" || amenity === "fast_food";
    case "hairdresser":
      return shop === "hairdresser";
    case "carwash":
      return amenity === "car_wash";
    case "retail":
      return !!shop;
  }
}

function matchOffer(tags: Record<string, string>): Offer | undefined {
  const label = (tags.brand || tags.name || "").trim();
  if (!label) return undefined;
  return OFFERS.find((o) => o.match.test(label) && isPlaceType(tags, o.placeType));
}

function streetAddress(tags: Record<string, string>): string | null {
  const number = tags["addr:housenumber"];
  const street = tags["addr:street"];
  if (!number || !street) return null;
  const cityState = [tags["addr:city"], [tags["addr:state"], tags["addr:postcode"]].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return cityState ? `${number} ${street}, ${cityState}` : `${number} ${street}`;
}

/** US phone as "(512) 555-0100", or null when the tag isn't a usable US number. */
export function formatUsPhone(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.split(/[;,]/)[0].replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (digits.length !== 10) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Two map elements this close with the same brand are one store (a building and its entrance). */
const SAME_STORE_MI = 0.08;

/** Catalog places among the map elements, one per physical store. */
export function parseOsmElements(elements: OsmElement[]): RawPlace[] {
  const out: RawPlace[] = [];
  for (const el of elements) {
    const tags = el.tags;
    if (!tags) continue;
    // Closed-for-good stores sometimes keep their brand tag.
    if (tags["disused:amenity"] || tags["disused:shop"] || tags.abandoned === "yes") continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    const offer = matchOffer(tags);
    if (!offer) continue;

    const place: RawPlace = {
      id: `${el.type}/${el.id}`,
      offerId: offer.id,
      address: streetAddress(tags),
      city: tags["addr:city"] || null,
      phone: formatUsPhone(tags.phone || tags["contact:phone"]),
      lat: Number(lat.toFixed(6)),
      lon: Number(lon.toFixed(6)),
    };

    const twin = out.findIndex(
      (p) => p.offerId === place.offerId && milesBetween(p, place) < SAME_STORE_MI
    );
    if (twin === -1) out.push(place);
    else if (!out[twin].address && place.address) out[twin] = place;
  }
  return out;
}

/** How many locations of one chain are worth offering as swap options. */
const PER_OFFER = 3;

/** The nearest few locations of each offer within the veteran's driving radius. */
export function nearestPerOffer<T extends RawPlace>(
  places: T[],
  origin: LatLon,
  radiusMi: number
): (T & { distanceMi: number })[] {
  const counts = new Map<string, number>();
  return places
    .map((p) => ({ ...p, distanceMi: Number(milesBetween(origin, p).toFixed(2)) }))
    .filter((p) => p.distanceMi <= radiusMi)
    .sort((a, b) => a.distanceMi - b.distanceMi)
    .filter((p) => {
      const n = counts.get(p.offerId) ?? 0;
      counts.set(p.offerId, n + 1);
      return n < PER_OFFER;
    });
}
