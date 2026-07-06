// ---------------------------------------------------------------------------
// Cache entry
// ---------------------------------------------------------------------------

export interface CacheEntry<T> {
  value: T;
  /** Epoch ms when this entry expires. Undefined = never expires. */
  expiresAt: number | undefined;
  /** Tags associated with this entry for group invalidation. */
  tags: string[];
}

// ---------------------------------------------------------------------------
// Store interface — implemented by MemoryStore and RedisStore
// ---------------------------------------------------------------------------

/**
 * Pluggable storage backend interface.
 * Implement this to add a custom cache layer (DynamoDB, Cloudflare KV, etc.)
 */
export interface CacheStore {
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  /** Return all keys associated with a given tag. */
  keysByTag(tag: string): Promise<string[]>;
  /** Associate a key with one or more tags. */
  addTagKeys(tag: string, keys: string[]): Promise<void>;
  /** Remove a tag and all its key associations. */
  deleteTag(tag: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Options passed to createCache()
// ---------------------------------------------------------------------------

export type CacheLayer = CacheStore;

export interface CreateCacheOptions {
  /**
   * Storage layers in order of priority: first = fastest (L1 memory),
   * last = slowest (L2 Redis or L3 DB adapter).
   * At least one layer is required.
   */
  layers: [CacheLayer, ...CacheLayer[]];
  /** Default TTL in seconds. Undefined = entries never expire. */
  defaultTtl?: number;
  /**
   * Called after a cache miss is resolved from the source function.
   * Useful for metrics/logging.
   */
  onMiss?: (key: string, durationMs: number) => void;
  /**
   * Called on every cache hit.
   */
  onHit?: (key: string, layer: number) => void;
}

// ---------------------------------------------------------------------------
// Options passed to the cached wrapper function
// ---------------------------------------------------------------------------

export interface WrapOptions<TArgs extends unknown[]> {
  /**
   * Derive the cache key from the function arguments.
   * Defaults to JSON.stringify of all args.
   */
  key?: (...args: TArgs) => string;
  /**
   * Tags to associate with the cached value.
   * Accepts a static array or a function of the args.
   */
  tags?: string[] | ((...args: TArgs) => string[]);
  /** TTL in seconds — overrides the global default. */
  ttl?: number;
  /**
   * Revalidation interval in seconds (stale-while-revalidate).
   * When set, a stale entry is returned immediately while the source
   * is refreshed in the background.
   */
  revalidate?: number;
}

// ---------------------------------------------------------------------------
// The wrapped cached function shape
// ---------------------------------------------------------------------------

export interface CachedFunction<TArgs extends unknown[], TReturn> {
  (...args: TArgs): Promise<TReturn>;
  /** Invalidate cached entries by tag. */
  invalidateTag(...tags: string[]): Promise<void>;
  /** Invalidate a specific key. */
  invalidateKey(key: string): Promise<void>;
  /** Clear the entire cache across all layers. */
  clearAll(): Promise<void>;
}
