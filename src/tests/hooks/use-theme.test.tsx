import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { useTheme } from '@/hooks/use-theme';
import { ThemeContext, type ThemeContextValue } from '@/context/theme-provider';

// ─────────────────────────────────────────────────────────────
// Tests: useTheme hook
// ─────────────────────────────────────────────────────────────

describe('useTheme', () => {
  it('returns theme context value when within provider', () => {
    const mockValue: ThemeContextValue = {
      theme: 'dark',
      resolvedTheme: 'dark',
      setTheme: () => {},
      mounted: true,
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeContext.Provider value={mockValue}>{children}</ThemeContext.Provider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('throws when used outside ThemeProvider', () => {
    expect(() => {
      renderHook(() => useTheme());
    }).toThrow('useTheme must be used within a <ThemeProvider>');
  });
});
