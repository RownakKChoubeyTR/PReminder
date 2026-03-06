import { usePulls } from '@/hooks/use-pulls';
import { createQueryWrapper } from '@/tests/test-utils';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Tests: usePulls hook
// ─────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
  mockFetch.mockReset();
});

describe('usePulls', () => {
  it('does not fetch when repo is null', () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePulls(null), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches PRs for a given repo', async () => {
    const mockData = {
      data: [{ number: 1, title: 'Fix bug' }],
      total: 1,
      page: 1,
      perPage: 30,
      hasNextPage: false,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePulls('org/repo', 1, 30, ''), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });

  it('includes search param for 3+ char search', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi
        .fn()
        .mockResolvedValue({ data: [], total: 0, page: 1, perPage: 30, hasNextPage: false }),
    });

    const { Wrapper } = createQueryWrapper();
    renderHook(() => usePulls('org/repo', 1, 30, 'bug'), { wrapper: Wrapper });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain('search=bug');
  });

  it('does not include search param for < 3 char search', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi
        .fn()
        .mockResolvedValue({ data: [], total: 0, page: 1, perPage: 30, hasNextPage: false }),
    });

    const { Wrapper } = createQueryWrapper();
    renderHook(() => usePulls('org/repo', 1, 30, 'ab'), { wrapper: Wrapper });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).not.toContain('search=');
  });

  it('throws error on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: vi.fn().mockResolvedValue({ error: 'Forbidden' }),
    });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePulls('org/repo'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('Forbidden');
  });
});
