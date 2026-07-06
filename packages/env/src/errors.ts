/**
 * Structured representation of a single failed environment variable.
 */
export interface EnvFieldError {
  /** The environment variable name, e.g. "DATABASE_URL". */
  key: string;
  /** Human-readable issue messages for this key. */
  messages: string[];
}

/**
 * Thrown when `onValidationError: "throw"` is set and one or more
 * environment variables fail validation. Carries a structured list of
 * field errors in addition to the formatted human-readable message.
 */
export class EnvValidationError extends Error {
  public readonly fieldErrors: EnvFieldError[];

  constructor(fieldErrors: EnvFieldError[]) {
    super(EnvValidationError.formatMessage(fieldErrors));
    this.name = "EnvValidationError";
    this.fieldErrors = fieldErrors;
  }

  private static formatMessage(fieldErrors: EnvFieldError[]): string {
    const lines = fieldErrors.map((f) => `  - ${f.key}: ${f.messages.join("; ")}`);
    return `Invalid environment variables:\n${lines.join("\n")}`;
  }
}
