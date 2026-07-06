import { describe, expect, it } from "vitest";
import {
  accepted,
  ApiResponse,
  badRequest,
  conflict,
  created,
  error,
  forbidden,
  internalServerError,
  noContent,
  notFound,
  ok,
  tooManyRequests,
  unauthorized,
  unprocessable,
} from "../src/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function json(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Success helpers
// ---------------------------------------------------------------------------

describe("ok()", () => {
  it("returns 200 with data and meta", async () => {
    const res = ok({ id: "1", name: "Albert" });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({ id: "1", name: "Albert" });
    expect(typeof (body.meta as Record<string, unknown>).timestamp).toBe("string");
  });

  it("includes links when provided", async () => {
    const res = ok({ id: "1" }, { links: { self: "/api/users/1" } });
    const body = await json(res);
    expect((body.links as Record<string, string>).self).toBe("/api/users/1");
  });

  it("merges extra meta fields", async () => {
    const res = ok({}, { meta: { requestId: "abc-123" } });
    const body = await json(res);
    expect((body.meta as Record<string, unknown>).requestId).toBe("abc-123");
  });

  it("allows status override", () => {
    const res = ok({}, { status: 206 });
    expect(res.status).toBe(206);
  });
});

describe("created()", () => {
  it("returns 201", () => {
    expect(created({ id: "1" }).status).toBe(201);
  });

  it("sets Location header when links.self is provided", () => {
    const res = created({ id: "1" }, { links: { self: "/api/users/1" } });
    expect(res.headers.get("Location")).toBe("/api/users/1");
  });
});

describe("accepted()", () => {
  it("returns 202", () => {
    expect(accepted({ jobId: "x" }).status).toBe(202);
  });
});

describe("noContent()", () => {
  it("returns 204 with no body", async () => {
    const res = noContent();
    expect(res.status).toBe(204);
    const text = await res.text();
    expect(text).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe("offset pagination", async () => {
  const res = ok([], {
    pagination: { kind: "offset", page: 2, limit: 10, total: 95 },
  });
  const body = await json(res);
  const meta = body.meta as Record<string, unknown>;
  const pagination = meta.pagination as Record<string, unknown>;

  it("attaches pagination to meta", () => {
    expect(pagination.kind).toBe("offset");
  });

  it("calculates totalPages correctly", () => {
    expect(pagination.totalPages).toBe(10); // ceil(95/10)
  });

  it("computes hasNextPage and hasPrevPage", () => {
    expect(pagination.hasNextPage).toBe(true);
    expect(pagination.hasPrevPage).toBe(true);
  });

  it("last page: hasNextPage is false", async () => {
    const r = ok([], { pagination: { kind: "offset", page: 10, limit: 10, total: 95 } });
    const b = await json(r);
    const p = (b.meta as Record<string, unknown>).pagination as Record<string, unknown>;
    expect(p.hasNextPage).toBe(false);
  });
});

describe("cursor pagination", async () => {
  const res = ok([], {
    pagination: { kind: "cursor", cursor: "abc123", hasNextPage: true, total: 500 },
  });
  const body = await json(res);
  const pagination = ((body.meta as Record<string, unknown>).pagination) as Record<string, unknown>;

  it("attaches cursor pagination to meta", () => {
    expect(pagination.kind).toBe("cursor");
    expect(pagination.cursor).toBe("abc123");
    expect(pagination.hasNextPage).toBe(true);
    expect(pagination.total).toBe(500);
  });

  it("cursor is null on last page", async () => {
    const r = ok([], { pagination: { kind: "cursor", cursor: null, hasNextPage: false } });
    const b = await json(r);
    const p = ((b.meta as Record<string, unknown>).pagination) as Record<string, unknown>;
    expect(p.cursor).toBeNull();
    expect(p.hasNextPage).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Error helpers — RFC 9457
// ---------------------------------------------------------------------------

describe("error()", () => {
  it("sets Content-Type to application/problem+json", () => {
    const res = error(418);
    expect(res.headers.get("Content-Type")).toContain("application/problem+json");
  });

  it("includes all RFC 9457 fields", async () => {
    const res = error(409, {
      detail: "Email taken",
      instance: "/api/users",
      code: "DUPLICATE_EMAIL",
    });
    const body = await json(res);
    expect(body.type).toBeDefined();
    expect(body.title).toBeDefined();
    expect(body.status).toBe(409);
    expect(body.detail).toBe("Email taken");
    expect(body.instance).toBe("/api/users");
    expect(body.code).toBe("DUPLICATE_EMAIL");
  });
});

describe("badRequest()", () => {
  it("returns 400", () => expect(badRequest().status).toBe(400));
});

describe("unauthorized()", () => {
  it("returns 401", () => expect(unauthorized().status).toBe(401));

  it("sets WWW-Authenticate: Bearer header", () => {
    const res = unauthorized();
    expect(res.headers.get("WWW-Authenticate")).toBe("Bearer");
  });
});

describe("forbidden()", () => {
  it("returns 403", () => expect(forbidden().status).toBe(403));
});

describe("notFound()", () => {
  it("returns 404 with code", async () => {
    const res = notFound({ code: "USER_NOT_FOUND" });
    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.code).toBe("USER_NOT_FOUND");
  });
});

describe("conflict()", () => {
  it("returns 409", () => expect(conflict().status).toBe(409));
});

describe("unprocessable()", () => {
  it("returns 422 with field errors", async () => {
    const res = unprocessable({
      detail: "Validation failed.",
      errors: [{ pointer: "/body/email", message: "Invalid email" }],
    });
    expect(res.status).toBe(422);
    const body = await json(res);
    const errors = body.errors as Array<Record<string, string>>;
    expect(errors[0]?.pointer).toBe("/body/email");
    expect(errors[0]?.message).toBe("Invalid email");
  });
});

describe("tooManyRequests()", () => {
  it("returns 429", () => expect(tooManyRequests().status).toBe(429));

  it("sets Retry-After header when retryAfter is passed", () => {
    const res = tooManyRequests({ retryAfter: 60 });
    expect(res.headers.get("Retry-After")).toBe("60");
  });
});

describe("internalServerError()", () => {
  it("returns 500 with safe default detail", async () => {
    const res = internalServerError();
    expect(res.status).toBe(500);
    const body = await json(res);
    expect(typeof body.detail).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// ApiResponse namespace
// ---------------------------------------------------------------------------

describe("ApiResponse namespace", () => {
  it("exposes all helpers", () => {
    expect(typeof ApiResponse.ok).toBe("function");
    expect(typeof ApiResponse.created).toBe("function");
    expect(typeof ApiResponse.noContent).toBe("function");
    expect(typeof ApiResponse.badRequest).toBe("function");
    expect(typeof ApiResponse.notFound).toBe("function");
    expect(typeof ApiResponse.unprocessable).toBe("function");
  });
});
