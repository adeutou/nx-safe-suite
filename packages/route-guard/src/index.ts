/**
 * @nx-safe-suite/route-guard
 * Declarative RBAC, rate-limiting and schema validation middleware
 * for Next.js API Routes and Server Actions.
 *
 * @packageDocumentation
 */

export { createGuard } from "./guard";
export { LruRateLimiterStore, parseWindow, defaultKeyFrom } from "./rate-limit";
export {
  GuardError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
  ValidationError,
} from "./errors";

export type {
  GuardUser,
  GuardContext,
  GlobalGuardOptions,
  RouteGuardOptions,
  RateLimiterStore,
  RateLimitResult,
  RateLimitOptions,
  JwtOptions,
  ValidationIssue,
  GuardedHandler,
  GuardedAction,
  InferBody,
  InferQuery,
  InferParams,
} from "./types";

export const VERSION = "0.1.0";
