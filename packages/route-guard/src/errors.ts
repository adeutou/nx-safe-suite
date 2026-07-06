/**
 * Base class for all guard errors.
 * Catch these in your global error handler to produce consistent responses.
 */
export class GuardError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = "GuardError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class UnauthorizedError extends GuardError {
  constructor(message = "Authentication required.") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends GuardError {
  constructor(message = "Insufficient permissions.") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class RateLimitError extends GuardError {
  public readonly resetAt: number;
  public readonly remaining: number;

  constructor(resetAt: number, remaining: number) {
    super("Too many requests.", 429, "RATE_LIMITED");
    this.name = "RateLimitError";
    this.resetAt = resetAt;
    this.remaining = remaining;
  }
}

export class ValidationError extends GuardError {
  public readonly issues: { pointer: string; message: string }[];

  constructor(issues: { pointer: string; message: string }[]) {
    super("Request validation failed.", 422, "VALIDATION_ERROR");
    this.name = "ValidationError";
    this.issues = issues;
  }
}
