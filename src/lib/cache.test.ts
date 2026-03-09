import { TtlCache } from "@/lib/cache";

describe("TtlCache", () => {
  it("stores and retrieves values", async () => {
    const cache = new TtlCache<string>(60_000);
    await cache.set("key1", "value1");
    expect(await cache.get("key1")).toBe("value1");
  });

  it("returns undefined for missing keys", async () => {
    const cache = new TtlCache<string>(60_000);
    expect(await cache.get("missing")).toBeUndefined();
  });

  it("expires entries after TTL", async () => {
    const cache = new TtlCache<string>(50); // 50ms TTL
    await cache.set("key", "value");
    expect(await cache.get("key")).toBe("value");

    // Fast-forward time
    vi.useFakeTimers();
    vi.advanceTimersByTime(100);
    expect(await cache.get("key")).toBeUndefined();
    vi.useRealTimers();
  });

  it("supports per-entry TTL override", async () => {
    vi.useFakeTimers();
    const cache = new TtlCache<string>(60_000); // default 60s
    await cache.set("short", "val", 50); // 50ms TTL
    await cache.set("long", "val", 200); // 200ms TTL

    vi.advanceTimersByTime(100);
    expect(await cache.get("short")).toBeUndefined();
    expect(await cache.get("long")).toBe("val");
    vi.useRealTimers();
  });

  it("getOrFetch returns cached value without calling factory", async () => {
    const cache = new TtlCache<string>(60_000);
    await cache.set("key", "cached");

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

  it("invalidate removes a specific key", async () => {
    const cache = new TtlCache<string>(60_000);
    await cache.set("a", "1");
    await cache.set("b", "2");
    await cache.invalidate("a");
    expect(await cache.get("a")).toBeUndefined();
    expect(await cache.get("b")).toBe("2");
  });

  it("clear removes all entries", async () => {
    const cache = new TtlCache<string>(60_000);
    await cache.set("a", "1");
    await cache.set("b", "2");
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("tracks size correctly", async () => {
    const cache = new TtlCache<string>(60_000);
    expect(cache.size).toBe(0);
    await cache.set("a", "1");
    expect(cache.size).toBe(1);
    await cache.set("b", "2");
    expect(cache.size).toBe(2);
    await cache.invalidate("a");
    expect(cache.size).toBe(1);
  });
});
