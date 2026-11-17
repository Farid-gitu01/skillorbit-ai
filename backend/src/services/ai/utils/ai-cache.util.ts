interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Bounded in-memory TTL cache with in-flight promise deduplication for
 * expensive AI feature operations.
 */
export class AiResponseCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly maxEntries: number;

  constructor(maxEntries = 300) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    if (ttlMs <= 0) {
      return;
    }
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
    this.inFlight.clear();
  }

  async getOrCompute<T>(
    key: string,
    ttlMs: number,
    compute: () => Promise<T>,
    options: { skipCache?: boolean } = {}
  ): Promise<{ value: T; cacheHit: boolean }> {
    if (!options.skipCache) {
      const cached = this.get<T>(key);
      if (cached !== undefined) {
        return { value: cached, cacheHit: true };
      }
    }

    const existingFlight = this.inFlight.get(key);
    if (existingFlight) {
      const value = (await existingFlight) as T;
      return { value, cacheHit: true };
    }

    const promise = compute()
      .then((result) => {
        this.set(key, result, ttlMs);
        return result;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    const value = await promise;
    return { value, cacheHit: false };
  }
}

export const sharedAiCache = new AiResponseCache(400);
