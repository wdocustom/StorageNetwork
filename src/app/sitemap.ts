import type { MetadataRoute } from "next";

// ── Regional installer hubs for local AI search relevance ────────────────
const INSTALLER_REGIONS = [
  { slug: "miami-fl", label: "Miami, FL" },
  { slug: "orlando-fl", label: "Orlando, FL" },
  { slug: "omaha-ne", label: "Omaha, NE" },
  { slug: "denver-co", label: "Denver, CO" },
  { slug: "salt-lake-city-ut", label: "Salt Lake City, UT" },
  { slug: "new-york-ny", label: "New York, NY" },
  { slug: "new-jersey-nj", label: "New Jersey, NJ" },
  { slug: "pennsylvania-pa", label: "Pennsylvania, PA" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://storage-network.app";
  const now = new Date().toISOString();

  const staticPages: MetadataRoute.Sitemap = [
    // Core pages
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/design`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/design/demo`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/partner/join`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },

    // About / E-E-A-T cluster
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/about/scheduling`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },

    // Legal
    { url: `${base}/legal/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Regional installer hub pages
  const installerPages: MetadataRoute.Sitemap = INSTALLER_REGIONS.map(
    (region) => ({
      url: `${base}/installers/${region.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })
  );

  return [...staticPages, ...installerPages];
}
