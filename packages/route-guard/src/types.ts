import type { ZodTypeAny, z } from "zod";

// ---------------------------------------------------------------------------
// User / Auth context
// ---------------------------------------------------------------------------

/**
 * The authenticated user object made available inside a guarded handler.
 * Extend this interface via module augmentation if you need custom fields:
 *
 * ```ts
 * declare module "@nx-safe-suite/route-guard" {
 *   interface GuardUser {
 *     organizationId: string;
 *   }
 * }
 * ```
 */
export interface GuardUser {
  /** Unique identifier (sub claim from JWT, or returned by getUserFromRequest). */
  id: string;
  /** Roles used for RBAC checks. */
  roles: string[];
  /** Raw JWT payload — available when using JWT mode. */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Rate limiter interface
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Epoch ms when the window resets. */
  resetAt: number;
}

/**
 * Pluggable rate limiter interface.
 * The built-in LRU implementation is used by default; swap it for
 * Upstash, Redis, or any other backend by passing a custom implementation
 * to `createGuard({ rateLimit: { store: myStore } })`.
 */
export interface RateLimiterStore {
  check(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

// ---------------------------------------------------------------------------
// Guard options (passed to createGuard)
// ---------------------------------------------------------------------------

export interface JwtOptions {
  /** JWT secret (HS256) or public key (RS256/ES256). */
  secret: string | Uint8Array;
  /** Expected algorithm. Defaults to "HS256". */
  algorithm?: string;
  /** Expected audience claim. */
  audience?: string;
  /** Expected issuer claim. */
  issuer?: string;
}

export interface RateLimitOptions {
  /** Maximum number of requests per window. */
  max: number;
  /**
   * Window duration. Accepts a number (ms) or a human-readable string
   * like "1m", "15m", "1h".
   */
  window: number | string;
  /**
   * How to derive the rate-limit key from a request.
   * Defaults to the client IP (x-forwarded-for → x-real-ip → "unknown").
   */
  keyFrom?: (req: Request) => string | Promise<string>;
  /** Custom store — defaults to built-in LRU. */
  store?: RateLimiterStore;
}

export interface GlobalGuardOptions {
  /** JWT configuration — required for JWT-based auth. */
  jwt?: JwtOptions;
  /**
   * Override how the current user is resolved from a request.
   * When provided, JWT verification is skipped and this function
   * is called instead. Return null/undefined to signal unauthenticated.
   */
  getUserFromRequest?: (req: Request) => GuardUser | null | Promise<GuardUser | null>;
  /** Default rate-limit applied to every guarded route. */
  rateLimit?: RateLimitOptions;
  /**
   * Called when authentication fails (401).
   * Return a custom Response to override the default RFC 9457 body.
   */
  onUnauthorized?: (reason: string, req: Request) => Response | Promise<Response>;
  /**
   * Called when authorization fails (403).
   */
  onForbidden?: (reason: string, req: Request) => Response | Promise<Response>;
  /**
   * Called when rate limit is exceeded (429).
   */
  onRateLimited?: (result: RateLimitResult, req: Request) => Response | Promise<Response>;
  /**
   * Called when schema validation fails (422).
   */
  onValidationError?: (
    errors: ValidationIssue[],
    req: Request,
  ) => Response | Promise<Response>;
}

// ---------------------------------------------------------------------------
// Per-route options (passed to withGuard / withAction)
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  pointer: string;
  message: string;
}

export interface RouteGuardOptions<
  TBody extends ZodTypeAny = ZodTypeAny,
  TQuery extends ZodTypeAny = ZodTypeAny,
  TParams extends ZodTypeAny = ZodTypeAny,
> {
  /**
   * Required roles. Pass an array of strings (any match grants access),
   * or a function for dynamic/attribute-based checks.
   */
  roles?: string[] | ((user: GuardUser) => boolean | Promise<boolean>);
  /** Whether authentication is required. Defaults to true. */
  auth?: boolean;
  /** Route-level rate limit — overrides the global default. */
  rateLimit?: RateLimitOptions | false;
  /** Zod schema to validate the request body. */
  body?: TBody;
  /** Zod schema to validate the query string. */
  query?: TQuery;
  /** Zod schema to validate route params. */
  params?: TParams;
}

// ---------------------------------------------------------------------------
// Handler context
// ---------------------------------------------------------------------------

/**
 * The context object injected into guarded handlers.
 * `user` is only present when `auth: true` (the default).
 */
export interface GuardContext<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown,
> {
  /** Authenticated user — present when auth is required. */
  user: GuardUser;
  /** Validated and typed request body. */
  body: TBody;
  /** Validated and typed query string. */
  query: TQuery;
  /** Validated and typed route params. */
  params: TParams;
}

/**
 * Guarded handler function signature (API Routes).
 */
export type GuardedHandler<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown,
> = (
  req: Request,
  ctx: GuardContext<TBody, TQuery, TParams>,
  nextParams?: unknown,
) => Response | Promise<Response>;

/**
 * Guarded Server Action function signature.
 * Server Actions don't receive a Request; use FormData or plain args.
 */
export type GuardedAction<TInput = unknown, TOutput = unknown> = (
  ctx: Omit<GuardContext, "body" | "query" | "params"> & { input: TInput },
) => TOutput | Promise<TOutput>;

// ---------------------------------------------------------------------------
// Inferred types for consumers
// ---------------------------------------------------------------------------

export type InferBody<T extends ZodTypeAny> = z.infer<T>;
export type InferQuery<T extends ZodTypeAny> = z.infer<T>;
export type InferParams<T extends ZodTypeAny> = z.infer<T>;
