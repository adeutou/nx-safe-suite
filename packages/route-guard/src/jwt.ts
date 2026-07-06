import type { GuardUser, JwtOptions } from "./types";
import { UnauthorizedError } from "./errors";

/**
 * Extracts the Bearer token from the Authorization header.
 * Returns null if the header is missing or malformed.
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

/**
 * Verifies a JWT and returns the decoded payload as a GuardUser.
 * Uses `jose` under the hood — requires jose to be installed as a
 * peer dependency in the consuming project.
 */
export async function verifyJwt(
  token: string,
  opts: JwtOptions,
): Promise<GuardUser> {
  let jose: { jwtVerify: Function };

  try {
    // Dynamic import so the package doesn't hard-depend on jose at bundle time
    jose = await import("jose" as string) as { jwtVerify: Function };
  } catch {
    throw new Error(
      "@nx-safe-suite/route-guard requires `jose` to be installed when using JWT auth. " +
        "Run: pnpm add jose",
    );
  }

  const algorithm = opts.algorithm ?? "HS256";
  const isSymmetric = algorithm.startsWith("HS");

  const key = isSymmetric
    ? new TextEncoder().encode(
        typeof opts.secret === "string" ? opts.secret : new TextDecoder().decode(opts.secret),
      )
    : opts.secret;

  try {
    const { payload } = await jose.jwtVerify(token, key as Uint8Array, {
      algorithms: [algorithm],
      ...(opts.audience ? { audience: opts.audience } : {}),
      ...(opts.issuer ? { issuer: opts.issuer } : {}),
    });

    const sub = payload.sub;
    if (!sub) {
      throw new UnauthorizedError("JWT payload is missing the 'sub' claim.");
    }

    const roles = Array.isArray(payload["roles"])
      ? (payload["roles"] as string[])
      : [];

    return { ...payload, id: sub, roles } as GuardUser;
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError("Invalid or expired JWT.");
  }
}
