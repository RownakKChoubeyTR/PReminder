import { ThemeToggle } from '@/components/layout/theme-toggle';
import { ThemeContext, type ThemeContextValue } from '@/context/theme-provider';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────
// ThemeToggle Component Tests
// ─────────────────────────────────────────────────────────────

function renderWithTheme(themeValue: ThemeContextValue) {
  return render(
    <ThemeContext.Provider value={themeValue}>
      <ThemeToggle />
    </ThemeContext.Provider>,
  );
}

const baseTheme = {
  mounted: true,
} as const;

describe('ThemeToggle', () => {
  it('should render a button', () => {
    renderWithTheme({
      ...baseTheme,
      theme: 'light',
      resolvedTheme: 'light',
      setTheme: vi.fn(),
    });

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should show correct aria-label for light theme', () => {
    renderWithTheme({
      ...baseTheme,
      theme: 'light',
      resolvedTheme: 'light',
      setTheme: vi.fn(),
    });

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');
  });

  it('should show correct aria-label for dark theme', () => {
    renderWithTheme({
      ...baseTheme,
      theme: 'dark',
      resolvedTheme: 'dark',
      setTheme: vi.fn(),
    });

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Switch to system mode');
  });

  it('should show correct aria-label for system theme', () => {
    renderWithTheme({
      ...baseTheme,
      theme: 'system',
      resolvedTheme: 'light',
      setTheme: vi.fn(),
    });

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Switch to light mode');
  });

  it('should cycle light → dark on click', () => {
    const setTheme = vi.fn();
    renderWithTheme({
      ...baseTheme,
      theme: 'light',
      resolvedTheme: 'light',
      setTheme,
    });

    fireEvent.click(screen.getByRole('button'));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('should cycle dark → system on click', () => {
    const setTheme = vi.fn();
    renderWithTheme({
      ...baseTheme,
      theme: 'dark',
      resolvedTheme: 'dark',
      setTheme,
    });

    fireEvent.click(screen.getByRole('button'));
    expect(setTheme).toHaveBeenCalledWith('system');
  });

  it('should cycle system → light on click', () => {
    const setTheme = vi.fn();
    renderWithTheme({
      ...baseTheme,
      theme: 'system',
      resolvedTheme: 'light',
      setTheme,
    });

    fireEvent.click(screen.getByRole('button'));
    expect(setTheme).toHaveBeenCalledWith('light');
  });

  it('should render placeholder when not mounted', () => {
    renderWithTheme({
      mounted: false,
      theme: 'dark',
      resolvedTheme: 'dark',
      setTheme: vi.fn(),
    });

    const button = screen.getByRole('button', { hidden: true });
    expect(button).toHaveAttribute('aria-hidden');
    expect(button).not.toHaveAttribute('aria-label');
  });
});
