import type { ApiErrorResponse, ErrorOptions } from "./types";

const PROBLEM_CONTENT_TYPE = "application/problem+json";

/** Default RFC 9457 problem type URIs. Override via `opts.type`. */
const PROBLEM_TYPES: Record<number, string> = {
  400: "about:blank",
  401: "about:blank",
  403: "about:blank",
  404: "about:blank",
  409: "about:blank",
  422: "about:blank",
  429: "about:blank",
  500: "about:blank",
};

/** HTTP status → default title mapping (RFC 9457 §4.2). */
const STATUS_TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
};

function buildErrorBody(status: number, opts: ErrorOptions = {}): ApiErrorResponse {
  return {
    type: opts.type ?? PROBLEM_TYPES[status] ?? "about:blank",
    title: STATUS_TITLES[status] ?? "Error",
    status,
    ...(opts.detail ? { detail: opts.detail } : {}),
    ...(opts.instance ? { instance: opts.instance } : {}),
    ...(opts.code ? { code: opts.code } : {}),
    ...(opts.errors?.length ? { errors: opts.errors } : {}),
    ...(opts.meta ? { meta: opts.meta } : {}),
  };
}

/**
 * Generic error response builder. Use the shorthand helpers below for
 * common HTTP error codes.
 *
 * The response `Content-Type` is set to `application/problem+json`
 * as required by RFC 9457.
 *
 * @example
 * return error(418, { detail: "I'm a teapot", code: "TEAPOT" });
 */
export function error(status: number, opts: ErrorOptions = {}): Response {
  return Response.json(buildErrorBody(status, opts), {
    status,
    headers: {
      "Content-Type": PROBLEM_CONTENT_TYPE,
      ...opts.headers,
    },
  });
}

/**
 * 400 Bad Request — malformed request syntax or invalid parameters.
 *
 * @example
 * return badRequest({ detail: "Missing required field: email", code: "MISSING_FIELD" });
 */
export function badRequest(opts: ErrorOptions = {}): Response {
  return error(400, opts);
}

/**
 * 401 Unauthorized — authentication is required and has failed or not been provided.
 *
 * @example
 * return unauthorized({ detail: "Bearer token is missing or expired." });
 */
export function unauthorized(opts: ErrorOptions = {}): Response {
  return error(401, {
    ...opts,
    headers: { "WWW-Authenticate": "Bearer", ...opts.headers },
  });
}

/**
 * 403 Forbidden — authenticated but not permitted.
 *
 * @example
 * return forbidden({ detail: "Admin role required.", code: "INSUFFICIENT_PERMISSIONS" });
 */
export function forbidden(opts: ErrorOptions = {}): Response {
  return error(403, opts);
}

/**
 * 404 Not Found.
 *
 * @example
 * return notFound({ detail: `User ${id} not found.`, code: "USER_NOT_FOUND" });
 */
export function notFound(opts: ErrorOptions = {}): Response {
  return error(404, opts);
}

/**
 * 409 Conflict — state conflict (e.g. duplicate resource).
 *
 * @example
 * return conflict({ detail: "Email already in use.", code: "DUPLICATE_EMAIL" });
 */
export function conflict(opts: ErrorOptions = {}): Response {
  return error(409, opts);
}

/**
 * 422 Unprocessable Entity — validation errors on request body/params.
 * Pass `errors` for field-level details.
 *
 * @example
 * return unprocessable({
 *   detail: "Validation failed.",
 *   code: "VALIDATION_ERROR",
 *   errors: [{ pointer: "/body/email", message: "Invalid email address." }],
 * });
 */
export function unprocessable(opts: ErrorOptions = {}): Response {
  return error(422, opts);
}

/**
 * 429 Too Many Requests — rate limit exceeded.
 * Pass `retryAfter` (seconds) to set the `Retry-After` header.
 *
 * @example
 * return tooManyRequests({ detail: "Rate limit exceeded.", retryAfter: 60 });
 */
export function tooManyRequests(
  opts: ErrorOptions & { retryAfter?: number } = {},
): Response {
  const { retryAfter, ...errorOpts } = opts;
  return error(429, {
    ...errorOpts,
    headers: {
      ...(retryAfter !== undefined ? { "Retry-After": String(retryAfter) } : {}),
      ...errorOpts.headers,
    },
  });
}

/**
 * 500 Internal Server Error.
 * Detail is intentionally vague by default to avoid leaking internals.
 *
 * @example
 * return internalServerError({ code: "DB_CONNECTION_FAILED" });
 */
export function internalServerError(opts: ErrorOptions = {}): Response {
  return error(500, {
    detail: "An unexpected error occurred. Please try again later.",
    ...opts,
  });
}
