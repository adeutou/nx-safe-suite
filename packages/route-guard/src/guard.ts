import { ZodError, type ZodTypeAny, z } from "zod";
import {
  ForbiddenError,
  GuardError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from "./errors";
import { extractBearerToken, verifyJwt } from "./jwt";
import { defaultKeyFrom, getDefaultStore, parseWindow } from "./rate-limit";
import { checkRoles } from "./rbac";
import type {
  GlobalGuardOptions,
  GuardContext,
  GuardUser,
  RouteGuardOptions,
  ValidationIssue,
} from "./types";

// ---------------------------------------------------------------------------
// Default error responses (RFC 9457 via inline JSON — no circular dep on
// api-response since the consumer may or may not use that package)
// ---------------------------------------------------------------------------

function problemJson(status: number, title: string, detail?: string, extra?: object): Response {
  return new Response(
    JSON.stringify({ type: "about:blank", title, status, ...(detail ? { detail } : {}), ...extra }),
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

function defaultUnauthorized(reason: string): Response {
  return problemJson(401, "Unauthorized", reason);
}

function defaultForbidden(reason: string): Response {
  return problemJson(403, "Forbidden", reason);
}

function defaultRateLimited(resetAt: number): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return new Response(
    JSON.stringify({ type: "about:blank", title: "Too Many Requests", status: 429 }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/problem+json",
        "Retry-After": String(retryAfter),
      },
    },
  );
}

function defaultValidationError(issues: ValidationIssue[]): Response {
  return problemJson(422, "Unprocessable Entity", "Request validation failed.", {
    errors: issues,
  });
}

// ---------------------------------------------------------------------------
// Schema validation helper
// ---------------------------------------------------------------------------

async function validateSchema<T extends ZodTypeAny>(
  schema: T,
  data: unknown,
  prefix: string,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; issues: ValidationIssue[] }> {
  const result = await schema.safeParseAsync(data);
  if (result.success) return { ok: true, data: result.data };

  const issues: ValidationIssue[] = (result.error as ZodError).issues.map((e) => ({
    pointer: `/${prefix}/${e.path.join("/")}`,
    message: e.message,
  }));

  return { ok: false, issues };
}

// ---------------------------------------------------------------------------
// createGuard
// ---------------------------------------------------------------------------

/**
 * Creates a configured guard factory.
 *
 * @example
 * ```ts
 * const guard = createGuard({
 *   jwt: { secret: env.JWT_SECRET },
 *   rateLimit: { max: 100, window: "1m" },
 * });
 *
 * export const POST = guard.withGuard(
 *   { roles: ["admin"], body: z.object({ name: z.string() }) },
 *   async (req, { user, body }) => {
 *     return Response.json({ created: body.name, by: user.id });
 *   },
 * );
 * ```
 */
export function createGuard(globalOpts: GlobalGuardOptions = {}) {
  // ---------------------------------------------------------------------------
  // Core pipeline — shared between withGuard and withAction
  // ---------------------------------------------------------------------------
  async function runPipeline<
    TBody extends ZodTypeAny,
    TQuery extends ZodTypeAny,
    TParams extends ZodTypeAny,
  >(
    req: Request,
    routeOpts: RouteGuardOptions<TBody, TQuery, TParams>,
    rawBody: unknown,
    rawQuery: unknown,
    rawParams: unknown,
  ): Promise<
    | { ok: true; ctx: GuardContext<z.infer<TBody>, z.infer<TQuery>, z.infer<TParams>> }
    | { ok: false; response: Response }
  > {
    const authRequired = routeOpts.auth !== false;

    // ------------------------------------------------------------------
    // 1. Rate limiting
    // ------------------------------------------------------------------
    const rlOpts = routeOpts.rateLimit !== false
      ? (routeOpts.rateLimit ?? globalOpts.rateLimit)
      : undefined;

    if (rlOpts) {
      const store = rlOpts.store ?? getDefaultStore();
      const windowMs = parseWindow(rlOpts.window);
      const keyFn = rlOpts.keyFrom ?? globalOpts.rateLimit?.keyFrom ?? defaultKeyFrom;
      const key = await keyFn(req);
      const result = await store.check(key, rlOpts.max, windowMs);

      if (!result.allowed) {
        const response = globalOpts.onRateLimited
          ? await globalOpts.onRateLimited(result, req)
          : defaultRateLimited(result.resetAt);
        return { ok: false, response };
      }
    }

    // ------------------------------------------------------------------
    // 2. Authentication
    // ------------------------------------------------------------------
    let user: GuardUser | null = null;

    if (authRequired) {
      try {
        if (globalOpts.getUserFromRequest) {
          user = await globalOpts.getUserFromRequest(req);
          if (!user) throw new UnauthorizedError("Could not resolve user from request.");
        } else if (globalOpts.jwt) {
          const token = extractBearerToken(req);
          if (!token) throw new UnauthorizedError("Missing Bearer token.");
          user = await verifyJwt(token, globalOpts.jwt);
        } else {
          throw new Error(
            "createGuard: auth is required but neither `jwt` nor `getUserFromRequest` is configured.",
          );
        }
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          const response = globalOpts.onUnauthorized
            ? await globalOpts.onUnauthorized(error.message, req)
            : defaultUnauthorized(error.message);
          return { ok: false, response };
        }
        throw error;
      }
    }

    // ------------------------------------------------------------------
    // 3. Authorization (RBAC)
    // ------------------------------------------------------------------
    if (routeOpts.roles && user) {
      try {
        await checkRoles(user, routeOpts.roles);
      } catch (error) {
        if (error instanceof ForbiddenError) {
          const response = globalOpts.onForbidden
            ? await globalOpts.onForbidden(error.message, req)
            : defaultForbidden(error.message);
          return { ok: false, response };
        }
        throw error;
      }
    }

    // ------------------------------------------------------------------
    // 4. Schema validation
    // ------------------------------------------------------------------
    const allIssues: ValidationIssue[] = [];
    let validatedBody: z.infer<TBody> = rawBody as z.infer<TBody>;
    let validatedQuery: z.infer<TQuery> = rawQuery as z.infer<TQuery>;
    let validatedParams: z.infer<TParams> = rawParams as z.infer<TParams>;

    if (routeOpts.body) {
      const result = await validateSchema(routeOpts.body, rawBody, "body");
      if (result.ok) validatedBody = result.data;
      else allIssues.push(...result.issues);
    }

    if (routeOpts.query) {
      const result = await validateSchema(routeOpts.query, rawQuery, "query");
      if (result.ok) validatedQuery = result.data;
      else allIssues.push(...result.issues);
    }

    if (routeOpts.params) {
      const result = await validateSchema(routeOpts.params, rawParams, "params");
      if (result.ok) validatedParams = result.data;
      else allIssues.push(...result.issues);
    }

    if (allIssues.length > 0) {
      const response = globalOpts.onValidationError
        ? await globalOpts.onValidationError(allIssues, req)
        : defaultValidationError(allIssues);
      return { ok: false, response };
    }

    return {
      ok: true,
      ctx: {
        user: user as GuardUser,
        body: validatedBody,
        query: validatedQuery,
        params: validatedParams,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // withGuard — wraps Next.js API Route handlers
  // ---------------------------------------------------------------------------
  function withGuard<
    TBody extends ZodTypeAny = ZodTypeAny,
    TQuery extends ZodTypeAny = ZodTypeAny,
    TParams extends ZodTypeAny = ZodTypeAny,
  >(
    routeOpts: RouteGuardOptions<TBody, TQuery, TParams>,
    handler: (
      req: Request,
      ctx: GuardContext<z.infer<TBody>, z.infer<TQuery>, z.infer<TParams>>,
      nextParams?: unknown,
    ) => Response | Promise<Response>,
  ) {
    return async function guardedRoute(
      req: Request,
      nextParams?: unknown,
    ): Promise<Response> {
      try {
        // Parse body
        let rawBody: unknown = undefined;
        if (routeOpts.body && req.method !== "GET" && req.method !== "HEAD") {
          const contentType = req.headers.get("content-type") ?? "";
          if (contentType.includes("application/json")) {
            try {
              rawBody = await req.json();
            } catch {
              return problemJson(400, "Bad Request", "Request body is not valid JSON.");
            }
          }
        }

        // Parse query params
        const url = new URL(req.url);
        const rawQuery = Object.fromEntries(Array.from(url.searchParams));

        // Route params come from Next.js — passed via nextParams
        const rawParams =
          nextParams && typeof nextParams === "object" && "params" in nextParams
            ? (nextParams as { params: unknown }).params
            : {};

        const result = await runPipeline(req, routeOpts, rawBody, rawQuery, rawParams);
        if (!result.ok) return result.response;

        return await handler(req, result.ctx, nextParams);
      } catch (error) {
        if (error instanceof GuardError) {
          return problemJson(error.statusCode, error.name, error.message, {
            code: error.code,
          });
        }
        throw error;
      }
    };
  }

  // ---------------------------------------------------------------------------
  // withAction — wraps Next.js Server Actions
  // ---------------------------------------------------------------------------
  function withAction<TInput = unknown, TOutput = unknown>(
    routeOpts: Omit<RouteGuardOptions, "body" | "query" | "params">,
    action: (
      ctx: { user: GuardUser; input: TInput },
    ) => TOutput | Promise<TOutput>,
  ) {
    return async function guardedAction(input: TInput): Promise<TOutput> {
      // Server Actions don't have a real Request; synthesise a minimal one
      // so the pipeline (rate-limiting, auth, roles) can run.
      const req = new Request("https://internal/action", { method: "POST" });

      const result = await runPipeline(req, routeOpts, undefined, undefined, undefined);
      if (!result.ok) {
        // Server Actions can't return Responses — throw an error instead
        throw new GuardError(
          `Action blocked: ${result.response.status}`,
          result.response.status,
          "ACTION_BLOCKED",
        );
      }

      return await action({ user: result.ctx.user, input });
    };
  }

  return { withGuard, withAction };
}
