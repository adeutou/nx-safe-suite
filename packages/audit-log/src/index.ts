/**
 * @nx-safe-suite/audit-log
 * Structured, GDPR-friendly audit logging for Next.js with pluggable
 * transports (Console, HTTP webhook, Prisma).
 *
 * @packageDocumentation
 */

export { createAuditLog } from "./audit";
export { maskSensitiveFields, maskEntry } from "./masking";

// Transports
export { ConsoleTransport } from "./transports/console";
export { HttpTransport } from "./transports/http";
export { PrismaTransport } from "./transports/prisma";

// Types
export type {
  AuditEntry,
  AuditActor,
  AuditResource,
  AuditTransport,
  AuditLogger,
  CreateAuditLogOptions,
} from "./types";

export type { ConsoleTransportOptions } from "./transports/console";
export type { HttpTransportOptions } from "./transports/http";
export type { PrismaTransportOptions, PrismaModelDelegate } from "./transports/prisma";

export const VERSION = "0.1.0";
