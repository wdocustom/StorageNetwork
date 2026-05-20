import "server-only";
import zipcodes from "zipcodes";
import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Region Pages — Data for /installers/[region] SEO landing pages
//
// The hardcoded REGIONS dict in src/app/installers/[region]/page.tsx covers
// 58 curated marketing cities with rich hand-written copy. This module
// augments that set with EVERY (city, state) covered by an active installer's
// service_zips, so installers' own service areas auto-generate SEO pages.
//
// Pages funnel into /design pre-attached to the top-ranked installer in
// the city, with from=network so the resulting lead is a network lead
// (15% platform fee per the network/direct fee policy).
// ═══════════════════════════════════════════════════════════════════════════

export interface RegionInstaller {
  id: string;
  business_name: string | null;
  first_name: string | null;
  last_name: string | null;
  slug: string | null;
  avatar_url: string | null;
  service_zip: string | null;
  service_zips: string[] | null;
  completed_jobs: number | null;
  job_score: number | null;
  last_login_at: string | null;
  is_pro: boolean | null;
}

export interface RegionContext {
  slug: string;
  city: string;
  state: string;
  stateCode: string;
  primaryZip: string;
}

/**
 * Convert "Salt Lake City" + "UT" → "salt-lake-city-ut".
 * Strips punctuation, collapses whitespace, lowercases everything.
 */
export function regionSlug(city: string, stateCode: string): string {
  const citySlug = city
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${citySlug}-${stateCode.toLowerCase()}`;
}

/**
 * Inverse: parse "salt-lake-city-ut" → { citySlugPart: "salt-lake-city", stateCode: "ut" }.
 * Returns null if the slug doesn't end in a 2-letter state code.
 */
export function parseRegionSlug(
  slug: string,
): { citySlugPart: string; stateCode: string } | null {
  const m = slug.match(/^(.+)-([a-z]{2})$/);
  if (!m) return null;
  return { citySlugPart: m[1], stateCode: m[2] };
}

const FULL_STATE_NAMES: Record<string, string> = {
  al: "Alabama", ak: "Alaska", az: "Arizona", ar: "Arkansas", ca: "California",
  co: "Colorado", ct: "Connecticut", de: "Delaware", fl: "Florida", ga: "Georgia",
  hi: "Hawaii", id: "Idaho", il: "Illinois", in: "Indiana", ia: "Iowa",
  ks: "Kansas", ky: "Kentucky", la: "Louisiana", me: "Maine", md: "Maryland",
  ma: "Massachusetts", mi: "Michigan", mn: "Minnesota", ms: "Mississippi",
  mo: "Missouri", mt: "Montana", ne: "Nebraska", nv: "Nevada", nh: "New Hampshire",
  nj: "New Jersey", nm: "New Mexico", ny: "New York", nc: "North Carolina",
  nd: "North Dakota", oh: "Ohio", ok: "Oklahoma", or: "Oregon", pa: "Pennsylvania",
  ri: "Rhode Island", sc: "South Carolina", sd: "South Dakota", tn: "Tennessee",
  tx: "Texas", ut: "Utah", vt: "Vermont", va: "Virginia", wa: "Washington",
  wv: "West Virginia", wi: "Wisconsin", wy: "Wyoming", dc: "District of Columbia",
};

export function fullStateName(stateCode: string): string {
  return FULL_STATE_NAMES[stateCode.toLowerCase()] ?? stateCode.toUpperCase();
}

interface CityKey {
  city: string;
  stateCode: string;
  primaryZip: string;
}

/**
 * Walk every active installer's service_zips, look each zip up via the
 * zipcodes package, collect unique (city, state) pairs. Returns one entry
 * per slug with a representative zip the design page can hand to the
 * configurator.
 *
 * Active = profile exists + is_suspended is not true + has at least one
 * service zip + has an email on file. We don't filter on is_realtor here
 * because mixed-role profiles still service installations.
 */
export async function getInstallerDerivedRegions(): Promise<CityKey[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("service_zips, service_zip")
    .or("is_suspended.is.null,is_suspended.eq.false")
    .not("service_zips", "is", null);

  if (error || !data) return [];

  const bySlug = new Map<string, CityKey>();
  for (const row of data) {
    const zips = (row.service_zips as string[] | null) ?? [];
    const homeZip = (row.service_zip as string | null) ?? "";
    // Home zip first so a city's primaryZip prefers the installer's base.
    const ordered = homeZip ? [homeZip, ...zips.filter((z) => z !== homeZip)] : zips;

    for (const zip of ordered) {
      const trimmed = (zip ?? "").trim();
      if (!/^\d{5}$/.test(trimmed)) continue;
      const info = zipcodes.lookup(trimmed);
      if (!info?.city || !info?.state) continue;
      const slug = regionSlug(info.city, info.state);
      if (bySlug.has(slug)) continue;
      bySlug.set(slug, {
        city: info.city,
        stateCode: info.state.toLowerCase(),
        primaryZip: trimmed,
      });
    }
  }

  return Array.from(bySlug.values());
}

/**
 * Return the installers serving a given region slug, ranked. We match by
 * scanning each installer's service_zips for any zip whose (city, state)
 * resolves to this slug — zipcodes lookup is in-memory so this is fast for
 * the scales we're at (hundreds of installers max).
 *
 * Ranking: completed_jobs DESC, job_score DESC, last_login_at DESC.
 * Pros with Stripe connected float above non-Pros at the same score.
 */
export async function getInstallersForRegionSlug(
  slug: string,
  limit = 6,
): Promise<RegionInstaller[]> {
  const parsed = parseRegionSlug(slug);
  if (!parsed) return [];

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, business_name, first_name, last_name, slug, avatar_url, service_zip, service_zips, completed_jobs, job_score, last_login_at, is_pro, stripe_account_id",
    )
    .or("is_suspended.is.null,is_suspended.eq.false")
    .not("service_zips", "is", null);

  if (error || !data) return [];

  const candidates: Array<RegionInstaller & { stripe_account_id: string | null }> = [];
  for (const row of data) {
    const zips = (row.service_zips as string[] | null) ?? [];
    const matches = zips.some((zip) => {
      const info = zipcodes.lookup(zip);
      return !!info && regionSlug(info.city, info.state) === slug;
    });
    if (!matches) continue;
    candidates.push(row as RegionInstaller & { stripe_account_id: string | null });
  }

  candidates.sort((a, b) => {
    const proA = a.is_pro && a.stripe_account_id ? 1 : 0;
    const proB = b.is_pro && b.stripe_account_id ? 1 : 0;
    if (proA !== proB) return proB - proA;

    const jobsA = a.completed_jobs ?? 0;
    const jobsB = b.completed_jobs ?? 0;
    if (jobsA !== jobsB) return jobsB - jobsA;

    const scoreA = a.job_score ?? 0;
    const scoreB = b.job_score ?? 0;
    if (scoreA !== scoreB) return scoreB - scoreA;

    const loginA = a.last_login_at ? Date.parse(a.last_login_at) : 0;
    const loginB = b.last_login_at ? Date.parse(b.last_login_at) : 0;
    return loginB - loginA;
  });

  return candidates.slice(0, limit);
}

/**
 * Pick a zip for the region — prefers an installer's home zip in the city,
 * falls back to any service zip that resolves to the city, then to any
 * zip the zipcodes package can hand back for (citySlug, stateCode).
 */
export function primaryZipForRegion(
  slug: string,
  installers: RegionInstaller[],
): string | null {
  const parsed = parseRegionSlug(slug);
  if (!parsed) return null;

  for (const installer of installers) {
    const candidate = installer.service_zip;
    if (candidate && /^\d{5}$/.test(candidate)) {
      const info = zipcodes.lookup(candidate);
      if (info && regionSlug(info.city, info.state) === slug) return candidate;
    }
  }

  for (const installer of installers) {
    const zips = installer.service_zips ?? [];
    for (const zip of zips) {
      if (!/^\d{5}$/.test(zip)) continue;
      const info = zipcodes.lookup(zip);
      if (info && regionSlug(info.city, info.state) === slug) return zip;
    }
  }

  return null;
}
