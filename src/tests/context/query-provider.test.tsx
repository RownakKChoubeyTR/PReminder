import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/query-client', () => ({
  getQueryClient: vi.fn(() => ({
    mount: vi.fn(),
    unmount: vi.fn(),
    getDefaultOptions: vi.fn(() => ({})),
    setDefaultOptions: vi.fn(),
    getQueryDefaults: vi.fn(),
    getQueryCache: vi.fn(() => ({ subscribe: vi.fn(() => vi.fn()) })),
    getMutationCache: vi.fn(() => ({ subscribe: vi.fn(() => vi.fn()) })),
  })),
}));

import { QueryProvider } from '@/context/query-provider';

describe('QueryProvider', () => {
  it('renders children', () => {
    render(
      <QueryProvider>
        <div data-testid="child">Content</div>
      </QueryProvider>,
    );
    expect(screen.getByTestId('child')).toHaveTextContent('Content');
  });
});
