// ═══════════════════════════════════════════════════════════════════════════
// Sitemap lastmod dates — when each page's CONTENT last changed.
//
// Search engines only trust <lastmod> when it's accurate; stamping every URL
// with the generation time teaches them to ignore it. Bump a page's date here
// when you change what a visitor reads on it (not for refactors).
// /plans pages follow PLANS_UPDATED, which also feeds their JSON-LD.
// ═══════════════════════════════════════════════════════════════════════════

import { PLANS_UPDATED } from "@/lib/schema/plans";

export const PAGE_UPDATED = {
  "/": "2026-10-26",
  "/technology": "2026-06-11",
  "/features": "2026-10-22",
  "/join": "2026-06-11",
  "/partner/join": "2026-06-11",
  "/realtors/join": "2026-06-11",
  "/installer-network": "2026-06-11",
  "/invite": "2026-06-11",
  "/plans": PLANS_UPDATED,
  "/plans/checkout": PLANS_UPDATED,
  "/plans/jig": PLANS_UPDATED,
  /** /plans/[slug] pages (plan-pages.ts) */
  "/plans/[slug]": PLANS_UPDATED,
  "/about": "2026-10-06",
  "/about/scheduling": "2026-06-11",
  "/legal/privacy": "2026-06-11",
  "/legal/terms": "2026-06-11",
  /** /become-installer/[region] template */
  "/become-installer": "2026-06-11",
} as const satisfies Record<string, string>;

export type DatedPage = keyof typeof PAGE_UPDATED;
