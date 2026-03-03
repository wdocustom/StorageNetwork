// ═══════════════════════════════════════════════════════════════════════════
// In-Memory Rate Limiter (Edge-compatible, zero dependencies)
//
// Sliding-window token bucket per IP. Designed for Next.js middleware.
// Each IP gets `limit` requests per `windowMs`. Entries auto-expire.
// ═══════════════════════════════════════════════════════════════════════════

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Garbage-collect expired entries every 60s to prevent memory leaks
const GC_INTERVAL = 60_000;
let lastGc = Date.now();

function gc() {
  const now = Date.now();
  if (now - lastGc < GC_INTERVAL) return;
  lastGc = now;
  const expired: string[] = [];
  store.forEach((entry, key) => {
    if (now > entry.resetAt) expired.push(key);
  });
  expired.forEach((k) => store.delete(k));
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check whether a request from `key` (usually IP) is within rate limits.
 *
 * @param key       Unique identifier (IP address, user ID, etc.)
 * @param limit     Max requests per window (default 60)
 * @param windowMs  Window size in ms (default 60 000 = 1 minute)
 */
export function rateLimit(
  key: string,
  limit = 60,
  windowMs = 60_000
): RateLimitResult {
  gc();

  const now = Date.now();
  const entry = store.get(key);

  // First request or window expired → reset
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  // Within window
  entry.count += 1;

  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  };
}
