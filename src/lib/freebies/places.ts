// ═══════════════════════════════════════════════════════════════════════════
// Freebie planner — turning OpenStreetMap results into catalog places
//
// The planner never invents a location. Every stop is an OpenStreetMap
// element whose brand matches a catalog offer AND whose tags say it is the
// right kind of business (a "Target" must be a shop, a "ZIPS" a car wash).
//
// Pure module: the Overpass query text and the parsing of its response. The
// network call and signing live in places.server.ts.
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

/** Catalog places among the Overpass elements, one per physical store. */
export function parseOverpassElements(elements: OsmElement[]): RawPlace[] {
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
