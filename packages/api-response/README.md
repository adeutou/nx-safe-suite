# @nx-safe-suite/api-response

> RFC 9457 compliant, typed API response helpers for Next.js.

[![npm version](https://img.shields.io/npm/v/@nx-safe-suite/api-response)](https://www.npmjs.com/package/@nx-safe-suite/api-response)
[![license](https://img.shields.io/npm/l/@nx-safe-suite/api-response)](../../LICENSE)

Part of the [nx-safe-suite](../../README.md) monorepo.

## Why

Every Next.js API route eventually needs the same five things: a consistent success envelope, RFC-compliant error shapes, pagination metadata, HATEOAS links, and the right `Content-Type` headers. Without a shared convention, teams end up with `{ data }` on one route, `{ result }` on another, and `{ error: "msg" }` on a third — making front-end code brittle and error-prone.

`@nx-safe-suite/api-response` gives you a small set of typed helpers that produce consistent, predictable JSON — and nothing else. No framework, no classes, just functions that return `Response` objects.

## Installation

```bash
pnpm add @nx-safe-suite/api-response
```

No peer dependencies required.

## Quick start

```ts
// app/api/users/[id]/route.ts
import { ok, notFound } from "@nx-safe-suite/api-response";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await db.user.findUnique({ where: { id: params.id } });

  if (!user) {
    return notFound({ code: "USER_NOT_FOUND", instance: `/api/users/${params.id}` });
  }

  return ok(user, { links: { self: `/api/users/${user.id}` } });
}
```

Or use the `ApiResponse` namespace if you prefer a single import:

```ts
import { ApiResponse } from "@nx-safe-suite/api-response";

return ApiResponse.ok(user);
return ApiResponse.forbidden({ code: "INSUFFICIENT_PERMISSIONS" });
```

## Response shapes

### Success — `{ data, meta, links? }`

```json
{
  "data": { "id": "123", "name": "Albert" },
  "meta": {
    "timestamp": "2026-07-07T12:00:00.000Z"
  },
  "links": {
    "self": "/api/users/123"
  }
}
```

### Error — RFC 9457 Problem Details

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "User 123 not found.",
  "instance": "/api/users/123",
  "code": "USER_NOT_FOUND"
}
```

Error responses use `Content-Type: application/problem+json` as required by RFC 9457.

## Success helpers

| Helper | Status | Notes |
|---|---|---|
| `ok(data, opts?)` | 200 | Standard success |
| `created(data, opts?)` | 201 | Sets `Location` header when `links.self` is provided |
| `accepted(data, opts?)` | 202 | For async jobs |
| `noContent(opts?)` | 204 | Empty body — for DELETE etc. |

## Error helpers

| Helper | Status |
|---|---|
| `badRequest(opts?)` | 400 |
| `unauthorized(opts?)` | 401 — sets `WWW-Authenticate: Bearer` |
| `forbidden(opts?)` | 403 |
| `notFound(opts?)` | 404 |
| `conflict(opts?)` | 409 |
| `unprocessable(opts?)` | 422 — accepts `errors` for field-level detail |
| `tooManyRequests(opts?)` | 429 — accepts `retryAfter` (seconds) for `Retry-After` header |
| `internalServerError(opts?)` | 500 |
| `error(status, opts?)` | Any — generic builder |

All error helpers accept:

```ts
{
  detail?: string;     // human-readable explanation
  instance?: string;   // URI of this specific occurrence (usually the request path)
  code?: string;       // machine-readable business code, e.g. "USER_NOT_FOUND"
  errors?: { pointer: string; message: string }[];  // field errors (422)
  meta?: Record<string, unknown>;
  headers?: Record<string, string>;
}
```

## Pagination

Pass a `pagination` option to any success helper to include pagination metadata in the `meta` block.

### Offset

```ts
return ok(users, {
  pagination: {
    kind: "offset",
    page: 2,
    limit: 20,
    total: 95,
  },
  links: {
    self: "/api/users?page=2",
    prev: "/api/users?page=1",
    next: "/api/users?page=3",
  },
});
```

```json
{
  "data": [...],
  "meta": {
    "timestamp": "...",
    "pagination": {
      "kind": "offset",
      "page": 2,
      "limit": 20,
      "total": 95,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPrevPage": true
    }
  },
  "links": { "self": "...", "prev": "...", "next": "..." }
}
```

### Cursor

```ts
return ok(posts, {
  pagination: {
    kind: "cursor",
    cursor: "eyJpZCI6IjEyMyJ9",
    hasNextPage: true,
  },
});
```

## TypeScript

The helpers are fully typed. Import the envelope types to share shapes between your backend and frontend:

```ts
import type { ApiSuccessResponse, ApiErrorResponse, OffsetPaginationMeta } from "@nx-safe-suite/api-response";

// In your fetch wrapper:
async function fetchUser(id: string): Promise<ApiSuccessResponse<User>> {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}
```

## License

MIT
