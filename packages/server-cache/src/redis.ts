import type { CacheEntry, CacheStore } from "./types";

/**
 * Minimal Redis client interface — compatible with both `ioredis` and
 * `@upstash/redis` without a hard dependency on either.
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  flushdb?(): Promise<unknown>;
  sadd(key: string, ...members: string[]): Promise<unknown>;
  smembers(key: string): Promise<string[]>;
  srem(key: string, ...members: string[]): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
}

const TAG_KEY_PREFIX = "__nss_tag:";

/**
 * Redis-backed cache store (L2).
 * Entries are serialised as JSON. Tags are stored in Redis Sets.
 *
 * @example
 * import Redis from "ioredis";
 * const store = new RedisStore(new Redis(process.env.REDIS_URL));
 *
 * @example
 * import { Redis } from "@upstash/redis";
 * const store = new RedisStore(Redis.fromEnv());
 */
export class RedisStore implements CacheStore {
  constructor(private readonly client: RedisClient) {}

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;

    try {
      const entry = JSON.parse(raw) as CacheEntry<T>;
      // Double-check TTL in case Redis TTL and our expiresAt diverge
      if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
        await this.delete(key);
        return null;
      }
      return entry;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    const serialised = JSON.stringify(entry);
    if (entry.expiresAt !== undefined) {
      const ttlMs = entry.expiresAt - Date.now();
      if (ttlMs <= 0) return; // already expired
      const ttlSeconds = Math.ceil(ttlMs / 1000);
      // ioredis: set(key, value, "EX", seconds)
      // @upstash/redis: set(key, value, { ex: seconds })
      // We try ioredis syntax first; Upstash also accepts positional EX.
      await this.client.set(key, serialised, "EX", ttlSeconds);
    } else {
      await this.client.set(key, serialised);
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async clear(): Promise<void> {
    await this.client.flushdb?.();
  }

  async keysByTag(tag: string): Promise<string[]> {
    return this.client.smembers(`${TAG_KEY_PREFIX}${tag}`);
  }

  async addTagKeys(tag: string, keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.client.sadd(`${TAG_KEY_PREFIX}${tag}`, ...keys);
  }

  async deleteTag(tag: string): Promise<void> {
    const tagKey = `${TAG_KEY_PREFIX}${tag}`;
    const keys = await this.client.smembers(tagKey);
    if (keys.length > 0) await this.client.del(...keys);
    await this.client.del(tagKey);
  }
}
