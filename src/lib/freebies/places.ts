// ═══════════════════════════════════════════════════════════════════════════
// Freebie planner — place helpers shared by the server lookup and tests
//
// Pure module: no network, no server imports.
// ═══════════════════════════════════════════════════════════════════════════

import { milesBetween, type LatLon, type Place } from "./schedule";

/** A place before it's measured from a starting point and signed. */
export type RawPlace = Omit<Place, "distanceMi" | "sig">;

/** US phone as "(512) 555-0100", or null when the tag isn't a usable US number. */
export function formatUsPhone(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.split(/[;,]/)[0].replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (digits.length !== 10) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
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
