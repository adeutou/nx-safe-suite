---
"@nx-safe-suite/server-cache": minor
---

Initial implementation: multi-tier cache (MemoryStore L1, RedisStore L2, pluggable interface), TTL expiry, tag-based invalidation, stale-while-revalidate, and stampede protection via Promise deduplication. 22 unit tests.
