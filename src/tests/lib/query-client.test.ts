import { describe, expect, it } from 'vitest';
import { getQueryClient } from '@/lib/query-client';

// ─────────────────────────────────────────────────────────────
// Query Client Tests
// ─────────────────────────────────────────────────────────────

describe('getQueryClient', () => {
  it('should return a QueryClient instance', () => {
    const client = getQueryClient();
    expect(client).toBeDefined();
    expect(typeof client.invalidateQueries).toBe('function');
    expect(typeof client.getQueryData).toBe('function');
    expect(typeof client.setQueryData).toBe('function');
  });

  it('should return the same client on subsequent calls (browser singleton)', () => {
    const client1 = getQueryClient();
    const client2 = getQueryClient();
    expect(client1).toBe(client2);
  });

  it('should have correct default options', () => {
    const client = getQueryClient();
    const defaults = client.getDefaultOptions();

    expect(defaults.queries?.staleTime).toBe(2 * 60 * 1000);
    expect(defaults.queries?.gcTime).toBe(5 * 60 * 1000);
    expect(defaults.queries?.retry).toBe(2);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  });
});
