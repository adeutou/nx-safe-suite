const REDACTED = "[REDACTED]";

/**
 * Recursively masks sensitive fields in an object.
 * The check is case-insensitive so "email", "Email" and "EMAIL" all match.
 *
 * - Plain objects: fields whose keys match `sensitiveFields` are redacted.
 * - Arrays: each element is processed recursively.
 * - Primitives: returned as-is (they have no keys to check).
 *
 * A shallow clone is returned — the original object is never mutated.
 */
export function maskSensitiveFields(
  value: unknown,
  sensitiveFields: string[],
): unknown {
  if (!sensitiveFields.length) return value;
  if (value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveFields(item, sensitiveFields));
  }

  const lower = sensitiveFields.map((f) => f.toLowerCase());
  const result: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (lower.includes(k.toLowerCase())) {
      result[k] = REDACTED;
    } else {
      result[k] = maskSensitiveFields(v, sensitiveFields);
    }
  }

  return result;
}

/**
 * Applies PII masking to the mutable parts of an AuditEntry:
 * `actor` and `payload`.
 */
export function maskEntry<T extends { actor?: unknown; payload?: unknown }>(
  entry: T,
  sensitiveFields: string[],
): T {
  if (!sensitiveFields.length) return entry;

  return {
    ...entry,
    ...(entry.actor !== undefined
      ? { actor: maskSensitiveFields(entry.actor, sensitiveFields) }
      : {}),
    ...(entry.payload !== undefined
      ? { payload: maskSensitiveFields(entry.payload, sensitiveFields) }
      : {}),
  };
}
