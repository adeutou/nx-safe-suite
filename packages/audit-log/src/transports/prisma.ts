import type { AuditEntry, AuditTransport } from "../types";

/**
 * Minimal Prisma model delegate interface.
 * Compatible with any Prisma model that has a `create` method.
 * The exact field names are configurable via `mapEntry`.
 */
export interface PrismaModelDelegate {
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
}

export interface PrismaTransportOptions {
  /**
   * The Prisma model delegate to write to.
   * @example { client: db.auditLog }
   */
  model: PrismaModelDelegate;
  /**
   * Transform an AuditEntry into the shape expected by your Prisma model.
   * Defaults to spreading the entire entry as-is, which works when your
   * table columns match the AuditEntry field names exactly.
   *
   * Use this when your schema uses different column names or needs extra
   * fields (e.g. a `createdById` FK derived from `actor.id`).
   *
   * @example
   * mapEntry: (entry) => ({
   *   action: entry.action,
   *   actorId: entry.actor?.id,
   *   resourceType: entry.resource?.type,
   *   resourceId: entry.resource?.id,
   *   payload: entry.payload,
   *   timestamp: new Date(entry.timestamp!),
   * })
   */
  mapEntry?: (entry: AuditEntry) => Record<string, unknown>;
}

function defaultMapEntry(entry: AuditEntry): Record<string, unknown> {
  return {
    ...entry,
    // Ensure timestamp is a Date object for Prisma DateTime fields
    timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
    // Stringify nested objects so they map to Json columns without issues
    actor: entry.actor ? JSON.parse(JSON.stringify(entry.actor)) : undefined,
    resource: entry.resource ? JSON.parse(JSON.stringify(entry.resource)) : undefined,
    payload: entry.payload ? JSON.parse(JSON.stringify(entry.payload)) : undefined,
  };
}

/**
 * Persists audit entries to a database via Prisma.
 *
 * @example
 * new PrismaTransport({ model: db.auditLog })
 *
 * @example
 * new PrismaTransport({
 *   model: db.auditLog,
 *   mapEntry: (entry) => ({
 *     action: entry.action,
 *     actorId: entry.actor?.id ?? null,
 *     metadata: entry.payload ?? {},
 *     occurredAt: new Date(entry.timestamp!),
 *   }),
 * })
 */
export class PrismaTransport implements AuditTransport {
  private readonly model: PrismaModelDelegate;
  private readonly mapEntry: (entry: AuditEntry) => Record<string, unknown>;

  constructor(opts: PrismaTransportOptions) {
    this.model = opts.model;
    this.mapEntry = opts.mapEntry ?? defaultMapEntry;
  }

  async send(entry: AuditEntry): Promise<void> {
    await this.model.create({ data: this.mapEntry(entry) });
  }
}
