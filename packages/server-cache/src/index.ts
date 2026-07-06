/**
 * @nx-safe-suite/server-cache
 * Multi-tier (memory → Redis → source) server-side cache for Next.js
 * with TTL, tag-based invalidation, stale-while-revalidate, and
 * cache stampede protection.
 *
 * @packageDocumentation
 */

export { createCache } from "./cache";
export { MemoryStore } from "./memory";
export { RedisStore } from "./redis";
export { StampedeGuard } from "./stampede";

export type {
  CacheStore,
  CacheEntry,
  CacheLayer,
  CachedFunction,
  CreateCacheOptions,
  WrapOptions,
} from "./types";

export type { RedisClient } from "./redis";

export const VERSION = "0.1.0";
