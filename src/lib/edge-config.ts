// ═══════════════════════════════════════════════════════════════════════════
// Vercel Edge Config — Dynamic Cache Control
//
// Reads cache TTLs and pre-warm paths from Vercel Edge Config so they can
// be tuned in the Vercel dashboard without redeploying.
//
// Edge Config reads are ~0ms at the edge (data is co-located with compute),
// so it's safe to call on every middleware invocation.
//
// Expected Edge Config shape (key: "cacheConfig"):
// {
//   "paths": {
//     "/design": { "sMaxAge": 300, "staleWhileRevalidate": 3600 },
//     "/join":   { "sMaxAge": 300, "staleWhileRevalidate": 3600 }
//   },
//   "prewarmPaths": ["/design", "/join"]
// }
// ═══════════════════════════════════════════════════════════════════════════

import { createClient, type EdgeConfigClient } from "@vercel/edge-config";

// ── Types ────────────────────────────────────────────────────────────────

export interface PathCacheRule {
  sMaxAge: number;
  staleWhileRevalidate: number;
}

export interface CacheConfig {
  paths: Record<string, PathCacheRule>;
  prewarmPaths: string[];
}

// ── Defaults (used when Edge Config is unavailable) ──────────────────────

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  paths: {
    "/design": { sMaxAge: 300, staleWhileRevalidate: 3600 },
    "/join": { sMaxAge: 300, staleWhileRevalidate: 3600 },
  },
  prewarmPaths: ["/design", "/join"],
};

// ── Client singleton ─────────────────────────────────────────────────────

let client: EdgeConfigClient | null = null;

function getClient(): EdgeConfigClient | null {
  if (client) return client;
  if (!process.env.EDGE_CONFIG) return null;
  client = createClient(process.env.EDGE_CONFIG);
  return client;
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Fetch cache configuration from Edge Config.
 * Returns sensible defaults if Edge Config is not connected or the key is missing.
 */
export async function getCacheConfig(): Promise<CacheConfig> {
  try {
    const ec = getClient();
    if (!ec) return DEFAULT_CACHE_CONFIG;

    const raw = await ec.get<CacheConfig>("cacheConfig");
    if (!raw || !raw.paths) return DEFAULT_CACHE_CONFIG;

    return raw;
  } catch {
    // Edge Config unavailable — fall back silently
    return DEFAULT_CACHE_CONFIG;
  }
}

/**
 * Build a Cache-Control header value from a PathCacheRule.
 */
export function buildCacheHeader(rule: PathCacheRule): string {
  return `public, s-maxage=${rule.sMaxAge}, stale-while-revalidate=${rule.staleWhileRevalidate}`;
}
