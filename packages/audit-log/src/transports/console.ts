import type { AuditEntry, AuditTransport } from "../types";

export interface ConsoleTransportOptions {
  /**
   * `"stdout"` writes to `console.log`, `"stderr"` writes to `console.error`.
   * Defaults to `"stdout"`.
   */
  stream?: "stdout" | "stderr";
  /**
   * When true, entries are pretty-printed with 2-space indentation.
   * Useful for local development.
   * Defaults to `false`.
   */
  pretty?: boolean;
}

/**
 * Writes audit entries as newline-delimited JSON to stdout or stderr.
 * Ideal for development and for log-aggregation pipelines that parse
 * structured stdout (e.g. Cloud Run, Fly.io, Render).
 *
 * @example
 * new ConsoleTransport({ pretty: true })
 */
export class ConsoleTransport implements AuditTransport {
  private readonly stream: "stdout" | "stderr";
  private readonly pretty: boolean;

  constructor(opts: ConsoleTransportOptions = {}) {
    this.stream = opts.stream ?? "stdout";
    this.pretty = opts.pretty ?? false;
  }

  async send(entry: AuditEntry): Promise<void> {
    const line = this.pretty
      ? JSON.stringify(entry, null, 2)
      : JSON.stringify(entry);

    if (this.stream === "stderr") {
      console.error(line);
    } else {
      console.log(line);
    }
  }
}
