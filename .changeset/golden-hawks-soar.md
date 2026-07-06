---
"@nx-safe-suite/audit-log": minor
---

Initial implementation: createAuditLog with ConsoleTransport, HttpTransport (with retry and timeout), and PrismaTransport (with custom mapEntry). Automatic PII masking via configurable sensitiveFields, enrichment with timestamp/service/status defaults, parallel dispatch to all transports, and silent mode for production resilience. 24 unit tests.
