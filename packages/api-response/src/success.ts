import { buildPaginationMeta } from "./pagination";
import type { ApiSuccessResponse, SuccessOptions } from "./types";

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
};

function buildSuccessBody<T>(data: T, opts: SuccessOptions = {}): ApiSuccessResponse<T> {
  const { links, pagination, meta: extraMeta } = opts;

  const meta = {
    timestamp: new Date().toISOString(),
    ...(pagination ? { pagination: buildPaginationMeta(pagination) } : {}),
    ...extraMeta,
  };

  return {
    data,
    meta,
    ...(links ? { links } : {}),
  };
}

/**
 * 200 OK — standard success response.
 *
 * @example
 * return ok(user, { links: { self: `/api/users/${user.id}` } });
 */
export function ok<T>(data: T, opts: SuccessOptions = {}): Response {
  const status = opts.status ?? 200;
  return Response.json(buildSuccessBody(data, opts), {
    status,
    headers: { ...DEFAULT_HEADERS, ...opts.headers },
  });
}

/**
 * 201 Created — resource was successfully created.
 * Automatically sets the `Location` header when `links.self` is provided.
 *
 * @example
 * return created(newUser, { links: { self: `/api/users/${newUser.id}` } });
 */
export function created<T>(data: T, opts: SuccessOptions = {}): Response {
  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
    ...opts.headers,
  };

  if (opts.links?.self) {
    headers["Location"] = opts.links.self;
  }

  return Response.json(buildSuccessBody(data, opts), { status: 201, headers });
}

/**
 * 202 Accepted — request accepted for async processing.
 *
 * @example
 * return accepted({ jobId: "abc-123" });
 */
export function accepted<T>(data: T, opts: SuccessOptions = {}): Response {
  return Response.json(buildSuccessBody(data, opts), {
    status: 202,
    headers: { ...DEFAULT_HEADERS, ...opts.headers },
  });
}

/**
 * 204 No Content — success with no body (e.g. DELETE).
 * Returns an empty Response; do not pass data.
 *
 * @example
 * return noContent();
 */
export function noContent(opts: Pick<SuccessOptions, "headers"> = {}): Response {
  return new Response(null, {
    status: 204,
    headers: opts.headers,
  });
}
