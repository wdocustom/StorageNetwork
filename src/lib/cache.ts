// ═══════════════════════════════════════════════════════════════════════════
// TTL Cache — Upstash Redis with In-Memory Fallback
//
// Uses Upstash Redis as the primary backing store so cached values survive
// across Vercel serverless cold starts. Falls back to in-memory Map when
// Redis env vars are missing (local dev).
//
// SETUP: Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.
// ═══════════════════════════════════════════════════════════════════════════

import { Redis } from "@upstash/redis";

// ── Redis Client (shared across cache instances) ─────────────────────────

const hasRedis =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

let warnedOnce = false;

// ── Cache Implementation ─────────────────────────────────────────────────

interface MemEntry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private memStore = new Map<string, MemEntry<T>>();
  private readonly defaultTtlMs: number;
  private readonly prefix: string;
  private lastGc = Date.now();
  private readonly gcIntervalMs = 30_000;

  constructor(defaultTtlMs = 60_000, prefix = "cache") {
    this.defaultTtlMs = defaultTtlMs;
    this.prefix = prefix;
  }

  private redisKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async get(key: string): Promise<T | undefined> {
    if (redis) {
      try {
        const val = await redis.get<T>(this.redisKey(key));
        return val ?? undefined;
      } catch {
        // Redis error — fall through to memory
      }
    }
    // Fallback: in-memory
    const entry = this.memStore.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.memStore.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async set(key: string, value: T, ttlMs?: number): Promise<void> {
    const ttl = ttlMs ?? this.defaultTtlMs;
    if (redis) {
      try {
        await redis.set(this.redisKey(key), value, {
          ex: Math.ceil(ttl / 1000),
        });
        return;
      } catch {
        // Redis error — fall through to memory
      }
    }
    // Fallback: in-memory
    if (!warnedOnce) {
      console.warn(
        "[Cache] UPSTASH_REDIS_REST_URL not set — using in-memory fallback. " +
        "This is fine for local dev but will NOT persist across Vercel cold starts."
      );
      warnedOnce = true;
    }
    this.gc();
    this.memStore.set(key, { value, expiresAt: Date.now() + ttl });
  }

  /** Get-or-fetch: returns cached value or calls factory, caches result. */
  async getOrFetch(
    key: string,
    factory: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    const cached = await this.get(key);
    if (cached !== undefined) return cached;
    const value = await factory();
    await this.set(key, value, ttlMs);
    return value;
  }

  async invalidate(key: string): Promise<void> {
    if (redis) {
      try {
        await redis.del(this.redisKey(key));
      } catch {
        // Redis error — fall through
      }
    }
    this.memStore.delete(key);
  }

  clear(): void {
    this.memStore.clear();
    // Note: Redis keys expire via TTL; no bulk clear needed for safety
  }

  get size(): number {
    return this.memStore.size;
  }

  private gc(): void {
    const now = Date.now();
    if (now - this.lastGc < this.gcIntervalMs) return;
    this.lastGc = now;
    const expired: string[] = [];
    this.memStore.forEach((entry, key) => {
      if (now > entry.expiresAt) expired.push(key);
    });
    expired.forEach((k) => this.memStore.delete(k));
  }
}

// ── Shared cache instances ──────────────────────────────────────────────

/** Cache for ZIP → installer availability lookups (5 min TTL) */
export const zipCache = new TtlCache<unknown>(300_000, "zip");

/** Cache for installer profile lookups by ID/slug (5 min TTL) */
export const installerCache = new TtlCache<unknown>(300_000, "inst");
