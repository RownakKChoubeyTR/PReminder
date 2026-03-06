import { cn } from '@/lib/utils';
import { describe, expect, it } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Tests: Utility functions
// ─────────────────────────────────────────────────────────────

describe('cn', () => {
  it('merges simple class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('handles conditional classes (falsy values)', () => {
    expect(cn('base', false && 'hidden', null, undefined, 'end')).toBe('base end');
  });

  it('deduplicates conflicting Tailwind classes (later wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });

  it('handles array input', () => {
    expect(cn(['px-2', 'py-1'])).toBe('px-2 py-1');
  });

  it('handles object input', () => {
    expect(cn({ 'bg-red-500': true, 'text-white': false })).toBe('bg-red-500');
  });
});
