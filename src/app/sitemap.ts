import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════
// Dynamic Sitemap — Static Routes + Dynamic Installer Portfolios
//
// Queries Supabase for ALL profiles with slugs (including suspended
// installers whose portfolios still resolve to the inactive overlay).
// This ensures every /p/[slug] URL is indexed by search engines and
// AI crawlers for maximum GEO coverage.
// ═══════════════════════════════════════════════════════════════════════════

const BASE = "https://storage-network.app";

// ── Regional installer hubs for local AI search relevance ────────────────
const INSTALLER_REGIONS = [
  // ── Original regions ──────────────────────────────────────────────────
  { slug: "miami-fl" },
  { slug: "orlando-fl" },
  { slug: "omaha-ne" },
  { slug: "denver-co" },
  { slug: "salt-lake-city-ut" },
  { slug: "new-york-ny" },
  { slug: "new-jersey-nj" },
  { slug: "pennsylvania-pa" },
  // ── 50 additional metro areas ─────────────────────────────────────────
  { slug: "atlanta-ga" },
  { slug: "charlotte-nc" },
  { slug: "raleigh-nc" },
  { slug: "nashville-tn" },
  { slug: "dallas-tx" },
  { slug: "fort-worth-tx" },
  { slug: "houston-tx" },
  { slug: "san-antonio-tx" },
  { slug: "austin-tx" },
  { slug: "phoenix-az" },
  { slug: "scottsdale-az" },
  { slug: "tampa-fl" },
  { slug: "jacksonville-fl" },
  { slug: "indianapolis-in" },
  { slug: "columbus-oh" },
  { slug: "cincinnati-oh" },
  { slug: "cleveland-oh" },
  { slug: "minneapolis-mn" },
  { slug: "st-louis-mo" },
  { slug: "kansas-city-mo" },
  { slug: "milwaukee-wi" },
  { slug: "detroit-mi" },
  { slug: "grand-rapids-mi" },
  { slug: "louisville-ky" },
  { slug: "memphis-tn" },
  { slug: "richmond-va" },
  { slug: "virginia-beach-va" },
  { slug: "charleston-sc" },
  { slug: "greenville-sc" },
  { slug: "boise-id" },
  { slug: "portland-or" },
  { slug: "seattle-wa" },
  { slug: "sacramento-ca" },
  { slug: "las-vegas-nv" },
  { slug: "tucson-az" },
  { slug: "albuquerque-nm" },
  { slug: "oklahoma-city-ok" },
  { slug: "tulsa-ok" },
  { slug: "des-moines-ia" },
  { slug: "knoxville-tn" },
  { slug: "huntsville-al" },
  { slug: "birmingham-al" },
  { slug: "san-diego-ca" },
  { slug: "colorado-springs-co" },
  { slug: "spokane-wa" },
  { slug: "provo-ut" },
  { slug: "bakersfield-ca" },
  { slug: "reno-nv" },
  { slug: "wichita-ks" },
  { slug: "little-rock-ar" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  // ── Static pages ─────────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    // Core pages
    { url: BASE, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/technology`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/features`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/join`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/partner/join`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },

    // Public pages
    { url: `${BASE}/installer-network`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/invite`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },

    // About / E-E-A-T cluster
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/about/scheduling`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },

    // Legal
    { url: `${BASE}/legal/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/legal/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  // ── Regional installer hub pages ─────────────────────────────────────
  const installerPages: MetadataRoute.Sitemap = INSTALLER_REGIONS.map(
    (region) => ({
      url: `${BASE}/installers/${region.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })
  );

  // ── Become-installer landing pages (same metro regions) ────────────
  const becomeInstallerPages: MetadataRoute.Sitemap = INSTALLER_REGIONS.map(
    (region) => ({
      url: `${BASE}/become-installer/${region.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })
  );

  // ── Dynamic installer portfolio pages (/p/[slug]) ───────────────────
  let portfolioPages: MetadataRoute.Sitemap = [];

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profiles } = await supabase
      .from("profiles")
      .select("slug, updated_at")
      .not("slug", "is", null);

    if (profiles && profiles.length > 0) {
      portfolioPages = profiles
        .filter((p) => p.slug && p.slug.trim() !== "")
        .map((p) => ({
          url: `${BASE}/p/${p.slug}`,
          lastModified: p.updated_at || now,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        }));
    }
  } catch (err) {
    // Sitemap generation should never break the build — degrade gracefully
    console.error("[sitemap] Failed to fetch installer profiles:", err);
  }

  return [...staticPages, ...installerPages, ...becomeInstallerPages, ...portfolioPages];
}
