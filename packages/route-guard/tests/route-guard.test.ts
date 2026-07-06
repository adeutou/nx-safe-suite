import { describe, expect, it, beforeEach } from "vitest";
import { z } from "zod";
import { createGuard } from "../src/guard";
import { LruRateLimiterStore, parseWindow } from "../src/rate-limit";
import { checkRoles } from "../src/rbac";
import { ForbiddenError } from "../src/errors";
import type { GuardUser } from "../src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(opts: {
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string>;
}): Request {
  const { method = "GET", url = "https://app.test/api/test", body, headers = {} } = opts;
  return new Request(url, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  });
}

const adminUser: GuardUser = { id: "user-1", roles: ["admin"] };
const editorUser: GuardUser = { id: "user-2", roles: ["editor"] };
const guestUser: GuardUser = { id: "user-3", roles: [] };

function makeGuard(user: GuardUser | null = adminUser) {
  return createGuard({
    getUserFromRequest: () => user,
  });
}

async function json(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// parseWindow
// ---------------------------------------------------------------------------

describe("parseWindow()", () => {
  it("passes through numbers as-is", () => {
    expect(parseWindow(5000)).toBe(5000);
  });

  it.each([
    ["500ms", 500],
    ["30s", 30_000],
    ["1m", 60_000],
    ["2h", 7_200_000],
    ["1d", 86_400_000],
  ])('parses "%s" → %d ms', (input, expected) => {
    expect(parseWindow(input)).toBe(expected);
  });

  it("throws on invalid format", () => {
    expect(() => parseWindow("5 minutes")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// LruRateLimiterStore
// ---------------------------------------------------------------------------

describe("LruRateLimiterStore", () => {
  let store: LruRateLimiterStore;

  beforeEach(() => {
    store = new LruRateLimiterStore();
  });

  it("allows requests within the limit", async () => {
    const result = await store.check("ip-1", 3, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("blocks requests that exceed the limit", async () => {
    await store.check("ip-2", 2, 60_000);
    await store.check("ip-2", 2, 60_000);
    const result = await store.check("ip-2", 2, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets the bucket after the window expires", async () => {
    await store.check("ip-3", 1, 1); // 1ms window
    await new Promise((r) => setTimeout(r, 10));
    const result = await store.check("ip-3", 1, 1);
    expect(result.allowed).toBe(true);
  });

  it("evicts oldest entry when maxEntries is reached", async () => {
    const tiny = new LruRateLimiterStore(2);
    await tiny.check("a", 1, 60_000);
    await tiny.check("b", 1, 60_000);
    // Adding "c" should evict "a"
    await tiny.check("c", 10, 60_000);
    // "a" should now be a fresh bucket (count reset)
    const result = await tiny.check("a", 10, 60_000);
    expect(result.remaining).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// checkRoles
// ---------------------------------------------------------------------------

describe("checkRoles()", () => {
  it("passes when user has a matching role", async () => {
    await expect(checkRoles(adminUser, ["admin", "superuser"])).resolves.toBeUndefined();
  });

  it("throws ForbiddenError when no role matches", async () => {
    await expect(checkRoles(guestUser, ["admin"])).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("passes when function returns true", async () => {
    await expect(checkRoles(adminUser, () => true)).resolves.toBeUndefined();
  });

  it("throws ForbiddenError when function returns false", async () => {
    await expect(checkRoles(adminUser, () => false)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("supports async role functions", async () => {
    const check = async (u: GuardUser) => u.roles.includes("editor");
    await expect(checkRoles(editorUser, check)).resolves.toBeUndefined();
    await expect(checkRoles(adminUser, check)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ---------------------------------------------------------------------------
// withGuard — authentication
// ---------------------------------------------------------------------------

describe("withGuard() — authentication", () => {
  it("returns 401 when user resolver returns null", async () => {
    const { withGuard } = makeGuard(null);
    const handler = withGuard({}, async () => new Response("ok"));
    const res = await handler(makeRequest({}));
    expect(res.status).toBe(401);
    expect(res.headers.get("Content-Type")).toContain("application/problem+json");
  });

  it("calls the handler when user is resolved", async () => {
    const { withGuard } = makeGuard(adminUser);
    const handler = withGuard({}, async (_req, { user }) =>
      Response.json({ id: user.id }),
    );
    const res = await handler(makeRequest({}));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.id).toBe("user-1");
  });

  it("skips auth when auth: false", async () => {
    const { withGuard } = makeGuard(null);
    const handler = withGuard({ auth: false }, async () => new Response("public"));
    const res = await handler(makeRequest({}));
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// withGuard — RBAC
// ---------------------------------------------------------------------------

describe("withGuard() — RBAC", () => {
  it("returns 403 when user lacks required role", async () => {
    const { withGuard } = makeGuard(editorUser);
    const handler = withGuard({ roles: ["admin"] }, async () => new Response("ok"));
    const res = await handler(makeRequest({}));
    expect(res.status).toBe(403);
  });

  it("passes when user satisfies role function", async () => {
    const { withGuard } = makeGuard(editorUser);
    const handler = withGuard(
      { roles: (u) => u.roles.includes("editor") },
      async () => new Response("ok"),
    );
    const res = await handler(makeRequest({}));
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// withGuard — schema validation
// ---------------------------------------------------------------------------

describe("withGuard() — schema validation", () => {
  const bodySchema = z.object({
    name: z.string().min(2),
    age: z.number().int().positive(),
  });

  it("returns 422 on invalid body", async () => {
    const { withGuard } = makeGuard();
    const handler = withGuard(
      { body: bodySchema },
      async (_req, { body }) => Response.json(body),
    );
    const res = await handler(
      makeRequest({ method: "POST", body: { name: "x", age: -1 } }),
    );
    expect(res.status).toBe(422);
    const body = await json(res);
    expect(Array.isArray(body.errors)).toBe(true);
  });

  it("passes validated body to handler", async () => {
    const { withGuard } = makeGuard();
    const handler = withGuard(
      { body: bodySchema },
      async (_req, { body }) => Response.json(body),
    );
    const res = await handler(
      makeRequest({ method: "POST", body: { name: "Albert", age: 30 } }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.name).toBe("Albert");
  });

  it("validates query string", async () => {
    const { withGuard } = makeGuard();
    const handler = withGuard(
      { query: z.object({ page: z.coerce.number().int().positive() }) },
      async (_req, { query }) => Response.json(query),
    );
    const res = await handler(
      makeRequest({ url: "https://app.test/api/items?page=2" }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.page).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// withGuard — rate limiting
// ---------------------------------------------------------------------------

describe("withGuard() — rate limiting", () => {
  it("blocks requests that exceed the route-level rate limit", async () => {
    const store = new LruRateLimiterStore();
    const { withGuard } = makeGuard();
    const handler = withGuard(
      { rateLimit: { max: 2, window: "1m", store } },
      async () => new Response("ok"),
    );
    const req = () => makeRequest({ url: "https://app.test/api/test", headers: { "x-forwarded-for": "1.2.3.4" } });
    await handler(req());
    await handler(req());
    const res = await handler(req());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeDefined();
  });

  it("skips rate limiting when rateLimit: false", async () => {
    const { withGuard } = createGuard({
      getUserFromRequest: () => adminUser,
      rateLimit: { max: 1, window: "1m" },
    });
    const handler = withGuard(
      { rateLimit: false },
      async () => new Response("ok"),
    );
    const req = () => makeRequest({ headers: { "x-forwarded-for": "9.9.9.9" } });
    for (let i = 0; i < 5; i++) {
      const res = await handler(req());
      expect(res.status).toBe(200);
    }
  });
});

// ---------------------------------------------------------------------------
// withGuard — custom error handlers
// ---------------------------------------------------------------------------

describe("withGuard() — custom error handlers", () => {
  it("uses onUnauthorized when provided", async () => {
    const { withGuard } = createGuard({
      getUserFromRequest: () => null,
      onUnauthorized: () => Response.json({ custom: true }, { status: 401 }),
    });
    const handler = withGuard({}, async () => new Response("ok"));
    const res = await handler(makeRequest({}));
    const body = await json(res);
    expect(body.custom).toBe(true);
  });

  it("uses onForbidden when provided", async () => {
    const { withGuard } = createGuard({
      getUserFromRequest: () => guestUser,
      onForbidden: () => Response.json({ blocked: true }, { status: 403 }),
    });
    const handler = withGuard({ roles: ["admin"] }, async () => new Response("ok"));
    const res = await handler(makeRequest({}));
    const body = await json(res);
    expect(body.blocked).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// withAction — Server Actions
// ---------------------------------------------------------------------------

describe("withAction() — Server Actions", () => {
  it("injects user context and returns action result", async () => {
    const { withAction } = makeGuard(adminUser);
    const action = withAction<{ title: string }, { id: string }>(
      {},
      async ({ user, input }) => ({ id: `${user.id}-${input.title}` }),
    );
    const result = await action({ title: "hello" });
    expect(result.id).toBe("user-1-hello");
  });

  it("throws when user resolver returns null", async () => {
    const { withAction } = makeGuard(null);
    const action = withAction({}, async () => "ok");
    await expect(action(undefined)).rejects.toThrow();
  });

  it("throws when user lacks required roles", async () => {
    const { withAction } = makeGuard(guestUser);
    const action = withAction({ roles: ["admin"] }, async () => "ok");
    await expect(action(undefined)).rejects.toThrow();
  });
});
