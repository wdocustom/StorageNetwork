import { TtlCache } from "@/lib/cache";

describe("TtlCache", () => {
  it("stores and retrieves values", () => {
    const cache = new TtlCache<string>(60_000);
    cache.set("key1", "value1");
    expect(cache.get("key1")).toBe("value1");
  });

  it("returns undefined for missing keys", () => {
    const cache = new TtlCache<string>(60_000);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("expires entries after TTL", () => {
    const cache = new TtlCache<string>(50); // 50ms TTL
    cache.set("key", "value");
    expect(cache.get("key")).toBe("value");

    // Fast-forward time
    vi.useFakeTimers();
    vi.advanceTimersByTime(100);
    expect(cache.get("key")).toBeUndefined();
    vi.useRealTimers();
  });

  it("supports per-entry TTL override", () => {
    vi.useFakeTimers();
    const cache = new TtlCache<string>(60_000); // default 60s
    cache.set("short", "val", 50); // 50ms TTL
    cache.set("long", "val", 200); // 200ms TTL

    vi.advanceTimersByTime(100);
    expect(cache.get("short")).toBeUndefined();
    expect(cache.get("long")).toBe("val");
    vi.useRealTimers();
  });

  it("getOrFetch returns cached value without calling factory", async () => {
    const cache = new TtlCache<string>(60_000);
    cache.set("key", "cached");

    const factory = vi.fn(async () => "fresh");
    const result = await cache.getOrFetch("key", factory);

    expect(result).toBe("cached");
    expect(factory).not.toHaveBeenCalled();
  });

  it("getOrFetch calls factory on cache miss", async () => {
    const cache = new TtlCache<string>(60_000);
    const factory = vi.fn(async () => "fresh");

    const result = await cache.getOrFetch("key", factory);
    expect(result).toBe("fresh");
    expect(factory).toHaveBeenCalledOnce();

    // Second call should be cached
    const result2 = await cache.getOrFetch("key", factory);
    expect(result2).toBe("fresh");
    expect(factory).toHaveBeenCalledOnce(); // Not called again
  });

  it("invalidate removes a specific key", () => {
    const cache = new TtlCache<string>(60_000);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.invalidate("a");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("2");
  });

  it("clear removes all entries", () => {
    const cache = new TtlCache<string>(60_000);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("tracks size correctly", () => {
    const cache = new TtlCache<string>(60_000);
    expect(cache.size).toBe(0);
    cache.set("a", "1");
    expect(cache.size).toBe(1);
    cache.set("b", "2");
    expect(cache.size).toBe(2);
    cache.invalidate("a");
    expect(cache.size).toBe(1);
  });
});
