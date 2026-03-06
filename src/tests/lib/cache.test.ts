import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheService, cacheKey } from '@/lib/cache';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService({
      namespace: 'test',
      defaultTtl: 5000,
      maxEntries: 5,
    });
  });

  // ── get / set ───────────────────────────────────────

  it('returns undefined for missing keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('stores and retrieves a value', () => {
    cache.set('key1', { name: 'test' });
    expect(cache.get('key1')).toEqual({ name: 'test' });
  });

  it('stores different value types', () => {
    cache.set('string', 'hello');
    cache.set('number', 42);
    cache.set('array', [1, 2, 3]);
    cache.set('boolean', true);

    expect(cache.get<string>('string')).toBe('hello');
    expect(cache.get<number>('number')).toBe(42);
    expect(cache.get<number[]>('array')).toEqual([1, 2, 3]);
    expect(cache.get<boolean>('boolean')).toBe(true);
  });

  it('overwrites existing value with set', () => {
    cache.set('key', 'first');
    cache.set('key', 'second');
    expect(cache.get('key')).toBe('second');
  });

  // ── TTL expiry ──────────────────────────────────────

  it('returns undefined for expired entries', () => {
    vi.useFakeTimers();
    try {
      cache.set('key', 'value', 1000);
      expect(cache.get('key')).toBe('value');

      vi.advanceTimersByTime(1001);
      expect(cache.get('key')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses default TTL when none specified', () => {
    vi.useFakeTimers();
    try {
      cache.set('key', 'value');
      vi.advanceTimersByTime(4999);
      expect(cache.get('key')).toBe('value');

      vi.advanceTimersByTime(2);
      expect(cache.get('key')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows custom TTL override per entry', () => {
    vi.useFakeTimers();
    try {
      cache.set('short', 'value', 500);
      cache.set('long', 'value', 10_000);

      vi.advanceTimersByTime(600);
      expect(cache.get('short')).toBeUndefined();
      expect(cache.get('long')).toBe('value');
    } finally {
      vi.useRealTimers();
    }
  });

  // ── LRU eviction ───────────────────────────────────

  it('evicts LRU entry when maxEntries exceeded', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4);
    cache.set('e', 5);

    // Cache is full (5 entries). Adding 6th evicts 'a' (least recently used).
    cache.set('f', 6);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('f')).toBe(6);
  });

  it('refreshes LRU position on get', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4);
    cache.set('e', 5);

    // Access 'a' to move it to most-recently-used
    cache.get('a');

    // Now 'b' is the LRU — it should be evicted
    cache.set('f', 6);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('f')).toBe(6);
  });

  it('does not evict when overwriting existing key', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4);
    cache.set('e', 5);

    // Overwrite 'c' — should not evict anything
    cache.set('c', 30);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(30);
    expect(cache.getStats().evictions).toBe(0);
  });

  // ── getStale ────────────────────────────────────────

  it('returns fresh data with isStale=false', () => {
    cache.set('key', 'value', 5000);
    const result = cache.getStale<string>('key');
    expect(result).toEqual({ value: 'value', isStale: false });
  });

  it('returns expired data with isStale=true', () => {
    vi.useFakeTimers();
    try {
      cache.set('key', 'value', 1000);
      vi.advanceTimersByTime(1001);

      const result = cache.getStale<string>('key');
      expect(result?.value).toBe('value');
      expect(result?.isStale).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns undefined from getStale for never-set key', () => {
    expect(cache.getStale('nope')).toBeUndefined();
  });

  // ── getOrSet ────────────────────────────────────────

  it('calls factory on miss and caches result', async () => {
    const factory = vi.fn().mockResolvedValue({ data: 'fresh' });
    const result = await cache.getOrSet('key', factory);

    expect(result).toEqual({ data: 'fresh' });
    expect(factory).toHaveBeenCalledOnce();

    // Second call should use cache
    const result2 = await cache.getOrSet('key', factory);
    expect(result2).toEqual({ data: 'fresh' });
    expect(factory).toHaveBeenCalledOnce();
  });

  it('uses cached value on hit (skips factory)', async () => {
    cache.set('key', 'cached');
    const factory = vi.fn().mockResolvedValue('fresh');

    const result = await cache.getOrSet('key', factory);
    expect(result).toBe('cached');
    expect(factory).not.toHaveBeenCalled();
  });

  it('re-fetches after TTL expires', async () => {
    vi.useFakeTimers();
    try {
      const factory = vi.fn()
        .mockResolvedValueOnce('first')
        .mockResolvedValueOnce('second');

      await cache.getOrSet('key', factory, 1000);
      expect(factory).toHaveBeenCalledOnce();

      vi.advanceTimersByTime(1001);
      const result = await cache.getOrSet('key', factory, 1000);
      expect(result).toBe('second');
      expect(factory).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  // ── delete ──────────────────────────────────────────

  it('deletes an entry', () => {
    cache.set('key', 'value');
    expect(cache.delete('key')).toBe(true);
    expect(cache.get('key')).toBeUndefined();
  });

  it('returns false when deleting nonexistent key', () => {
    expect(cache.delete('nope')).toBe(false);
  });

  // ── invalidateByPrefix ──────────────────────────────

  it('removes all entries matching a prefix', () => {
    cache.set('repos:page=1', 'a');
    cache.set('repos:page=2', 'b');
    cache.set('pulls:page=1', 'c');

    const count = cache.invalidateByPrefix('repos:');
    expect(count).toBe(2);
    expect(cache.get('repos:page=1')).toBeUndefined();
    expect(cache.get('repos:page=2')).toBeUndefined();
    expect(cache.get('pulls:page=1')).toBe('c');
  });

  it('returns 0 when no entries match prefix', () => {
    cache.set('repos:page=1', 'a');
    expect(cache.invalidateByPrefix('users:')).toBe(0);
  });

  // ── clear ───────────────────────────────────────────

  it('clears all entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
    expect(cache.getStats().size).toBe(0);
  });

  // ── stats ───────────────────────────────────────────

  it('tracks hits, misses, sets, evictions accurately', () => {
    cache.set('a', 1); // sets: 1
    cache.set('b', 2); // sets: 2
    cache.get('a'); // hits: 1
    cache.get('miss'); // misses: 1
    cache.get('a'); // hits: 2

    const stats = cache.getStats();
    expect(stats.sets).toBe(2);
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(2);
    expect(stats.hitRate).toBe('66.7%');
  });

  it('reports N/A hit rate when no lookups', () => {
    expect(cache.getStats().hitRate).toBe('N/A');
  });

  it('counts evictions', () => {
    for (let i = 0; i < 7; i++) {
      cache.set(`key-${i}`, i);
    }
    // maxEntries=5, added 7 → 2 evictions
    expect(cache.getStats().evictions).toBe(2);
  });
});

describe('cacheKey', () => {
  it('returns base when no params', () => {
    expect(cacheKey('repos')).toBe('repos');
    expect(cacheKey('repos', {})).toBe('repos');
  });

  it('builds deterministic key with sorted params', () => {
    expect(cacheKey('repos', { perPage: 30, page: 1 })).toBe('repos:page=1:perPage=30');
    expect(cacheKey('repos', { page: 1, perPage: 30 })).toBe('repos:page=1:perPage=30');
  });

  it('filters out empty/null/undefined values', () => {
    expect(cacheKey('repos', { page: 1, search: '' })).toBe('repos:page=1');
  });

  it('handles boolean params', () => {
    expect(cacheKey('data', { active: true, page: 1 })).toBe('data:active=true:page=1');
  });

  it('handles complex key patterns', () => {
    expect(cacheKey('repos:search', { page: 1, perPage: 30, q: 'cobalt' })).toBe(
      'repos:search:page=1:perPage=30:q=cobalt',
    );
  });
});
