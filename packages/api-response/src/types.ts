/**
 * Core type definitions for @nx-safe-suite/api-response.
 * All public shapes are defined here so consumers can import types
 * without pulling in any runtime code.
 */

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/**
 * HATEOAS link object. Each entry is a relation name → URL.
 * Common relations: "self", "next", "prev", "first", "last".
 */
export type ApiLinks = Record<string, string>;

// ---------------------------------------------------------------------------
// Success envelope
// ---------------------------------------------------------------------------

/** Offset-based pagination metadata. */
export interface OffsetPaginationMeta {
  kind: "offset";
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/** Cursor-based pagination metadata. */
export interface CursorPaginationMeta {
  kind: "cursor";
  cursor: string | null;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  /** Optional: total item count (may be omitted for performance). */
  total?: number;
}

export type PaginationMeta = OffsetPaginationMeta | CursorPaginationMeta;

/** Generic `meta` block attached to success responses. */
export interface ApiSuccessMeta {
  /** ISO 8601 timestamp of when the response was generated. */
  timestamp: string;
  /** Pagination info — present only on paginated responses. */
  pagination?: PaginationMeta;
  /** Arbitrary extra metadata the caller wants to surface. */
  [key: string]: unknown;
}

/**
 * Success envelope.
 *
 * ```json
 * {
 *   "data": { "id": "123", "name": "Albert" },
 *   "meta": { "timestamp": "2026-07-07T…" },
 *   "links": { "self": "/api/users/123" }
 * }
 * ```
 */
export interface ApiSuccessResponse<T> {
  data: T;
  meta: ApiSuccessMeta;
  links?: ApiLinks;
}

// ---------------------------------------------------------------------------
// Error envelope — RFC 9457 (Problem Details for HTTP APIs)
// ---------------------------------------------------------------------------

/**
 * A single field-level validation error.
 * Attached to the `errors` array on 422 responses.
 */
export interface ApiFieldError {
  /** JSON Pointer (RFC 6901) to the offending field, e.g. "/body/email". */
  pointer: string;
  /** Human-readable message for this field. */
  message: string;
}

/**
 * RFC 9457 Problem Details error envelope, extended with:
 * - `code`: a machine-readable business error code (e.g. "USER_NOT_FOUND")
 * - `errors`: field-level validation errors (for 422 responses)
 * - `meta`: arbitrary extra context
 *
 * ```json
 * {
 *   "type": "https://api.example.com/problems/validation-error",
 *   "title": "Unprocessable Entity",
 *   "status": 422,
 *   "detail": "One or more fields failed validation.",
 *   "instance": "/api/users",
 *   "code": "VALIDATION_ERROR",
 *   "errors": [{ "pointer": "/body/email", "message": "Invalid email" }]
 * }
 * ```
 */
export interface ApiErrorResponse {
  /** URI identifying the problem type. Use "about:blank" for generic errors. */
  type: string;
  /** Short, human-readable summary of the problem type. */
  title: string;
  /** HTTP status code. */
  status: number;
  /** Human-readable explanation of this specific occurrence. */
  detail?: string;
  /** URI reference identifying this specific occurrence (usually the request path). */
  instance?: string;
  /** Machine-readable business error code for programmatic handling. */
  code?: string;
  /** Field-level errors, populated on 422 Unprocessable Entity responses. */
  errors?: ApiFieldError[];
  /** Arbitrary extra context. */
  meta?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Options passed to helper functions
// ---------------------------------------------------------------------------

export interface OffsetPaginationOptions {
  kind: "offset";
  page: number;
  limit: number;
  total: number;
}

export interface CursorPaginationOptions {
  kind: "cursor";
  cursor: string | null;
  hasNextPage: boolean;
  hasPrevPage?: boolean;
  total?: number;
}

export type PaginationOptions = OffsetPaginationOptions | CursorPaginationOptions;

export interface SuccessOptions {
  /** HATEOAS links to include in the response. */
  links?: ApiLinks;
  /** Pagination options — triggers inclusion of pagination meta. */
  pagination?: PaginationOptions;
  /** Any extra key/value pairs to merge into the `meta` block. */
  meta?: Record<string, unknown>;
  /** HTTP status code override (default depends on helper, e.g. 200 for ok()). */
  status?: number;
  /** Extra headers to include in the Response. */
  headers?: Record<string, string>;
}

export interface ErrorOptions {
  detail?: string;
  instance?: string;
  code?: string;
  errors?: ApiFieldError[];
  meta?: Record<string, unknown>;
  /** Override the default problem type URI. */
  type?: string;
  /** Extra headers to include in the Response. */
  headers?: Record<string, string>;
}
