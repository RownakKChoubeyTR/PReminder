import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

// ─────────────────────────────────────────────────────────────
// useDebouncedValue Tests
// ─────────────────────────────────────────────────────────────

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('hello'));
    expect(result.current).toBe('hello');
  });

  it('should not update before the delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 400),
      { initialProps: { value: 'initial' } },
    );

    rerender({ value: 'updated' });

    // 200ms — not enough time
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe('initial');
  });

  it('should update after the delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 400),
      { initialProps: { value: 'initial' } },
    );

    rerender({ value: 'updated' });

    act(() => { vi.advanceTimersByTime(400); });
    expect(result.current).toBe('updated');
  });

  it('should reset the timer on rapid changes (only last value wins)', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 400),
      { initialProps: { value: '' } },
    );

    // Simulate rapid typing: "r", "re", "rea", "reac", "react"
    rerender({ value: 'r' });
    act(() => { vi.advanceTimersByTime(100); });

    rerender({ value: 're' });
    act(() => { vi.advanceTimersByTime(100); });

    rerender({ value: 'rea' });
    act(() => { vi.advanceTimersByTime(100); });

    rerender({ value: 'reac' });
    act(() => { vi.advanceTimersByTime(100); });

    rerender({ value: 'react' });

    // Still initial — timer keeps resetting
    expect(result.current).toBe('');

    // Wait full 400ms from last change
    act(() => { vi.advanceTimersByTime(400); });
    expect(result.current).toBe('react');
  });

  it('should work with a custom delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 200),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'b' });

    act(() => { vi.advanceTimersByTime(199); });
    expect(result.current).toBe('a');

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe('b');
  });

  it('should work with non-string values', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 1 } },
    );

    rerender({ value: 42 });

    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe(42);
  });
});
