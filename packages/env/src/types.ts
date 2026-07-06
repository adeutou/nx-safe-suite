import type { z } from "zod";

/**
 * Any record of Zod schemas keyed by env var name.
 */
export type EnvSchemaRecord = Record<string, z.ZodTypeAny>;

/**
 * Infers the resulting plain object type from a record of Zod schemas.
 */
export type InferEnvSchema<T extends EnvSchemaRecord> = {
  [K in keyof T]: z.infer<T[K]>;
};

/**
 * Strategy applied when validation fails.
 *
 * - "exit": logs a readable error report and calls `process.exit(1)`.
 *   This is the default — it fails the build/boot process immediately,
 *   which is almost always what you want in a Next.js app or in CI.
 * - "throw": throws an `EnvValidationError` instead of exiting. Useful in
 *   tests, scripts, or any context where you want to handle the failure
 *   yourself instead of killing the process.
 */
export type OnValidationError = "exit" | "throw";

export interface CreateEnvOptions<
  TServer extends EnvSchemaRecord,
  TClient extends EnvSchemaRecord,
  TShared extends EnvSchemaRecord,
> {
  /**
   * Schemas for variables that must only ever be read on the server.
   * Accessing these from client-side code is a configuration mistake this
   * package helps you avoid — see `runtimeEnv`.
   */
  server?: TServer;

  /**
   * Schemas for variables that are exposed to the browser. In Next.js this
   * means they must be prefixed (by default `NEXT_PUBLIC_`); see
   * `clientPrefix` to override.
   */
  client?: TClient;

  /**
   * Schemas for variables that are valid in both contexts and don't need a
   * prefix (e.g. `NODE_ENV`).
   */
  shared?: TShared;

  /**
   * The actual runtime values to validate against the schemas above.
   * In Next.js, pass `process.env` here. Next.js statically replaces
   * `process.env.NEXT_PUBLIC_*` at build time, so destructure explicitly
   * if you rely on that behavior — see the README.
   */
  runtimeEnv: Record<string, string | undefined>;

  /**
   * Prefix that all `client` keys are expected to start with.
   * Defaults to `"NEXT_PUBLIC_"`, matching Next.js convention.
   * Set to an empty string to disable the check.
   */
  clientPrefix?: string;

  /**
   * What to do when validation fails. Defaults to `"exit"`.
   */
  onValidationError?: OnValidationError;

  /**
   * Skip validation entirely and return `runtimeEnv` cast to the expected
   * shape, unvalidated. Useful for contexts like `next lint`, Docker build
   * stages, or any step where the real environment variables intentionally
   * aren't available yet.
   *
   * Defaults to `false`. Prefer leaving this off unless you have a
   * concrete reason to skip validation — it exists as an escape hatch,
   * not a default workflow.
   */
  skipValidation?: boolean;
}

export type CreatedEnv<
  TServer extends EnvSchemaRecord,
  TClient extends EnvSchemaRecord,
  TShared extends EnvSchemaRecord,
> = Readonly<InferEnvSchema<TServer> & InferEnvSchema<TClient> & InferEnvSchema<TShared>>;
