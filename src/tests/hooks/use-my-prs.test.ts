import { useMyPRs } from '@/hooks/use-my-prs';
import { createQueryWrapper } from '@/tests/test-utils';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Tests: useMyPRs hook
// ─────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
});

const mockData = {
    data: [
        {
            id: 1,
            number: 42,
            title: 'Fix login bug',
            repo_name: 'org/frontend',
            state: 'open',
            draft: false,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-02T00:00:00Z'
        }
    ],
    total: 1,
    page: 1,
    perPage: 30,
    hasNextPage: false
};

describe('useMyPRs', () => {
    it('fetches /api/github/my-prs with default params', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue(mockData)
        });

        const { Wrapper } = createQueryWrapper();
        const { result } = renderHook(() => useMyPRs(), { wrapper: Wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual(mockData);
        const url = mockFetch.mock.calls[0]![0] as string;
        expect(url).toContain('/api/github/my-prs');
        expect(url).toContain('page=1');
        expect(url).toContain('per_page=30');
    });

    it('forwards custom page and perPage params', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue({ ...mockData, page: 2, perPage: 10 })
        });

        const { Wrapper } = createQueryWrapper();
        renderHook(() => useMyPRs(2, 10), { wrapper: Wrapper });

        await waitFor(() => expect(mockFetch).toHaveBeenCalled());

        const url = mockFetch.mock.calls[0]![0] as string;
        expect(url).toContain('page=2');
        expect(url).toContain('per_page=10');
    });

    it('throws error on non-OK response', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: vi.fn().mockResolvedValue({ error: 'Unauthorized' })
        });

        const { Wrapper } = createQueryWrapper();
        const { result } = renderHook(() => useMyPRs(), { wrapper: Wrapper });

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.error).toBeTruthy();
    });

    it('throws error with message from response body', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 403,
            json: vi.fn().mockResolvedValue({ error: 'SAML SSO authorization required' })
        });

        const { Wrapper } = createQueryWrapper();
        const { result } = renderHook(() => useMyPRs(), { wrapper: Wrapper });

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect((result.current.error as Error).message).toContain('SAML SSO authorization required');
    });

    it('falls back to generic error message when body has no error field', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: vi.fn().mockResolvedValue({})
        });

        const { Wrapper } = createQueryWrapper();
        const { result } = renderHook(() => useMyPRs(), { wrapper: Wrapper });

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect((result.current.error as Error).message).toContain('500');
    });

    it('returns paginated data with hasNextPage', async () => {
        const pagedData = { ...mockData, total: 100, hasNextPage: true };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue(pagedData)
        });

        const { Wrapper } = createQueryWrapper();
        const { result } = renderHook(() => useMyPRs(1, 30), { wrapper: Wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.hasNextPage).toBe(true);
        expect(result.current.data?.total).toBe(100);
    });
});
