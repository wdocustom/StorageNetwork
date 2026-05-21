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
  "/realtors/join",
  "/installers/",
  "/installers/*",
  "/become-installer/",
  "/become-installer/*",
  "/legal/",
  "/legal/*",
  "/llms.txt",
];

// AI web crawlers — BLOCKED from scraping site content.
// These bots train LLMs or power AI search on our proprietary data.
const BLOCKED_AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "CCBot",
  "anthropic-ai",
  "Claude-Web",
  "Google-Extended",
  "ClaudeBot",
  "PerplexityBot",
];

// Traditional search engine bots — ALLOWED for indexing
const SEARCH_BOTS = ["Googlebot", "Bingbot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // ── Default rule for all crawlers ──────────────────────────────────
      // Standard search engines index public pages, proprietary tools blocked
      {
        userAgent: "*",
        allow: ALLOWED_PATHS,
        disallow: BLOCKED_PATHS,
      },
      // ── Traditional search engines — explicit allow ────────────────────
      ...SEARCH_BOTS.map((bot) => ({
        userAgent: bot,
        allow: ALLOWED_PATHS,
        disallow: BLOCKED_PATHS,
      })),
      // ── AI crawlers — FULL BLOCK ──────────────────────────────────────
      // Prevent LLM training and AI search engines from scraping content.
      // Our platform knowledge, pricing, and feature details are proprietary.
      ...BLOCKED_AI_BOTS.map((bot) => ({
        userAgent: bot,
        disallow: ["/"],
      })),
    ],
    sitemap: "https://storage-network.app/sitemap.xml",
  };
}
