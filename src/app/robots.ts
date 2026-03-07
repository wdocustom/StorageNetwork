import type { MetadataRoute } from "next";

// ═══════════════════════════════════════════════════════════════════════════
// Dynamic Robots — Blackbox Protection + AI Bot Allowances
//
// Strategy: "Glass Storefront"
//   ALLOW  → Public marketing pages, installer portfolios, /technology
//   BLOCK  → Proprietary tools (configurator, build engine, dashboard, APIs)
//
// AI bots (GPTBot, ClaudeBot, anthropic-ai, CCBot, PerplexityBot,
// Google-Extended) are given explicit allow directives so GEO engines
// can index our public pages.
// ═══════════════════════════════════════════════════════════════════════════

const BLOCKED_PATHS = [
  "/api/",
  "/dashboard/",
  "/dashboard/*",
  "/design",
  "/design/*",
  "/build",
  "/pay/",
  "/pay/*",
  "/checkout/",
  "/checkout/*",
  "/upload/",
  "/upload/*",
  "/login",
  "/reset-password",
  "/auth/",
  "/auth/*",
  "/success/",
  "/book/",
  "/book/*",
  "/payment/",
  "/payment/*",
  "/community",
  "/community/*",
  "/upgrade",
  "/demo",
  "/_next/",
];

const ALLOWED_PATHS = [
  "/",
  "/technology",
  "/p/*",
  "/about",
  "/about/*",
  "/features",
  "/join",
  "/partner/join",
  "/installers/",
  "/installers/*",
  "/become-installer/",
  "/become-installer/*",
  "/legal/",
  "/legal/*",
  "/llms.txt",
];

// AI bot user agents that should be explicitly welcomed
const AI_BOTS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "PerplexityBot",
  "Google-Extended",
];

// Traditional search engine bots
const SEARCH_BOTS = ["Googlebot", "Bingbot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // ── Default rule for all crawlers ──────────────────────────────────
      {
        userAgent: "*",
        allow: ALLOWED_PATHS,
        disallow: BLOCKED_PATHS,
      },
      // ── AI bots — explicit allow for GEO indexing ──────────────────────
      ...AI_BOTS.map((bot) => ({
        userAgent: bot,
        allow: ALLOWED_PATHS,
        disallow: BLOCKED_PATHS,
      })),
      // ── Traditional search engines ─────────────────────────────────────
      ...SEARCH_BOTS.map((bot) => ({
        userAgent: bot,
        allow: ALLOWED_PATHS,
        disallow: BLOCKED_PATHS,
      })),
    ],
    sitemap: "https://storage-network.app/sitemap.xml",
  };
}
