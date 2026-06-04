// ═══════════════════════════════════════════════════════════════════════════
// Rate Limiter — Upstash Redis (serverless-safe)
//
// Uses @upstash/ratelimit with a sliding window algorithm backed by
// Upstash Redis. Unlike the previous in-memory Map, this works correctly
// on Vercel where each serverless function/edge instance has its own memory.
//
// SETUP: Create a free Upstash Redis database at https://upstash.com
// and set these env vars:
//   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
//   UPSTASH_REDIS_REST_TOKEN=AXxx...
//
// FALLBACK: If env vars are missing (local dev), falls back to in-memory
// rate limiting with a console warning. This ensures the app doesn't crash
// in development but is properly protected in production.
// ═══════════════════════════════════════════════════════════════════════════

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis/cloudflare";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ── Upstash Redis Client ─────────────────────────────────────────────────

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasUpstash
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// ── Rate Limiters (one per tier) ─────────────────────────────────────────
// Sliding window: requests are counted over a rolling 60-second window.
// This is more accurate than fixed windows and prevents burst-at-boundary.

const apiLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "60 s"), // 30 req/min for API
      analytics: true,
      prefix: "rl:api",
    })
  : null;

const pageLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "60 s"), // 60 req/min for pages
      analytics: true,
      prefix: "rl:page",
    })
  : null;

// ── Fallback: In-memory (dev only) ───────────────────────────────────────

interface MemEntry {
  count: number;
  resetAt: number;
}
const memStore = new Map<string, MemEntry>();

function memRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = memStore.get(key);

  if (!entry || now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  entry.count += 1;
  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// ── Public API ───────────────────────────────────────────────────────────

let warnedOnce = false;

/**
 * Rate limit a request by key (usually IP).
 *
 * @param key    Unique identifier (IP, user ID, etc.)
 * @param limit  Max requests per window (used for fallback + headers)
 * @param windowMs  Window size in ms (used for fallback only)
 * @param tier   "api" or "page" — selects the Upstash limiter tier
 */
export async function rateLimit(
  key: string,
  limit = 60,
  windowMs = 60_000,
  tier: "api" | "page" = "page"
): Promise<RateLimitResult> {
  const limiter = tier === "api" ? apiLimiter : pageLimiter;

  if (limiter) {
    const { success, remaining, reset } = await limiter.limit(key);
    return {
      allowed: success,
      remaining,
      resetAt: reset,
    };
  }

  // Fallback: in-memory (dev/local only)
  if (!warnedOnce) {
    console.warn(
      "[RateLimit] UPSTASH_REDIS_REST_URL not set — using in-memory fallback. " +
      "This is fine for local dev but will NOT work on Vercel serverless."
    );
    warnedOnce = true;
  }
  return memRateLimit(key, limit, windowMs);
}
