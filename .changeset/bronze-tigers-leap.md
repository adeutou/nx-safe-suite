---
"@nx-safe-suite/route-guard": minor
---

Initial implementation: declarative RBAC (array or function), JWT auth (jose, optional peer dep), custom getUserFromRequest override, in-memory LRU rate limiting with pluggable store interface, Zod schema validation for body/query/params, Server Action support via withAction(), and RFC 9457 error responses. 31 unit tests.
