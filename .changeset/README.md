# Changesets

This folder is used to manage releases via [Changesets](https://github.com/changesets/changesets).

Read the [versioning documentation](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md) to understand how to add changesets.

Quick reminder: every PR that changes the public behavior of a package under `packages/*` should include a changeset, generated via:

```bash
pnpm changeset
```
