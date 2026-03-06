import { describe, expect, it, vi } from 'vitest';

// Mock the logger to avoid file I/O during tests
vi.mock('@/lib/db/logger', () => ({
  dbLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    separator: vi.fn(),
  },
}));

import { connectWithRetry, healthCheck } from '@/lib/db/connection';

describe('connectWithRetry', () => {
  it('connects successfully on first attempt', async () => {
    const connectFn = vi.fn().mockResolvedValue(undefined);
    const client = { $connect: connectFn } as never;

    await connectWithRetry(client, 'postgresql://user:pass@host:5432/db');
    expect(connectFn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient failure then succeeds', async () => {
    const connectFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(undefined);
    const client = { $connect: connectFn } as never;

    await connectWithRetry(client, 'postgresql://user:pass@host:5432/db', {
      maxRetries: 3,
      baseDelayMs: 1,
      maxDelayMs: 5,
    });

    expect(connectFn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all retries', async () => {
    const connectFn = vi.fn().mockRejectedValue(new Error('connection refused'));
    const client = { $connect: connectFn } as never;

    await expect(
      connectWithRetry(client, 'postgresql://user:pass@host:5432/db', {
        maxRetries: 2,
        baseDelayMs: 1,
        maxDelayMs: 5,
      }),
    ).rejects.toThrow('Unable to connect after 3 attempts');

    expect(connectFn).toHaveBeenCalledTimes(3);
  });

  it('handles non-Error thrown objects', async () => {
    const client = {
      $connect: vi.fn().mockRejectedValue('string error'),
    } as never;

    await expect(
      connectWithRetry(client, 'postgresql://user:pass@host:5432/db', {
        maxRetries: 0,
        baseDelayMs: 1,
        maxDelayMs: 5,
      }),
    ).rejects.toThrow('string error');
  });
});

describe('healthCheck', () => {
  it('returns true when query succeeds', async () => {
    const client = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as never;

    const result = await healthCheck(client);
    expect(result).toBe(true);
  });

  it('returns false when query fails', async () => {
    const client = {
      $queryRaw: vi.fn().mockRejectedValue(new Error('connection lost')),
    } as never;

    const result = await healthCheck(client);
    expect(result).toBe(false);
  });

  it('handles non-Error thrown objects in health check', async () => {
    const client = {
      $queryRaw: vi.fn().mockRejectedValue('weird error'),
    } as never;

    const result = await healthCheck(client);
    expect(result).toBe(false);
  });
});
