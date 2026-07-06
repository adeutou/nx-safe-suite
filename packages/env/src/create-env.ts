import { z, ZodError } from "zod";
import { EnvValidationError, type EnvFieldError } from "./errors";
import { printEnvErrorReport } from "./format";
import type {
  CreateEnvOptions,
  CreatedEnv,
  EnvSchemaRecord,
} from "./types";

const DEFAULT_CLIENT_PREFIX = "NEXT_PUBLIC_";

/**
 * Validates `process.env` (or any runtime env object) against Zod schemas,
 * returning a fully typed, immutable object.
 *
 * Server-only and client-exposed variables are validated separately so
 * that:
 *  - errors are reported per-variable with clear messages,
 *  - client variable names are checked against the expected prefix,
 *  - on the client (`typeof window !== "undefined"`), only the `client`
 *    and `shared` schemas are validated — server secrets are never read,
 *    matching Next.js's bundling boundary instead of fighting it.
 *
 * @example
 * ```ts
 * export const env = createEnv({
 *   server: {
 *     DATABASE_URL: z.string().url(),
 *   },
 *   client: {
 *     NEXT_PUBLIC_API_URL: z.string().url(),
 *   },
 *   runtimeEnv: process.env,
 * });
 * ```
 */
export function createEnv<
  TServer extends EnvSchemaRecord = {},
  TClient extends EnvSchemaRecord = {},
  TShared extends EnvSchemaRecord = {},
>(options: CreateEnvOptions<TServer, TClient, TShared>): CreatedEnv<TServer, TClient, TShared> {
  const {
    server = {} as TServer,
    client = {} as TClient,
    shared = {} as TShared,
    runtimeEnv,
    clientPrefix = DEFAULT_CLIENT_PREFIX,
    onValidationError = "exit",
    skipValidation = false,
  } = options;

  if (skipValidation) {
    return Object.freeze({ ...runtimeEnv }) as CreatedEnv<TServer, TClient, TShared>;
  }

  validateClientPrefixes(client, clientPrefix);

  const isServerContext = typeof globalThis.window === "undefined";

  const schemasToValidate: EnvSchemaRecord = isServerContext
    ? { ...server, ...client, ...shared }
    : { ...client, ...shared };

  const schema = z.object(schemasToValidate);
  const result = schema.safeParse(runtimeEnv);

  if (!result.success) {
    const fieldErrors = toFieldErrors(result.error);
    return handleValidationFailure(fieldErrors, onValidationError);
  }

  return Object.freeze(result.data) as CreatedEnv<TServer, TClient, TShared>;
}

/**
 * Ensures every `client` key starts with the expected prefix. This catches
 * a very common mistake early: defining a schema entry under `client`
 * whose key isn't actually exposed to the browser by Next.js, which leads
 * to confusing "works on server, undefined on client" bugs.
 */
function validateClientPrefixes(client: EnvSchemaRecord, clientPrefix: string): void {
  if (!clientPrefix) return;

  const offendingKeys = Object.keys(client).filter((key) => !key.startsWith(clientPrefix));

  if (offendingKeys.length > 0) {
    throw new Error(
      `Invalid \`client\` schema keys: ${offendingKeys.join(", ")}. ` +
        `All client variables must start with "${clientPrefix}", or Next.js will not expose them to the browser. ` +
        `If this is intentional, pass clientPrefix: "" to createEnv to disable this check.`,
    );
  }
}

function toFieldErrors(error: ZodError): EnvFieldError[] {
  const flattened = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  return Object.entries(flattened).map(([key, messages]) => ({
    key,
    messages: messages ?? ["Invalid value"],
  }));
}

function handleValidationFailure(
  fieldErrors: EnvFieldError[],
  strategy: "exit" | "throw",
): never {
  if (strategy === "throw") {
    throw new EnvValidationError(fieldErrors);
  }

  printEnvErrorReport(fieldErrors);
  // eslint-disable-next-line n/no-process-exit
  process.exit(1);
}
