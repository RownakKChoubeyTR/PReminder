import {
  useCreateTemplate,
  useDeleteTemplate,
  useTemplates,
  useUpdateTemplate,
} from '@/hooks/use-templates';
import { createQueryWrapper } from '@/tests/test-utils';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Tests: useTemplates hooks
// ─────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
  mockFetch.mockReset();
});

describe('useTemplates', () => {
  it('fetches all templates', async () => {
    const mockData = {
      data: [{ id: '1', name: 'Default', body: 'Hi {{receiverName}}' }],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTemplates(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });
});

describe('useCreateTemplate', () => {
  it('creates template via POST', async () => {
    const mockResult = { data: { id: '2', name: 'Custom' } };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useCreateTemplate(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate({ name: 'Custom', body: 'Hello', type: 'TEAMS_DM' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useUpdateTemplate', () => {
  it('updates template via PUT', async () => {
    const mockResult = { data: { id: '1', name: 'Updated' } };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useUpdateTemplate(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate({
        id: '1',
        input: { name: 'Updated', body: 'Yo', type: 'TEAMS_DM' },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useDeleteTemplate', () => {
  it('deletes template via DELETE', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({}) });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useDeleteTemplate(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate('tmpl-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
