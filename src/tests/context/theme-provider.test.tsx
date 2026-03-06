import { ThemeContext, ThemeProvider } from '@/context/theme-provider';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useContext } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// jsdom doesn't provide matchMedia — stub it
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

function ThemeConsumer() {
  const ctx = useContext(ThemeContext);
  if (!ctx) return <div>no context</div>;
  return (
    <div>
      <span data-testid="theme">{ctx.theme}</span>
      <span data-testid="resolved">{ctx.resolvedTheme}</span>
      <span data-testid="mounted">{String(ctx.mounted)}</span>
      <button type="button" onClick={() => ctx.setTheme('dark')}>
        Set Dark
      </button>
      <button type="button" onClick={() => ctx.setTheme('light')}>
        Set Light
      </button>
      <button type="button" onClick={() => ctx.setTheme('system')}>
        Set System
      </button>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('provides default theme', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('system');
  });

  it('resolves system theme to light or dark', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    const resolved = screen.getByTestId('resolved').textContent;
    expect(['light', 'dark']).toContain(resolved);
  });

  it('sets mounted to true after render', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('mounted')).toHaveTextContent('true');
  });

  it('changes theme to dark', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText('Set Dark'));
    });
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('changes theme to light', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText('Set Light'));
    });
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
  });

  it('persists to localStorage', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText('Set Dark'));
    });
    expect(localStorage.getItem('preminder-theme')).toBe('dark');
  });

  it('restores theme from localStorage', () => {
    localStorage.setItem('preminder-theme', 'dark');
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });

  it('uses custom defaultTheme', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });
});
