import {
  useCreateEmailMapping,
  useDeleteEmailMapping,
  useEmailMappings,
} from '@/hooks/use-email-mappings';
import { createQueryWrapper } from '@/tests/test-utils';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Tests: useEmailMappings hooks
// ─────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
  mockFetch.mockReset();
});

describe('useEmailMappings', () => {
  it('fetches all email mappings', async () => {
    const mockData = {
      data: [
        {
          id: '1',
          githubUsername: 'alice',
          email: 'alice@corp.com',
          displayName: null,
          source: 'manual',
        },
      ],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEmailMappings(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });

  it('handles error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ error: 'Unauthorized' }),
    });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEmailMappings(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateEmailMapping', () => {
  it('creates mapping via POST', async () => {
    const created = { data: { id: '2', githubUsername: 'bob', email: 'bob@corp.com' } };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(created),
    });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useCreateEmailMapping(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate({ githubUsername: 'bob', email: 'bob@corp.com' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify POST call
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/email-mappings',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});

describe('useDeleteEmailMapping', () => {
  it('deletes mapping via DELETE', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({}) });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useDeleteEmailMapping(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate('mapping-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/email-mappings/mapping-1',
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
  });
});
