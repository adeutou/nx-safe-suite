// ---------------------------------------------------------------------------
// Audit entry — the canonical log shape
// ---------------------------------------------------------------------------

/**
 * The actor who performed the action.
 * All fields are optional so the package works both pre- and post-auth.
 */
export interface AuditActor {
  /** User ID (from session, JWT sub, etc.) */
  id?: string;
  /** Human-readable identifier (email, username). Will be masked if in sensitiveFields. */
  name?: string;
  /** Role or type of actor (e.g. "admin", "service-account"). */
  role?: string;
  /** Client IP address. */
  ip?: string;
  /** User-Agent string. */
  userAgent?: string;
}

/**
 * The resource that was affected by the action.
 */
export interface AuditResource {
  /** Resource type, e.g. "user", "project", "invoice". */
  type: string;
  /** Resource identifier. */
  id?: string;
  /** Human-readable label for the resource. */
  label?: string;
}

/**
 * A single audit log entry.
 * Designed to be compatible with OpenTelemetry structured logging conventions.
 */
export interface AuditEntry {
  /** ISO 8601 timestamp. Auto-populated if omitted. */
  timestamp?: string;
  /** Dot-separated action name, e.g. "user.create", "invoice.delete". */
  action: string;
  /** Who performed the action. */
  actor?: AuditActor;
  /** What was affected. */
  resource?: AuditResource;
  /** Outcome of the action. */
  status?: "success" | "failure" | "attempt";
  /** Arbitrary structured metadata. PII fields will be masked before transport. */
  payload?: Record<string, unknown>;
  /** Service or application name — populated from createAuditLog options. */
  service?: string;
  /** Correlation / trace ID for linking with APM traces. */
  traceId?: string;
  /** Any extra fields. */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Transport interface
// ---------------------------------------------------------------------------

/**
 * A transport receives a finalized, masked AuditEntry and persists it.
 * Implement this interface to add custom destinations (Axiom, Datadog, etc.)
 */
export interface AuditTransport {
  send(entry: AuditEntry): Promise<void>;
}

// ---------------------------------------------------------------------------
// createAuditLog options
// ---------------------------------------------------------------------------

export interface CreateAuditLogOptions {
  /** Service / application name added to every entry. */
  serviceName?: string;
  /**
   * One or more transports that receive completed entries.
   * Entries are sent to all transports in parallel.
   */
  transports: AuditTransport[];
  /**
   * Top-level and nested field names whose values will be replaced with
   * the string `"[REDACTED]"` before the entry is sent to any transport.
   *
   * The check is **case-insensitive** and applies recursively to nested
   * objects and array items inside `payload` and `actor`.
   *
   * @example ["password", "ssn", "creditCard", "email"]
   */
  sensitiveFields?: string[];
  /**
   * When true, errors thrown by transports are swallowed rather than
   * propagated. Useful in production to ensure a logging failure never
   * breaks the main request path.
   * Defaults to `false`.
   */
  silent?: boolean;
  /**
   * Default status applied when none is provided per-entry.
   * Defaults to `"success"`.
   */
  defaultStatus?: AuditEntry["status"];
}

// ---------------------------------------------------------------------------
// The logger returned by createAuditLog
// ---------------------------------------------------------------------------

export interface AuditLogger {
  /**
   * Log an audit entry. Sends to all configured transports in parallel.
   *
   * @example
   * await audit.log({
   *   action: "user.delete",
   *   actor: { id: session.user.id, ip: req.headers.get("x-forwarded-for") },
   *   resource: { type: "user", id: targetUserId },
   *   payload: { reason: "GDPR request" },
   * });
   */
  log(entry: AuditEntry): Promise<void>;
}
