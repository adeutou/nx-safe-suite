import type { AuditEntry, AuditTransport } from "../types";

export interface HttpTransportOptions {
  /** Webhook URL to POST audit entries to. */
  url: string;
  /**
   * Additional headers sent with every request.
   * Use this to pass authentication tokens:
   * `headers: { Authorization: "Bearer <token>" }`
   */
  headers?: Record<string, string>;
  /**
   * Maximum number of attempts (initial + retries).
   * Defaults to `3`.
   */
  maxAttempts?: number;
  /**
   * Delay in ms between retry attempts.
   * Defaults to `500`.
   */
  retryDelayMs?: number;
  /**
   * Request timeout in ms.
   * Defaults to `5000`.
   */
  timeoutMs?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POSTs audit entries as JSON to an HTTP endpoint.
 * Retries on network errors or 5xx responses.
 *
 * @example
 * new HttpTransport({
 *   url: "https://ingest.example.com/audit",
 *   headers: { Authorization: `Bearer ${env.AUDIT_WEBHOOK_SECRET}` },
 * })
 */
export class HttpTransport implements AuditTransport {
  private readonly url: string;
  private readonly headers: Record<string, string>;
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;
  private readonly timeoutMs: number;

  constructor(opts: HttpTransportOptions) {
    this.url = opts.url;
    this.headers = opts.headers ?? {};
    this.maxAttempts = opts.maxAttempts ?? 3;
    this.retryDelayMs = opts.retryDelayMs ?? 500;
    this.timeoutMs = opts.timeoutMs ?? 5000;
  }

  async send(entry: AuditEntry): Promise<void> {
    const body = JSON.stringify(entry);
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        const res = await fetch(this.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...this.headers,
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (res.ok) return;

        // Retry on 5xx
        if (res.status >= 500 && attempt < this.maxAttempts) {
          lastError = new Error(`HTTP ${res.status} from audit webhook`);
          await delay(this.retryDelayMs * attempt);
          continue;
        }

        // 4xx — don't retry
        throw new Error(
          `Audit webhook rejected entry with HTTP ${res.status}: ${await res.text().catch(() => "")}`,
        );
      } catch (error) {
        if ((error as Error)?.name === "AbortError") {
          lastError = new Error(`Audit webhook timed out after ${this.timeoutMs}ms`);
        } else {
          lastError = error;
        }

        if (attempt < this.maxAttempts) {
          await delay(this.retryDelayMs * attempt);
        }
      }
    }

    throw lastError;
  }
}
