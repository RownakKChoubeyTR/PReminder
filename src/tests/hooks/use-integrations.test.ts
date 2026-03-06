import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createQueryWrapper } from '@/tests/test-utils';
import {
  useIntegrations,
  useCreateIntegration,
  useUpdateIntegration,
  useDeleteIntegration,
  useTestIntegration,
} from '@/hooks/use-integrations';

// ─────────────────────────────────────────────────────────────
// Tests: useIntegrations hooks
// ─────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
  mockFetch.mockReset();
});

describe('useIntegrations', () => {
  it('fetches all integration configs', async () => {
    const mockData = {
      data: [
        { id: '1', type: 'POWER_AUTOMATE_DM', label: 'My Flow', isActive: true },
      ],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useIntegrations(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });
});

describe('useCreateIntegration', () => {
  it('creates integration via POST', async () => {
    const created = { data: { id: '2', type: 'TEAMS_WEBHOOK', label: 'Dev Channel' } };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(created),
    });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useCreateIntegration(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate({
        type: 'TEAMS_WEBHOOK',
        label: 'Dev Channel',
        value: 'https://example.com/webhook',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useUpdateIntegration', () => {
  it('updates integration via PUT', async () => {
    const updated = { data: { id: '1', label: 'Updated' } };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(updated),
    });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useUpdateIntegration(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate({
        id: '1',
        input: { label: 'Updated', isActive: false },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('id=1'),
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});

describe('useDeleteIntegration', () => {
  it('deletes integration via DELETE', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({}) });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useDeleteIntegration(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate('int-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('id=int-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('useTestIntegration', () => {
  it('tests integration via PATCH', async () => {
    const testResult = { success: true, statusCode: 200 };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(testResult),
    });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTestIntegration(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate('int-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(testResult);
  });
});
