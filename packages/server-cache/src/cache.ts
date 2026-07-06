import { MemoryStore } from "./memory";
import { StampedeGuard } from "./stampede";
import type {
  CacheEntry,
  CacheLayer,
  CachedFunction,
  CreateCacheOptions,
  WrapOptions,
} from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ttlToExpiresAt(ttlSeconds: number | undefined): number | undefined {
  if (ttlSeconds === undefined) return undefined;
  return Date.now() + ttlSeconds * 1000;
}

function defaultKeyFn(...args: unknown[]): string {
  try {
    return JSON.stringify(args);
  } catch {
    return String(args);
  }
}

function isStale(entry: CacheEntry<unknown>, revalidateSeconds?: number): boolean {
  if (entry.expiresAt === undefined) return false;
  if (revalidateSeconds === undefined) return Date.now() > entry.expiresAt;
  // Stale-while-revalidate: entry is "stale" if it would expire within the
  // revalidation window, but still usable.
  const revalidateAt = entry.expiresAt - revalidateSeconds * 1000;
  return Date.now() > revalidateAt;
}

function isExpired(entry: CacheEntry<unknown>): boolean {
  return entry.expiresAt !== undefined && Date.now() > entry.expiresAt;
}

// ---------------------------------------------------------------------------
// createCache
// ---------------------------------------------------------------------------

/**
 * Creates a multi-layer cache factory.
 *
 * @example
 * ```ts
 * import { createCache, MemoryStore, RedisStore } from "@nx-safe-suite/server-cache";
 * import Redis from "ioredis";
 *
 * const cache = createCache({
 *   layers: [new MemoryStore(200), new RedisStore(new Redis())],
 *   defaultTtl: 3600,
 * });
 *
 * export const getUser = cache(
 *   async (id: string) => db.user.findUnique({ where: { id } }),
 *   { tags: (id) => [`user:${id}`], ttl: 300 }
 * );
 *
 * // Later, when a user is updated:
 * await getUser.invalidateTag(`user:${userId}`);
 * ```
 */
export function createCache(opts: CreateCacheOptions) {
  const layers = opts.layers;
  const stampede = new StampedeGuard();

  // ------------------------------------------------------------------
  // Core: read across layers
  // ------------------------------------------------------------------
  async function getFromLayers<T>(
    key: string,
    revalidate?: number,
  ): Promise<{ entry: CacheEntry<T>; layerIndex: number } | null> {
    for (let i = 0; i < layers.length; i++) {
      const entry = await layers[i]!.get<T>(key);
      if (!entry || isExpired(entry)) continue;

      opts.onHit?.(key, i);

      // Back-fill faster layers (e.g. populate L1 from L2 hit)
      for (let j = 0; j < i; j++) {
        await layers[j]!.set(key, entry);
        for (const tag of entry.tags) {
          await layers[j]!.addTagKeys(tag, [key]);
        }
      }

      return { entry, layerIndex: i };
    }
    return null;
  }

  // ------------------------------------------------------------------
  // Core: write to all layers
  // ------------------------------------------------------------------
  async function setInLayers<T>(
    key: string,
    value: T,
    tags: string[],
    ttl: number | undefined,
  ): Promise<void> {
    const entry: CacheEntry<T> = {
      value,
      expiresAt: ttlToExpiresAt(ttl),
      tags,
    };

    await Promise.all(
      layers.map(async (layer) => {
        await layer.set(key, entry);
        for (const tag of tags) {
          await layer.addTagKeys(tag, [key]);
        }
      }),
    );
  }

  // ------------------------------------------------------------------
  // Core: delete from all layers
  // ------------------------------------------------------------------
  async function deleteFromLayers(key: string): Promise<void> {
    await Promise.all(layers.map((l) => l.delete(key)));
  }

  async function deleteTagFromLayers(tag: string): Promise<void> {
    await Promise.all(layers.map((l) => l.deleteTag(tag)));
  }

  async function clearAllLayers(): Promise<void> {
    await Promise.all(layers.map((l) => l.clear()));
  }

  // ------------------------------------------------------------------
  // wrap() — the public factory
  // ------------------------------------------------------------------
  function wrap<TArgs extends unknown[], TReturn>(
    fn: (...args: TArgs) => TReturn | Promise<TReturn>,
    wrapOpts: WrapOptions<TArgs> = {},
  ): CachedFunction<TArgs, TReturn> {
    const keyFn = wrapOpts.key ?? ((...args) => defaultKeyFn(...args));
    const ttl = wrapOpts.ttl ?? opts.defaultTtl;
    const { revalidate } = wrapOpts;

    async function execute(...args: TArgs): Promise<TReturn> {
      const key = keyFn(...args);
      const tags =
        typeof wrapOpts.tags === "function"
          ? wrapOpts.tags(...args)
          : (wrapOpts.tags ?? []);

      // 1. Try cache layers
      const cached = await getFromLayers<TReturn>(key, revalidate);

      if (cached) {
        const { entry } = cached;

        // Stale-While-Revalidate: return stale value, refresh in background
        if (revalidate !== undefined && isStale(entry, revalidate)) {
          // Fire and forget — don't await
          void stampede.run(key, async () => {
            const start = Date.now();
            const fresh = await fn(...args);
            await setInLayers(key, fresh, tags, ttl);
            opts.onMiss?.(key, Date.now() - start);
          });
        }

        return entry.value;
      }

      // 2. Cache miss — fetch from source, deduplicated
      const start = Date.now();
      const value = await stampede.run(key, () => Promise.resolve(fn(...args)));
      opts.onMiss?.(key, Date.now() - start);

      // Populate all cache layers
      await setInLayers(key, value, tags, ttl);

      return value;
    }

    async function invalidateTag(...tags: string[]): Promise<void> {
      await Promise.all(tags.map(deleteTagFromLayers));
    }

    async function invalidateKey(key: string): Promise<void> {
      await deleteFromLayers(key);
    }

    async function clearAll(): Promise<void> {
      await clearAllLayers();
    }

    execute.invalidateTag = invalidateTag;
    execute.invalidateKey = invalidateKey;
    execute.clearAll = clearAll;

    return execute as CachedFunction<TArgs, TReturn>;
  }

  return wrap;
}

// ---------------------------------------------------------------------------
// Re-export MemoryStore as the default L1 so callers don't need a separate
// import for the most common setup.
// ---------------------------------------------------------------------------
export { MemoryStore } from "./memory";
