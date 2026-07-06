import { maskEntry } from "./masking";
import type { AuditEntry, AuditLogger, CreateAuditLogOptions } from "./types";

/**
 * Creates a configured audit logger.
 *
 * @example
 * ```ts
 * import { createAuditLog, ConsoleTransport, PrismaTransport } from "@nx-safe-suite/audit-log";
 *
 * export const audit = createAuditLog({
 *   serviceName: "my-saas-app",
 *   transports: [
 *     new ConsoleTransport({ pretty: true }),
 *     new PrismaTransport({ model: db.auditLog }),
 *   ],
 *   sensitiveFields: ["password", "ssn", "email", "creditCard"],
 * });
 *
 * // In a Server Action:
 * await audit.log({
 *   action: "user.delete",
 *   actor: { id: session.user.id },
 *   resource: { type: "user", id: targetId },
 *   status: "success",
 * });
 * ```
 */
export function createAuditLog(opts: CreateAuditLogOptions): AuditLogger {
  const {
    serviceName,
    transports,
    sensitiveFields = [],
    silent = false,
    defaultStatus = "success",
  } = opts;

  if (transports.length === 0) {
    throw new Error(
      "createAuditLog: at least one transport is required. " +
        "Pass e.g. `transports: [new ConsoleTransport()]`.",
    );
  }

  async function log(entry: AuditEntry): Promise<void> {
    // 1. Enrich with defaults
    const enriched: AuditEntry = {
      timestamp: new Date().toISOString(),
      status: defaultStatus,
      ...entry,
      ...(serviceName ? { service: serviceName } : {}),
    };

    // 2. Mask PII fields
    const masked = maskEntry(enriched, sensitiveFields);

    // 3. Send to all transports in parallel
    const results = await Promise.allSettled(
      transports.map((t) => t.send(masked as AuditEntry)),
    );

    if (!silent) {
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        const reasons = failures
          .map((r) => (r as PromiseRejectedResult).reason)
          .map((e) => (e instanceof Error ? e.message : String(e)))
          .join("; ");
        throw new Error(
          `${failures.length} audit transport(s) failed: ${reasons}`,
        );
      }
    }
  }

  return { log };
}
