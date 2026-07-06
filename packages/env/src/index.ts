/**
 * @nx-safe-suite/env
 * Strict, type-safe environment variable validation for Next.js, powered by Zod.
 *
 * @packageDocumentation
 */

export { createEnv } from "./create-env";
export { EnvValidationError } from "./errors";
export type { EnvFieldError } from "./errors";
export type {
  CreateEnvOptions,
  CreatedEnv,
  EnvSchemaRecord,
  InferEnvSchema,
  OnValidationError,
} from "./types";

export const VERSION = "0.1.0";
