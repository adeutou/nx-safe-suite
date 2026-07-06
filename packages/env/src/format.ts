import type { EnvFieldError } from "./errors";

/**
 * Prints a clear, readable error report to stderr listing every invalid
 * or missing environment variable. Designed to be the first thing a
 * developer sees in their terminal or CI logs when a build fails because
 * of misconfigured env vars.
 */
export function printEnvErrorReport(fieldErrors: EnvFieldError[]): void {
  const lines: string[] = [];
  lines.push("");
  lines.push("❌ Invalid environment variables:");
  lines.push("");

  for (const { key, messages } of fieldErrors) {
    lines.push(`  ${key}`);
    for (const message of messages) {
      lines.push(`    → ${message}`);
    }
  }

  lines.push("");
  lines.push(
    `${fieldErrors.length} variable${fieldErrors.length === 1 ? "" : "s"} failed validation. ` +
      "Fix your .env file (or your deployment environment) and restart.",
  );
  lines.push("");

  // eslint-disable-next-line no-console
  console.error(lines.join("\n"));
}
