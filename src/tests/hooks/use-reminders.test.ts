import { useCooldownCheck, useReminderLogs, useSendReminders } from '@/hooks/use-reminders';
import { createQueryWrapper } from '@/tests/test-utils';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Tests: useReminders hooks
// ─────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
});

describe('useReminderLogs', () => {
    it('fetches paginated reminder logs', async () => {
        const mockData = {
            data: [{ id: '1', prNumber: 42, status: 'SENT' }],
            total: 1,
            page: 1,
            perPage: 20,
            hasNextPage: false
        };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue(mockData)
        });

        const { Wrapper } = createQueryWrapper();
        const { result } = renderHook(() => useReminderLogs(1, 20), { wrapper: Wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual(mockData);
    });

    it('throws error on failure', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: vi.fn().mockResolvedValue({ error: 'DB error' })
        });

        const { Wrapper } = createQueryWrapper();
        const { result } = renderHook(() => useReminderLogs(), { wrapper: Wrapper });

        await waitFor(() => expect(result.current.isError).toBe(true));
    });
});

describe('useSendReminders', () => {
    it('sends reminders via POST and returns result', async () => {
        const mockResult = { total: 1, sent: 1, failed: 0, results: [] };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue(mockResult)
        });

        const { Wrapper } = createQueryWrapper();
        const { result } = renderHook(() => useSendReminders(), { wrapper: Wrapper });

        await act(async () => {
            result.current.mutate({
                recipients: ['alice'],
                pr: {
                    number: 42,
                    title: 'Test',
                    url: 'https://github.com/org/repo/pull/42',
                    repo: 'org/repo',
                    branch: 'fix',
                    targetBranch: 'main',
                    age: 1,
                    labels: [],
                    description: ''
                },
                templateId: 'tmpl-1',
                channel: 'TEAMS_DM'
            });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual(mockResult);
    });
});

describe('useCooldownCheck', () => {
    it('does not fetch when recipients is empty', () => {
        const { Wrapper } = createQueryWrapper();
        const { result } = renderHook(() => useCooldownCheck([], 42, 'org/repo'), {
            wrapper: Wrapper
        });

        expect(result.current.fetchStatus).toBe('idle');
    });

    it('does not fetch when prNumber is null', () => {
        const { Wrapper } = createQueryWrapper();
        const { result } = renderHook(() => useCooldownCheck(['alice'], null, 'org/repo'), {
            wrapper: Wrapper
        });

        expect(result.current.fetchStatus).toBe('idle');
    });

    it('fetches cooldown status when all params are provided', async () => {
        const mockData = {
            data: [{ login: 'alice', allowed: true, remainingSeconds: 0 }]
        };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue(mockData)
        });

        const { Wrapper } = createQueryWrapper();
        const { result } = renderHook(() => useCooldownCheck(['alice'], 42, 'org/repo'), {
            wrapper: Wrapper
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual(mockData);
    });
});
