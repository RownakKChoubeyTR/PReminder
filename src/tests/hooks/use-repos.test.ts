import { useRepos } from '@/hooks/use-repos';
import { createQueryWrapper } from '@/tests/test-utils';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Tests: useRepos hook
// ─────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
  mockFetch.mockReset();
});

describe('useRepos', () => {
  it('fetches repos and returns data on success', async () => {
    const mockData = {
      data: [{ id: 1, name: 'repo-1', full_name: 'org/repo-1' }],
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
    const { result } = renderHook(() => useRepos(1, 30, ''), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });

  it('throws error on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ error: 'Server error' }),
    });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useRepos(1, 30, ''), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('Server error');
  });

  it('passes search param to API when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi
        .fn()
        .mockResolvedValue({ data: [], total: 0, page: 1, perPage: 30, hasNextPage: false }),
    });

    const { Wrapper } = createQueryWrapper();
    renderHook(() => useRepos(1, 30, 'react'), { wrapper: Wrapper });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain('search=react');
  });
});
