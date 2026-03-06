import { ThemeContext, type ThemeContextValue } from '@/context/theme-provider';
import { useContext } from 'react';

/**
 * Access the current theme and the setter.
 *
 * Must be used within a `<ThemeProvider>`.
 *
 * @example
 * ```tsx
 * const { theme, resolvedTheme, setTheme } = useTheme();
 * ```
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);

  if (!ctx) {
    throw new Error('useTheme must be used within a <ThemeProvider>');
  }

  return ctx;
}
