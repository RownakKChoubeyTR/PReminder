import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-dashboard-store', () => ({
  useDashboardStore: vi.fn(),
}));

vi.mock('@/lib/query-client', () => ({
  getQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@/components/layout/theme-toggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock('@/components/layout/user-menu', () => ({
  UserMenu: () => <div data-testid="user-menu" />,
}));

import { Header } from '@/components/layout/header';
import { useDashboardStore } from '@/hooks/use-dashboard-store';

describe('Header', () => {
  const toggleSidebar = vi.fn();
  const onMenuClick = vi.fn();

  beforeEach(() => {
    vi.mocked(useDashboardStore).mockReturnValue({
      selectedRepo: null,
      sidebarCollapsed: false,
      toggleSidebar,
    } as never);
  });

  it('renders navigation menu button', () => {
    render(<Header onMenuClick={onMenuClick} />);
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeInTheDocument();
  });

  it('calls onMenuClick when hamburger is clicked', () => {
    render(<Header onMenuClick={onMenuClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(onMenuClick).toHaveBeenCalled();
  });

  it('renders sidebar toggle button', () => {
    render(<Header onMenuClick={onMenuClick} />);
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
  });

  it('calls toggleSidebar on toggle button click', () => {
    render(<Header onMenuClick={onMenuClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(toggleSidebar).toHaveBeenCalled();
  });

  it('shows Dashboard breadcrumb', () => {
    render(<Header onMenuClick={onMenuClick} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('shows repo name in breadcrumb when selected', () => {
    vi.mocked(useDashboardStore).mockReturnValue({
      selectedRepo: 'my-repo',
      sidebarCollapsed: false,
      toggleSidebar,
    } as never);
    render(<Header onMenuClick={onMenuClick} />);
    expect(screen.getByText('my-repo')).toBeInTheDocument();
  });

  it('renders refresh button', () => {
    render(<Header onMenuClick={onMenuClick} />);
    expect(screen.getByRole('button', { name: 'Refresh data' })).toBeInTheDocument();
  });

  it('renders ThemeToggle and UserMenu', () => {
    render(<Header onMenuClick={onMenuClick} />);
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('user-menu')).toBeInTheDocument();
  });
});
