// ═══════════════════════════════════════════════════════════════════════════
// Lightweight TTL Cache — Zero Dependencies
//
// Simple in-memory key→value cache with per-entry TTL.
// Designed for server-side use in Next.js to reduce Supabase hits
// during traffic spikes. Entries auto-expire, and GC runs lazily.
// ═══════════════════════════════════════════════════════════════════════════

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly defaultTtlMs: number;
  private lastGc = Date.now();
  private readonly gcIntervalMs = 30_000; // GC sweep every 30s

  constructor(defaultTtlMs = 60_000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    this.gc();
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  /** Get-or-fetch: returns cached value or calls factory, caches result. */
  async getOrFetch(
    key: string,
    factory: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  private gc(): void {
    const now = Date.now();
    if (now - this.lastGc < this.gcIntervalMs) return;
    this.lastGc = now;
    const expired: string[] = [];
    this.store.forEach((entry, key) => {
      if (now > entry.expiresAt) expired.push(key);
    });
    expired.forEach((k) => this.store.delete(k));
  }
}

// ── Shared cache instances ──────────────────────────────────────────────

/** Cache for ZIP → installer availability lookups (60s TTL) */
export const zipCache = new TtlCache<unknown>(60_000);

/** Cache for installer profile lookups by ID/slug (60s TTL) */
export const installerCache = new TtlCache<unknown>(60_000);
