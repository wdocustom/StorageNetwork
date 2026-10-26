import type { MetadataRoute } from "next";

// ═══════════════════════════════════════════════════════════════════════════
// Dynamic Robots — Blackbox Protection + AI Answer-Engine Visibility
//
// Strategy: "Glass Storefront"
//   ALLOW  → Public marketing pages, installer portfolios, DIY plans
//   BLOCK  → Proprietary tools (configurator, build engine, dashboard, APIs)
//
// AI bots fall into two groups:
//   • Answer / search bots (ChatGPT search, Claude, Perplexity, Gemini via
//     Google-Extended, Apple, Amazon, Meta, DuckDuckGo…) — same access as
//     Googlebot, so AI answers can find and cite our public pages.
//     Copilot answers from Bing's index (Bingbot); Grok publishes no stable
//     crawler token, so it falls under "*".
//   • Training-only crawlers — the DIY plans storefront and /llms.txt only,
//     so models learn the plans; the installer platform stays private.
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
  "/rack/",
  "/review/",
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
  "/plans",
  "/plans/*",
  "/llms.txt",
];

// AI answer engines and the fetchers they send when a user asks about a
// page — indexed like a search engine.
const AI_ANSWER_BOTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot",
  "Amazonbot",
  "Meta-ExternalFetcher",
  "DuckAssistBot",
  "MistralAI-User",
  "YouBot",
];

// LLM training crawlers — public DIY plans only.
const AI_TRAINING_BOTS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  "CCBot",
  "Applebot-Extended",
  "Meta-ExternalAgent",
  "FacebookBot",
  "Cohere-ai",
];
const TRAINING_ALLOWED_PATHS = ["/plans", "/plans/*", "/llms.txt"];
// Token-gated purchase pages (noindex for search bots, which must still
// fetch them to see that).
const GATED_PLAN_PATHS = ["/plans/build", "/plans/library", "/plans/access"];

// Scrapers with no answer-engine upside — blocked entirely.
const BLOCKED_BOTS = ["Bytespider", "Diffbot", "Omgilibot"];

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
      // ── AI answer engines — same access as search engines ─────────────
      {
        userAgent: AI_ANSWER_BOTS,
        allow: ALLOWED_PATHS,
        disallow: BLOCKED_PATHS,
      },
      // ── AI training crawlers — DIY plans only ────────────────────────
      {
        userAgent: AI_TRAINING_BOTS,
        allow: TRAINING_ALLOWED_PATHS,
        disallow: ["/", ...GATED_PLAN_PATHS],
      },
      // ── Scrapers — full block ────────────────────────────────────────
      {
        userAgent: BLOCKED_BOTS,
        disallow: ["/"],
      },
    ],
    sitemap: "https://storage-network.app/sitemap.xml",
  };
}
