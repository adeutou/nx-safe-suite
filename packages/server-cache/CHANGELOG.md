# @nx-safe-suite/server-cache

## 0.1.0

### Minor Changes

- 91dc4df: Initial implementation: multi-tier cache (MemoryStore L1, RedisStore L2, pluggable interface), TTL expiry, tag-based invalidation, stale-while-revalidate, and stampede protection via Promise deduplication. 22 unit tests.
