import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────
// Server-side Cache Service — In-memory LRU with TTL
//
// Design:
//   • LRU eviction when maxEntries is exceeded
//   • Per-entry TTL with automatic expiry on read
//   • Namespaced keys (e.g. "repos:page=1:perPage=30")
//   • Stale-while-revalidate support via `getStale()`
//   • Hit/miss stats for monitoring
//   • Singleton per namespace — no cross-request leaks
//
// Swap path: Replace this module with a Redis adapter
// exporting the same `CacheService` interface when scaling
// to multiple instances.
// ─────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  size: number;
}

interface CacheOptions {
  /** Default TTL in milliseconds. */
  defaultTtl: number;
  /** Maximum number of entries before LRU eviction kicks in. */
  maxEntries: number;
  /** Namespace prefix for log messages. */
  namespace: string;
}

const DEFAULT_OPTIONS: CacheOptions = {
  defaultTtl: 5 * 60 * 1000, // 5 minutes
  maxEntries: 500,
  namespace: 'cache',
};

export class CacheService {
  private store = new Map<string, CacheEntry<unknown>>();
  private readonly options: CacheOptions;
  private stats: CacheStats = { hits: 0, misses: 0, sets: 0, evictions: 0, size: 0 };

  constructor(options?: Partial<CacheOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Get a cached value. Returns `undefined` on miss or expiry.
   * Moves the entry to the "most recently used" position on hit.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Expired — remove and treat as miss
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.stats.size = this.store.size;
      this.stats.misses++;
      return undefined;
    }

    // LRU: delete + re-insert to move to end (most recently used)
    this.store.delete(key);
    this.store.set(key, entry);

    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * Get a cached value even if expired (for stale-while-revalidate patterns).
   * Returns `undefined` only if the key was never set.
   */
  getStale<T>(key: string): { value: T; isStale: boolean } | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    return {
      value: entry.value as T,
      isStale: Date.now() > entry.expiresAt,
    };
  }

  /**
   * Set a value with optional TTL override.
   * Evicts the least recently used entry if max capacity is reached.
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.options.defaultTtl;

    // Evict LRU entries if at capacity (and this is a new key)
    if (!this.store.has(key) && this.store.size >= this.options.maxEntries) {
      this.evictLru();
    }

    // Delete first to ensure it goes to the end (most recently used)
    this.store.delete(key);
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
    });

    this.stats.sets++;
    this.stats.size = this.store.size;
  }

  /**
   * Get-or-set pattern: returns cached value if fresh,
   * otherwise calls the factory function, caches, and returns.
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs?: number,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      logger.info(`Cache HIT: ${this.options.namespace}:${key}`, 'cache');
      return cached;
    }

    logger.info(`Cache MISS: ${this.options.namespace}:${key}`, 'cache');
    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  /** Delete a specific entry. */
  delete(key: string): boolean {
    const deleted = this.store.delete(key);
    this.stats.size = this.store.size;
    return deleted;
  }

  /** Delete all entries matching a prefix (e.g. invalidate all repo pages). */
  invalidateByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    this.stats.size = this.store.size;
    if (count > 0) {
      logger.info(`Invalidated ${count} entries with prefix "${prefix}"`, 'cache');
    }
    return count;
  }

  /** Clear the entire cache. */
  clear(): void {
    this.store.clear();
    this.stats.size = 0;
  }

  /** Get cache statistics for monitoring. */
  getStats(): CacheStats & { hitRate: string } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? `${((this.stats.hits / total) * 100).toFixed(1)}%` : 'N/A';
    return { ...this.stats, hitRate };
  }

  // ── Internal ─────────────────────────────────────────────

  /** Evict the least recently used entry (first item in Map iteration order). */
  private evictLru(): void {
    const firstKey = this.store.keys().next().value;
    if (firstKey !== undefined) {
      this.store.delete(firstKey);
      this.stats.evictions++;
    }
  }
}

// ─── Cache Key Helpers ───────────────────────────────────────

/**
 * Build a deterministic cache key from a base name and params.
 * Sorts param keys for consistency.
 *
 * Example: cacheKey('repos', { page: 1, perPage: 30 }) → "repos:page=1:perPage=30"
 */
export function cacheKey(base: string, params?: Record<string, string | number | boolean>): string {
  if (!params || Object.keys(params).length === 0) return base;

  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(':');

  return sorted ? `${base}:${sorted}` : base;
}

// ─── Singleton Instances ─────────────────────────────────────

/** GitHub API cache — 5 min TTL for browse, overridden per-call for search. */
export const githubCache = new CacheService({
  namespace: 'github',
  defaultTtl: 5 * 60 * 1000, // 5 minutes
  maxEntries: 200,
});

/** Reviewers cache — shorter TTL since review status changes frequently. */
export const reviewersCache = new CacheService({
  namespace: 'reviewers',
  defaultTtl: 2 * 60 * 1000, // 2 minutes
  maxEntries: 100,
});
