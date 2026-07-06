import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryStore } from "../src/memory";
import { StampedeGuard } from "../src/stampede";
import { createCache } from "../src/cache";

// ---------------------------------------------------------------------------
// MemoryStore
// ---------------------------------------------------------------------------

describe("MemoryStore", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore(3);
  });

  it("returns null for missing keys", async () => {
    expect(await store.get("missing")).toBeNull();
  });

  it("stores and retrieves entries", async () => {
    await store.set("k1", { value: "hello", expiresAt: undefined, tags: [] });
    const entry = await store.get<string>("k1");
    expect(entry?.value).toBe("hello");
  });

  it("returns null for expired entries", async () => {
    await store.set("k2", { value: "x", expiresAt: Date.now() - 1, tags: [] });
    expect(await store.get("k2")).toBeNull();
  });

  it("evicts the oldest entry when at capacity", async () => {
    await store.set("a", { value: 1, expiresAt: undefined, tags: [] });
    await store.set("b", { value: 2, expiresAt: undefined, tags: [] });
    await store.set("c", { value: 3, expiresAt: undefined, tags: [] });
    // Adding "d" should evict "a"
    await store.set("d", { value: 4, expiresAt: undefined, tags: [] });
    expect(await store.get("a")).toBeNull();
    expect(await store.get("d")).not.toBeNull();
  });

  it("deletes an entry", async () => {
    await store.set("k3", { value: "y", expiresAt: undefined, tags: [] });
    await store.delete("k3");
    expect(await store.get("k3")).toBeNull();
  });

  it("tracks keys by tag", async () => {
    await store.addTagKeys("user", ["k1", "k2"]);
    expect(await store.keysByTag("user")).toEqual(expect.arrayContaining(["k1", "k2"]));
  });

  it("deletes all keys for a tag", async () => {
    await store.set("k4", { value: "z", expiresAt: undefined, tags: ["group"] });
    await store.set("k5", { value: "w", expiresAt: undefined, tags: ["group"] });
    await store.addTagKeys("group", ["k4", "k5"]);
    await store.deleteTag("group");
    expect(await store.get("k4")).toBeNull();
    expect(await store.get("k5")).toBeNull();
  });

  it("clears all entries", async () => {
    await store.set("x", { value: 1, expiresAt: undefined, tags: [] });
    await store.clear();
    expect(store.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// StampedeGuard
// ---------------------------------------------------------------------------

describe("StampedeGuard", () => {
  it("returns the same Promise for concurrent calls with the same key", async () => {
    const guard = new StampedeGuard();
    let callCount = 0;

    const fn = () =>
      new Promise<string>((resolve) =>
        setTimeout(() => {
          callCount++;
          resolve("result");
        }, 20),
      );

    const [r1, r2, r3] = await Promise.all([
      guard.run("key", fn),
      guard.run("key", fn),
      guard.run("key", fn),
    ]);

    expect(callCount).toBe(1);
    expect(r1).toBe("result");
    expect(r2).toBe("result");
    expect(r3).toBe("result");
  });

  it("allows a new call after the first completes", async () => {
    const guard = new StampedeGuard();
    let callCount = 0;
    const fn = async () => ++callCount;

    await guard.run("key", fn);
    await guard.run("key", fn);

    expect(callCount).toBe(2);
  });

  it("propagates errors to all waiters", async () => {
    const guard = new StampedeGuard();
    const fn = () => Promise.reject(new Error("boom"));

    const [r1, r2] = await Promise.allSettled([
      guard.run("key", fn),
      guard.run("key", fn),
    ]);

    expect(r1.status).toBe("rejected");
    expect(r2.status).toBe("rejected");
  });
});

// ---------------------------------------------------------------------------
// createCache — single layer (memory only)
// ---------------------------------------------------------------------------

describe("createCache() — single memory layer", () => {
  it("calls the source function on cache miss", async () => {
    const layer = new MemoryStore();
    const cache = createCache({ layers: [layer] });
    const source = vi.fn(async (id: string) => ({ id, name: "Albert" }));
    const getUser = cache(source, { key: (id) => `user:${id}` });

    const result = await getUser("1");
    expect(result.name).toBe("Albert");
    expect(source).toHaveBeenCalledOnce();
  });

  it("returns cached value on second call without calling source again", async () => {
    const layer = new MemoryStore();
    const cache = createCache({ layers: [layer] });
    const source = vi.fn(async (id: string) => id);
    const get = cache(source, { key: (id) => `v:${id}` });

    await get("x");
    await get("x");
    expect(source).toHaveBeenCalledOnce();
  });

  it("respects TTL — calls source again after expiry", async () => {
    const layer = new MemoryStore();
    const cache = createCache({ layers: [layer], defaultTtl: 0 }); // 0s = expires immediately
    const source = vi.fn(async () => "value");
    const get = cache(source);

    await get();
    await new Promise((r) => setTimeout(r, 5));
    await get();

    expect(source).toHaveBeenCalledTimes(2);
  });

  it("fires onHit callback with layer index", async () => {
    const layer = new MemoryStore();
    const onHit = vi.fn();
    const cache = createCache({ layers: [layer], onHit });
    const get = cache(async () => 42);

    await get(); // miss
    await get(); // hit

    expect(onHit).toHaveBeenCalledWith(expect.any(String), 0);
  });

  it("fires onMiss callback with duration", async () => {
    const layer = new MemoryStore();
    const onMiss = vi.fn();
    const cache = createCache({ layers: [layer], onMiss });
    const get = cache(async () => "result");

    await get();
    expect(onMiss).toHaveBeenCalledWith(expect.any(String), expect.any(Number));
  });
});

// ---------------------------------------------------------------------------
// createCache — two layers (L1 + L2 simulation)
// ---------------------------------------------------------------------------

describe("createCache() — two memory layers (L1 + L2)", () => {
  it("back-fills L1 from L2 on hit", async () => {
    const l1 = new MemoryStore();
    const l2 = new MemoryStore();
    const cache = createCache({ layers: [l1, l2] });
    const source = vi.fn(async () => "data");
    const get = cache(source, { key: () => "bk" });

    await get(); // miss → populates L1 + L2
    await l1.delete("bk"); // simulate L1 eviction

    expect(await l1.get("bk")).toBeNull();
    await get(); // L2 hit → should back-fill L1
    expect(await l1.get("bk")).not.toBeNull();
    expect(source).toHaveBeenCalledOnce(); // source only called once total
  });
});

// ---------------------------------------------------------------------------
// createCache — tag invalidation
// ---------------------------------------------------------------------------

describe("createCache() — tag invalidation", () => {
  it("invalidates all entries for a tag", async () => {
    const layer = new MemoryStore();
    const cache = createCache({ layers: [layer] });
    const source = vi.fn(async (id: string) => `user-${id}`);
    const get = cache(source, {
      key: (id) => `u:${id}`,
      tags: (id) => [`user:${id}`, "users"],
    });

    await get("1");
    await get("2");
    expect(source).toHaveBeenCalledTimes(2);

    await get.invalidateTag("users"); // should clear both entries

    await get("1");
    await get("2");
    expect(source).toHaveBeenCalledTimes(4); // source called again for each
  });

  it("invalidates a specific key", async () => {
    const layer = new MemoryStore();
    const cache = createCache({ layers: [layer] });
    const source = vi.fn(async (id: string) => id);
    const get = cache(source, { key: (id) => `item:${id}` });

    await get("a");
    await get.invalidateKey("item:a");
    await get("a");

    expect(source).toHaveBeenCalledTimes(2);
  });

  it("clearAll removes everything from all layers", async () => {
    const l1 = new MemoryStore();
    const l2 = new MemoryStore();
    const cache = createCache({ layers: [l1, l2] });
    const source = vi.fn(async () => "v");
    const get = cache(source);

    await get();
    await get.clearAll();

    await get();
    expect(source).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// createCache — stampede protection
// ---------------------------------------------------------------------------

describe("createCache() — stampede protection", () => {
  it("only calls source once for concurrent misses on the same key", async () => {
    const layer = new MemoryStore();
    const cache = createCache({ layers: [layer] });
    let callCount = 0;

    const source = async (id: string) => {
      callCount++;
      await new Promise((r) => setTimeout(r, 30));
      return `result-${id}`;
    };

    const get = cache(source, { key: (id) => `concurrent:${id}` });

    const results = await Promise.all([get("x"), get("x"), get("x")]);

    expect(callCount).toBe(1);
    expect(results.every((r) => r === "result-x")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createCache — stale-while-revalidate
// ---------------------------------------------------------------------------

describe("createCache() — stale-while-revalidate", () => {
  it("returns stale value and revalidates in background", async () => {
    const layer = new MemoryStore();
    const cache = createCache({ layers: [layer], defaultTtl: 1 });
    let version = 0;
    const source = vi.fn(async () => ++version);

    const get = cache(source, {
      key: () => "swr-key",
      ttl: 1,       // expires in 1 second
      revalidate: 2, // stale window: 2s before expiry → immediately stale
    });

    const v1 = await get(); // miss → v1 = 1
    expect(v1).toBe(1);

    // Wait for entry to enter stale window (TTL=1s, revalidate=2s → always stale once set)
    await new Promise((r) => setTimeout(r, 10));

    const v2 = await get(); // returns stale immediately, triggers background refresh
    expect(v2).toBe(1); // still returns old value

    // Wait for background refresh to complete
    await new Promise((r) => setTimeout(r, 50));

    const v3 = await get(); // should now return refreshed value
    expect(v3).toBe(2);
  });
});
