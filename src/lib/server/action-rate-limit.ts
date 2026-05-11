import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

import { getAuthenticatedUser } from "@/lib/auth";

// ═══════════════════════════════════════════════════════════════════════════
// Action Rate Limit — per-action sliding-window limits backed by Upstash.
//
// Used to wrap high-value server actions and route handlers (LLM/SMS/quote
// creation, etc.) where a runaway client can rack up real cost.
//
// Identity strategy:
//   "user"        — requires an authenticated session; throws 401 if anon.
//   "ip"          — keys solely on x-forwarded-for (first hop).
//   "user-or-ip"  — prefers the session id, falls back to x-forwarded-for.
//
// Throws RateLimitError when the budget is exceeded. The error carries a
// friendly message and a `retryAfterSeconds` hint so callers can render UX.
// ═══════════════════════════════════════════════════════════════════════════

export type RateLimitWindow =
  | `${number} s`
  | `${number} m`
  | `${number} h`
  | `${number} d`;

export type IdentityStrategy = "user" | "ip" | "user-or-ip";

export interface ActionRateLimitConfig {
  /** Stable identifier per action; becomes part of the Upstash key prefix. */
  action: string;
  /** Max requests per window. */
  limit: number;
  /** Sliding-window length, e.g. "60 s", "1 h". */
  window: RateLimitWindow;
  /** Identity strategy. Defaults to "user-or-ip". */
  identify?: IdentityStrategy;
}

export class RateLimitError extends Error {
  readonly code = "RATE_LIMITED" as const;
  readonly status: number;
  readonly retryAfterSeconds: number;
  constructor(message: string, retryAfterSeconds: number, status = 429) {
    super(message);
    this.name = "RateLimitError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class UnauthorizedActionError extends Error {
  readonly code = "UNAUTHORIZED" as const;
  readonly status = 401;
  constructor(message = "Unauthorized.") {
    super(message);
    this.name = "UnauthorizedActionError";
  }
}

// ── Upstash client (shared) ──────────────────────────────────────────────

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasUpstash
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Lazy cache of Ratelimit instances. Keyed by `action:limit:window` so two
// callers with the same config share a sliding-window state.
const limiterCache = new Map<string, Ratelimit>();

function getLimiter(cfg: ActionRateLimitConfig): Ratelimit | null {
  if (!redis) return null;
  const key = `${cfg.action}:${cfg.limit}:${cfg.window}`;
  let limiter = limiterCache.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.limit, cfg.window),
      analytics: true,
      prefix: `rl:act:${cfg.action}`,
    });
    limiterCache.set(key, limiter);
  }
  return limiter;
}

// ── In-memory dev fallback ───────────────────────────────────────────────
// Per-instance only; serverless cold starts and multi-region routing make
// this useless in production — it exists solely so local dev without Upstash
// credentials still exercises the code path.

interface MemBucket {
  timestamps: number[];
}
const memBuckets = new Map<string, MemBucket>();
let warnedMissingUpstash = false;

function parseWindowMs(window: RateLimitWindow): number {
  const m = window.match(/^(\d+)\s+(s|m|h|d)$/);
  if (!m) return 60_000;
  const n = Number(m[1]);
  const unit = m[2];
  return unit === "s"
    ? n * 1_000
    : unit === "m"
      ? n * 60_000
      : unit === "h"
        ? n * 3_600_000
        : n * 86_400_000;
}

function memCheck(
  action: string,
  id: string,
  limit: number,
  windowMs: number
): { allowed: boolean; resetAt: number } {
  const key = `${action}:${id}`;
  const now = Date.now();
  const bucket = memBuckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0]!;
    return { allowed: false, resetAt: oldest + windowMs };
  }
  bucket.timestamps.push(now);
  memBuckets.set(key, bucket);
  return { allowed: true, resetAt: now + windowMs };
}

// ── Identity resolution ──────────────────────────────────────────────────

async function resolveIdentity(strategy: IdentityStrategy): Promise<string> {
  if (strategy === "user" || strategy === "user-or-ip") {
    const user = await getAuthenticatedUser();
    if (user) return `u:${user.id}`;
    if (strategy === "user") {
      throw new UnauthorizedActionError();
    }
  }
  const h = await headers();
  const fwd = h.get("x-forwarded-for") ?? "";
  // x-forwarded-for is a comma-separated list; the first entry is the client.
  const ip =
    fwd.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "anon";
  return `ip:${ip}`;
}

// ── Public entry point ───────────────────────────────────────────────────

function friendlyMessage(retrySecs: number): string {
  if (retrySecs < 60) {
    return `Too many requests. Please try again in ${retrySecs}s.`;
  }
  const mins = Math.ceil(retrySecs / 60);
  return `Too many requests. Please try again in ~${mins} ${mins === 1 ? "minute" : "minutes"}.`;
}

/**
 * Enforce a per-action rate limit. Throws RateLimitError on overflow and
 * UnauthorizedActionError when identify="user" and no session is present.
 */
export async function enforceActionRateLimit(
  cfg: ActionRateLimitConfig
): Promise<void> {
  const strategy: IdentityStrategy = cfg.identify ?? "user-or-ip";
  const identity = await resolveIdentity(strategy);

  const limiter = getLimiter(cfg);
  if (limiter) {
    const { success, reset } = await limiter.limit(identity);
    if (!success) {
      const retrySecs = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      throw new RateLimitError(friendlyMessage(retrySecs), retrySecs);
    }
    return;
  }

  if (!warnedMissingUpstash) {
    console.warn(
      "[action-rate-limit] UPSTASH_REDIS_REST_URL not set — using in-memory " +
        "fallback. Local dev only; production deploys MUST set Upstash creds."
    );
    warnedMissingUpstash = true;
  }
  const windowMs = parseWindowMs(cfg.window);
  const res = memCheck(cfg.action, identity, cfg.limit, windowMs);
  if (!res.allowed) {
    const retrySecs = Math.max(1, Math.ceil((res.resetAt - Date.now()) / 1000));
    throw new RateLimitError(friendlyMessage(retrySecs), retrySecs);
  }
}
