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
  { slug: "miami-fl" },
  { slug: "orlando-fl" },
  { slug: "omaha-ne" },
  { slug: "denver-co" },
  { slug: "salt-lake-city-ut" },
  { slug: "new-york-ny" },
  { slug: "new-jersey-nj" },
  { slug: "pennsylvania-pa" },
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

  return [...staticPages, ...installerPages, ...portfolioPages];
}
