// ═══════════════════════════════════════════════════════════════════════════
// Territory density tiers + same-country radius
//
// Pure helpers behind src/app/actions/territory.ts (kept out of the
// "use server" module so they can be unit-tested and so non-async values
// can be exported).
// ═══════════════════════════════════════════════════════════════════════════

import zipcodes from "zipcodes";
import { countryOfPostal, type CountryCode } from "./postal";

// ── Density tiers ──
// The "density probe" counts ZIPs within 10 miles of the home ZIP.
// More ZIPs = denser area = smaller territory (but plenty of customers).
export const DENSITY_PROBE_RADIUS = 10; // miles

export interface DensityTier {
  label: string;
  minDensityCount: number; // min ZIPs within probe radius to qualify
  targetZips: number;      // max ZIPs to assign
  searchRadiusMiles: number; // how far to look for candidate ZIPs
}

export const DENSITY_TIERS: DensityTier[] = [
  // Order matters: checked top-to-bottom, first match wins
  { label: "urban_core", minDensityCount: 200, targetZips: 15, searchRadiusMiles: 7 },
  { label: "urban",      minDensityCount: 100, targetZips: 25, searchRadiusMiles: 12 },
  { label: "suburban",   minDensityCount: 40,  targetZips: 40, searchRadiusMiles: 20 },
  { label: "rural",      minDensityCount: 0,   targetZips: 60, searchRadiusMiles: 35 },
];

// Canada is keyed by FSA (first 3 chars of the postal code — ~1,650 areas
// nationally vs ~42,000 US ZIPs). Downtown Toronto/Montreal FSAs are about
// the size of Dallas ZIPs (~100 within the 10-mile probe), but mid-size
// cities have far fewer: Calgary ≈31, Halifax ≈22, Saskatoon ≈11, Kamloops
// ≈4. Tiers are calibrated so each one covers a comparable land area to its
// US counterpart rather than a comparable count.
export const DENSITY_TIERS_CA: DensityTier[] = [
  { label: "urban_core", minDensityCount: 80, targetZips: 20, searchRadiusMiles: 7 },
  { label: "urban",      minDensityCount: 30, targetZips: 25, searchRadiusMiles: 12 },
  { label: "suburban",   minDensityCount: 10, targetZips: 20, searchRadiusMiles: 25 },
  { label: "rural",      minDensityCount: 0,  targetZips: 15, searchRadiusMiles: 40 },
];

export function tiersFor(country: CountryCode): DensityTier[] {
  return country === "CA" ? DENSITY_TIERS_CA : DENSITY_TIERS;
}

/**
 * Postal keys within `miles` of `key`, restricted to the same country.
 * zipcodes.radius() mixes datasets, so e.g. a Detroit ZIP returns Windsor,
 * ON FSAs. Territories never cross the border: the installer's Stripe
 * account, currency and tax regime are all single-country.
 */
export function sameCountryRadius(key: string, miles: number): string[] {
  const country = countryOfPostal(key);
  return (zipcodes.radius(key, miles) ?? []).filter((z) => countryOfPostal(z) === country);
}

/**
 * Detect the density tier for a postal key by counting how many same-country
 * keys exist within the probe radius.
 */
export function detectDensityTier(zip: string): DensityTier {
  const density = sameCountryRadius(zip, DENSITY_PROBE_RADIUS).length;
  const tiers = tiersFor(countryOfPostal(zip) ?? "US");
  return tiers.find((tier) => density >= tier.minDensityCount) ?? tiers[tiers.length - 1];
}
