import { useReviewers } from '@/hooks/use-reviewers';
import { createQueryWrapper } from '@/tests/test-utils';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Tests: useReviewers hook
// ─────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
});

describe('useReviewers', () => {
    it('does not fetch when repo is null', () => {
        const { Wrapper } = createQueryWrapper();
        const { result } = renderHook(() => useReviewers(null, 42), { wrapper: Wrapper });

        expect(result.current.fetchStatus).toBe('idle');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not fetch when prNumber is null', () => {
        const { Wrapper } = createQueryWrapper();
        const { result } = renderHook(() => useReviewers('org/repo', null), {
            wrapper: Wrapper
        });

        expect(result.current.fetchStatus).toBe('idle');
    });

    it('fetches reviewers for a valid repo and PR', async () => {
        const mockData = {
            data: [{ login: 'alice', status: 'APPROVED', avatarUrl: 'https://example.com/alice.png' }]
        };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue(mockData)
        });

        const { Wrapper } = createQueryWrapper();
        const { result } = renderHook(() => useReviewers('org/repo', 42), {
            wrapper: Wrapper
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual(mockData);
    });

    it('throws error on non-OK response', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: vi.fn().mockResolvedValue({ error: 'PR not found' })
        });

        const { Wrapper } = createQueryWrapper();
        const { result } = renderHook(() => useReviewers('org/repo', 42), {
            wrapper: Wrapper
        });

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.error?.message).toContain('PR not found');
    });
});
