/**
 * Promise deduplicator — prevents the "dog-pile" or "thundering herd" problem.
 *
 * When multiple concurrent requests trigger a cache miss for the same key at
 * the same time, only ONE call to the underlying source function is made. All
 * other callers receive the same Promise and resolve together when the single
 * fetch completes.
 *
 * ```
 *          Cache miss
 *   req-1 ──────────────► fetchSource() ──► result ──► all three resolve
 *   req-2 ──► dedupe ──┘
 *   req-3 ──────────┘
 * ```
 */
export class StampedeGuard {
  private readonly inflight = new Map<string, Promise<unknown>>();

  /**
   * Execute `fn` for `key`, or return the already-in-flight Promise if one
   * exists for the same key.
   */
  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const promise = fn().finally(() => {
      this.inflight.delete(key);
    });

    this.inflight.set(key, promise as Promise<unknown>);
    return promise;
  }

  /** Number of in-flight requests — useful for testing. */
  get size(): number {
    return this.inflight.size;
  }
}
