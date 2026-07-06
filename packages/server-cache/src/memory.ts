import type { CacheEntry, CacheStore } from "./types";

/**
 * In-memory LRU cache store (L1).
 * Entries are evicted when the cache exceeds `maxSize` or when their TTL expires.
 */
export class MemoryStore implements CacheStore {
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly tagIndex = new Map<string, Set<string>>(); // tag → Set<key>
  private readonly maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    // Lazy TTL expiry
    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      await this.delete(key);
      return null;
    }

    // LRU refresh — move to end
    this.entries.delete(key);
    this.entries.set(key, entry as CacheEntry<unknown>);

    return entry;
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    // Evict oldest if at capacity
    if (!this.entries.has(key) && this.entries.size >= this.maxSize) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) await this.delete(oldest);
    }

    this.entries.delete(key);
    this.entries.set(key, entry as CacheEntry<unknown>);
  }

  async delete(key: string): Promise<void> {
    const entry = this.entries.get(key);
    if (entry) {
      // Clean up tag index
      for (const tag of entry.tags) {
        this.tagIndex.get(tag)?.delete(key);
      }
    }
    this.entries.delete(key);
  }

  async clear(): Promise<void> {
    this.entries.clear();
    this.tagIndex.clear();
  }

  async keysByTag(tag: string): Promise<string[]> {
    return Array.from(this.tagIndex.get(tag) ?? []);
  }

  async addTagKeys(tag: string, keys: string[]): Promise<void> {
    if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
    for (const key of keys) this.tagIndex.get(tag)!.add(key);
  }

  async deleteTag(tag: string): Promise<void> {
    const keys = await this.keysByTag(tag);
    for (const key of keys) await this.delete(key);
    this.tagIndex.delete(tag);
  }

  /** Number of entries currently in memory — useful for testing. */
  get size(): number {
    return this.entries.size;
  }
}
