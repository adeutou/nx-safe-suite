# How to apply this patch

This archive contains only the files added or modified since your last push
(commit 0f2eaf1), implementing the real `@nx-safe-suite/env` package.

## 1. Extract at the root of your local repo

```bash
cd nx-safe-suite
tar xzf nx-safe-suite-env-update.tar.gz
```

This will overwrite/add the listed files in place. It will NOT delete
anything on its own.

## 2. Delete one obsolete file

The old placeholder test was replaced by `tests/create-env.test.ts`.
Remove it manually:

```bash
rm packages/env/tests/index.test.ts
```

## 3. Reinstall and verify

```bash
pnpm install
pnpm --filter @nx-safe-suite/env build
pnpm --filter @nx-safe-suite/env test
pnpm --filter @nx-safe-suite/env typecheck
```

You should see 11 passing tests and a clean build (CJS + ESM + .d.ts).

## 4. Commit and push

```bash
git add -A
git commit -m "feat(env): implement createEnv with server/client/shared validation"
git push
```

## Files included

- `.changeset/fuzzy-otters-sail.md` — changeset describing this release
- `packages/env/README.md` — full API docs and recipes
- `packages/env/package.json` — added zod as a peerDependency, @types/node
- `packages/env/src/create-env.ts` — core implementation
- `packages/env/src/errors.ts` — EnvValidationError
- `packages/env/src/format.ts` — readable console error report
- `packages/env/src/globals.d.ts` — minimal `window` ambient declaration
- `packages/env/src/index.ts` — public exports
- `packages/env/tests/create-env.test.ts` — 11 unit tests
- `pnpm-lock.yaml` — updated lockfile (zod, @types/node added)
