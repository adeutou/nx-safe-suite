# @nx-safe-suite/env

> Strict, type-safe environment variable validation for Next.js, powered by Zod.

[![npm version](https://img.shields.io/npm/v/@nx-safe-suite/env)](https://www.npmjs.com/package/@nx-safe-suite/env)
[![license](https://img.shields.io/npm/l/@nx-safe-suite/env)](../../LICENSE)

Part of the [nx-safe-suite](../../README.md) monorepo.

## Why

A missing or malformed environment variable shouldn't surface as a runtime crash three requests into production, or as `undefined` silently flowing through your app. `@nx-safe-suite/env` validates every variable your app needs **once**, at startup, against a [Zod](https://zod.dev) schema — and either gives you back a fully typed object, or fails loudly with a readable report of exactly what's wrong.

It also enforces the server/client boundary that Next.js cares about: variables meant for the browser must be explicitly marked as such (and prefixed, by convention `NEXT_PUBLIC_`), so you can't accidentally leak a server secret into client code through a careless schema.

## Installation

```bash
pnpm add @nx-safe-suite/env zod
```

`zod` is a peer dependency — this package supports both Zod 3 and Zod 4, and uses whichever version is already installed in your project.

## Quick start

Create an `env.ts` file (commonly at the root of your project, or next to `next.config.js`):

```ts
import { createEnv } from "@nx-safe-suite/env";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    API_SECRET: z.string().min(10),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  // Always pass process.env as-is — see "A note on Next.js bundling" below.
  runtimeEnv: process.env,
});
```

Then use `env` anywhere instead of `process.env`:

```ts
import { env } from "./env";

const res = await fetch(env.NEXT_PUBLIC_API_URL);
//                       ^? string (validated as a URL)
```

If `DATABASE_URL` is missing or `API_SECRET` is too short, the process exits immediately with a report like:

```
❌ Invalid environment variables:

  DATABASE_URL
    → Required
  API_SECRET
    → String must contain at least 10 character(s)

2 variables failed validation. Fix your .env file (or your deployment environment) and restart.
```

## A note on Next.js bundling

Next.js statically replaces `process.env.NEXT_PUBLIC_FOO` at build time by looking for that **exact** member expression in your source — it does not understand `process.env[key]` or a destructured `process.env` object. Pass `process.env` directly as `runtimeEnv`, as shown above; don't pre-destructure it into a plain object before passing it in, or client variables may end up `undefined` in the browser bundle.

## API

### `createEnv(options)`

| Option              | Type                                 | Default            | Description                                                                                   |
| -------------------- | ------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| `server`             | `Record<string, ZodType>`             | `{}`                | Variables only ever read on the server.                                                         |
| `client`              | `Record<string, ZodType>`             | `{}`                | Variables exposed to the browser. Keys must start with `clientPrefix`.                          |
| `shared`              | `Record<string, ZodType>`             | `{}`                | Variables valid in both contexts, no prefix required (e.g. `NODE_ENV`).                         |
| `runtimeEnv`          | `Record<string, string \| undefined>` | —                   | **Required.** The actual values to validate, typically `process.env`.                            |
| `clientPrefix`        | `string`                              | `"NEXT_PUBLIC_"`    | Expected prefix for all `client` keys. Pass `""` to disable the check.                          |
| `onValidationError`   | `"exit" \| "throw"`                   | `"exit"`            | `"exit"` logs a report and calls `process.exit(1)`. `"throw"` throws an `EnvValidationError`.   |
| `skipValidation`      | `boolean`                             | `false`             | Bypasses validation entirely and returns `runtimeEnv` as-is. An escape hatch — see below.        |

Returns a frozen, fully typed object combining `server`, `client`, and `shared` keys, inferred directly from your Zod schemas.

On the client (`typeof window !== "undefined"`), only `client` and `shared` schemas are validated — server schemas and their corresponding values are never read, so a server secret can never leak into a client validation pass.

### `EnvValidationError`

Thrown when `onValidationError: "throw"` is set and validation fails.

```ts
import { createEnv, EnvValidationError } from "@nx-safe-suite/env";

try {
  createEnv({ /* ... */, onValidationError: "throw" });
} catch (error) {
  if (error instanceof EnvValidationError) {
    // error.fieldErrors: { key: string; messages: string[] }[]
    console.log(error.fieldErrors);
  }
}
```

## Recipes

### Fail the build, not just the boot

Import your `env.ts` from `next.config.js` so a misconfigured environment fails the build itself, in CI and locally, before anything gets deployed:

```js
// next.config.js
import "./env.ts";

/** @type {import('next').NextConfig} */
export default {
  // ...
};
```

### Skipping validation in specific stages

Some workflows (a `next lint` step, an early Docker build stage that doesn't have secrets mounted yet) legitimately run without the real environment available. Rather than skipping validation silently and globally, gate it explicitly:

```ts
export const env = createEnv({
  /* ... */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
```

### Testing code that uses `env`

Prefer `onValidationError: "throw"` in non-production contexts so failures surface as catchable errors instead of killing the test runner:

```ts
export const env = createEnv({
  /* ... */
  onValidationError: process.env.NODE_ENV === "test" ? "throw" : "exit",
});
```

## License

MIT
