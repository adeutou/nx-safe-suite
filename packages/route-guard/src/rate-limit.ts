import type { RateLimitResult, RateLimiterStore } from "./types";

// ---------------------------------------------------------------------------
// Window string parser — "1m" → 60_000ms, "1h" → 3_600_000ms, etc.
// ---------------------------------------------------------------------------

const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseWindow(window: number | string): number {
  if (typeof window === "number") return window;

  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$/.exec(window.trim());
  if (!match) {
    throw new Error(
      `Invalid rate-limit window "${window}". ` +
        'Use a number (ms) or a string like "500ms", "30s", "1m", "2h", "1d".',
    );
  }

  const [, value, unit] = match;
  return parseFloat(value!) * UNIT_MS[unit!]!;
}

// ---------------------------------------------------------------------------
// LRU bucket entry
// ---------------------------------------------------------------------------

interface Bucket {
  count: number;
  resetAt: number;
}

// ---------------------------------------------------------------------------
// Default IP key extractor
// ---------------------------------------------------------------------------

export function defaultKeyFrom(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// ---------------------------------------------------------------------------
// In-memory LRU store
// ---------------------------------------------------------------------------

/**
 * Simple in-memory rate limiter using a fixed-size LRU map.
 * Suitable for single-instance deployments. For distributed / serverless
 * environments, swap it for an Upstash or Redis store.
 *
 * @param maxEntries Maximum number of buckets to keep in memory (default 10_000).
 */
export class LruRateLimiterStore implements RateLimiterStore {
  private readonly buckets = new Map<string, Bucket>();
  private readonly maxEntries: number;

  constructor(maxEntries = 10_000) {
    this.maxEntries = maxEntries;
  }

  async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      // Evict oldest entry when at capacity
      if (!bucket && this.buckets.size >= this.maxEntries) {
        const oldest = this.buckets.keys().next().value;
        if (oldest !== undefined) this.buckets.delete(oldest);
      }
      bucket = { count: 0, resetAt: now + windowMs };
    }

    bucket.count += 1;
    this.buckets.set(key, bucket);

    // Move to end of insertion order (LRU refresh)
    this.buckets.delete(key);
    this.buckets.set(key, bucket);

    const allowed = bucket.count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt,
    };
  }

  /** Reset all buckets — useful in tests. */
  clear(): void {
    this.buckets.clear();
  }
}

// Shared default store (one per process)
const defaultStore = new LruRateLimiterStore();

export function getDefaultStore(): LruRateLimiterStore {
  return defaultStore;
}
