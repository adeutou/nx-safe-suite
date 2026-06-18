# nx-safe-suite

> A suite of type-safe, production-grade building blocks for Next.js backends.

[![CI](https://github.com/adeutou/nx-safe-suite/actions/workflows/ci.yml/badge.svg)](https://github.com/adeutou/nx-safe-suite/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

## Why

Next.js gives you a powerful set of primitives (API routes, Server Actions, RSC, middleware), but very few opinions on how to use them safely and consistently at scale. Most teams end up reinventing the same five things: environment validation, response shapes, auth/RBAC middleware, caching, and audit logging.

`nx-safe-suite` is a small, composable set of independently-publishable packages that solve each of those problems without locking you into a framework-on-top-of-a-framework.

## Packages

| Package                                          | Description                                                                  | Version                                                                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`@nx-safe-suite/env`](./packages/env)               | Strict, type-safe environment variable validation, powered by Zod.            | ![npm](https://img.shields.io/npm/v/@nx-safe-suite/env)               |
| [`@nx-safe-suite/api-response`](./packages/api-response) | RFC 9457 compliant, typed API response helpers (success, errors, pagination). | ![npm](https://img.shields.io/npm/v/@nx-safe-suite/api-response)      |
| [`@nx-safe-suite/route-guard`](./packages/route-guard)   | Declarative RBAC, rate-limiting and schema validation for routes & Server Actions. | ![npm](https://img.shields.io/npm/v/@nx-safe-suite/route-guard)       |
| [`@nx-safe-suite/server-cache`](./packages/server-cache) | Multi-tier (memory → Redis → source) server cache with tag-based invalidation. | ![npm](https://img.shields.io/npm/v/@nx-safe-suite/server-cache)      |
| [`@nx-safe-suite/audit-log`](./packages/audit-log)       | Structured, GDPR-friendly audit logging with pluggable transports.            | ![npm](https://img.shields.io/npm/v/@nx-safe-suite/audit-log)         |

Each package is independent, install only what you need. They're designed to compose well together, but none of them depends on the others by default.

## Quick start

```bash
pnpm add @nx-safe-suite/env zod
```

```ts
// env.ts
import { createEnv } from "@nx-safe-suite/env";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  runtimeEnv: process.env,
});
```

See each package's README for full documentation.

## Repository structure

This is a monorepo managed with [pnpm workspaces](https://pnpm.io/workspaces) and [Turborepo](https://turbo.build/repo).

```
next-safe-suite/
├── apps/
│   ├── docs/      # Documentation site
│   └── example/   # Next.js app demonstrating the packages together
├── packages/
│   ├── env/
│   ├── api-response/
│   ├── route-guard/
│   ├── server-cache/
│   └── audit-log/
└── .changeset/    # Versioning via Changesets
```

## Development

```bash
pnpm install     # install all workspace dependencies
pnpm build       # build all packages (via Turborepo)
pnpm test        # run all test suites
pnpm lint        # lint all packages
pnpm typecheck   # typecheck all packages
```

To work on a single package:

```bash
pnpm --filter @nx-safe-suite/env dev
```

## Contributing

Contributions are welcome. Please open an issue before starting work on a larger feature. Every pull request that changes the public behavior of a package should include a changeset:

```bash
pnpm changeset
```

## Release process

Releases are automated via [Changesets](https://github.com/changesets/changesets) and GitHub Actions:

1. Merge PRs with changesets into `main`.
2. The Release workflow opens a "Version Packages" PR aggregating all pending changesets.
3. Merging that PR triggers the build and publishes updated packages to npm.

## License

MIT © [Albert Deutou Ngodji](https://github.com/adeutou)
