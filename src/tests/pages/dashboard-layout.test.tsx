import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

import DashboardLayout from '@/app/dashboard/layout';

describe('DashboardLayout', () => {
  it('wraps children in AppShell', () => {
    render(
      <DashboardLayout>
        <div data-testid="child">Content</div>
      </DashboardLayout>,
    );
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
