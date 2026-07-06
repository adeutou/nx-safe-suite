import type { GuardUser } from "./types";
import { ForbiddenError } from "./errors";

/**
 * Checks whether the given user satisfies the roles requirement.
 * - Array: the user must have at least one of the listed roles.
 * - Function: called with the user; must return true to grant access.
 *
 * Throws a ForbiddenError if access is denied.
 */
export async function checkRoles(
  user: GuardUser,
  roles: string[] | ((user: GuardUser) => boolean | Promise<boolean>),
): Promise<void> {
  if (typeof roles === "function") {
    const granted = await roles(user);
    if (!granted) {
      throw new ForbiddenError(
        `User "${user.id}" does not meet the required permission criteria.`,
      );
    }
    return;
  }

  const hasRole = roles.some((role) => user.roles.includes(role));
  if (!hasRole) {
    throw new ForbiddenError(
      `User "${user.id}" requires one of the following roles: ${roles.join(", ")}.`,
    );
  }
}
