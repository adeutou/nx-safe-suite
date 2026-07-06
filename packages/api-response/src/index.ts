/**
 * @nx-safe-suite/api-response
 * RFC 9457 compliant, typed API response helpers for Next.js.
 *
 * @packageDocumentation
 */

export { ok, created, accepted, noContent } from "./success";
export {
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessable,
  tooManyRequests,
  internalServerError,
} from "./errors";
export { buildOffsetMeta, buildCursorMeta, buildPaginationMeta } from "./pagination";

export type {
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiSuccessMeta,
  ApiLinks,
  ApiFieldError,
  OffsetPaginationMeta,
  CursorPaginationMeta,
  PaginationMeta,
  OffsetPaginationOptions,
  CursorPaginationOptions,
  PaginationOptions,
  SuccessOptions,
  ErrorOptions,
} from "./types";

/**
 * Namespace-style API for those who prefer `ApiResponse.ok(...)` over
 * individual named imports.
 *
 * @example
 * import { ApiResponse } from "@nx-safe-suite/api-response";
 * return ApiResponse.ok(data);
 * return ApiResponse.notFound({ code: "USER_NOT_FOUND" });
 */
export const ApiResponse = {
  // Success
  ok,
  created,
  accepted,
  noContent,
  // Errors
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessable,
  tooManyRequests,
  internalServerError,
} as const;

// re-export for convenience inside the namespace object
import { ok, created, accepted, noContent } from "./success";
import {
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessable,
  tooManyRequests,
  internalServerError,
} from "./errors";

export const VERSION = "0.1.0";
