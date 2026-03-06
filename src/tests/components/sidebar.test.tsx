import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-dashboard-store', () => ({
  useDashboardStore: vi.fn(),
}));

vi.mock('@/hooks/use-debounced-value', () => ({
  useDebouncedValue: vi.fn((v: string) => v),
}));

vi.mock('@/hooks/use-repos', () => ({
  useRepos: vi.fn(),
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: () => void;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/dashboard'),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() })),
}));

import { Sidebar } from '@/components/layout/sidebar';
import { useDashboardStore } from '@/hooks/use-dashboard-store';
import { useRepos } from '@/hooks/use-repos';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('Sidebar', () => {
  const onCloseMobile = vi.fn();
  const selectRepo = vi.fn();
  const setRepoSearch = vi.fn();
  const setRepoPage = vi.fn();

  beforeEach(() => {
    vi.mocked(useDashboardStore).mockReturnValue({
      selectedRepo: null,
      selectRepo,
      sidebarCollapsed: false,
      repoSearch: '',
      setRepoSearch,
      repoPage: 1,
      setRepoPage,
    } as never);
    vi.mocked(useRepos).mockReturnValue({
      data: {
        data: [
          { id: 1, name: 'repo-a', open_issues_count: 5 },
          { id: 2, name: 'repo-b', open_issues_count: 2 },
        ],
        total: 2,
        hasNextPage: false,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as never);
  });

  it('renders navigation links', () => {
    render(<Sidebar mobileOpen={false} onCloseMobile={onCloseMobile} />, { wrapper });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Templates')).toBeInTheDocument();
    expect(screen.getByText('Reminders')).toBeInTheDocument();
    expect(screen.getByText('My PRs')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders repository list', () => {
    render(<Sidebar mobileOpen={false} onCloseMobile={onCloseMobile} />, { wrapper });
    expect(screen.getByText('repo-a')).toBeInTheDocument();
    expect(screen.getByText('repo-b')).toBeInTheDocument();
  });

  it('shows repo count badges', () => {
    render(<Sidebar mobileOpen={false} onCloseMobile={onCloseMobile} />, { wrapper });
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('calls selectRepo on repo click', () => {
    render(<Sidebar mobileOpen={false} onCloseMobile={onCloseMobile} />, { wrapper });
    fireEvent.click(screen.getByText('repo-a'));
    expect(selectRepo).toHaveBeenCalledWith('repo-a');
  });

  it('renders search input', () => {
    render(<Sidebar mobileOpen={false} onCloseMobile={onCloseMobile} />, { wrapper });
    expect(screen.getByRole('searchbox', { name: /Search repositories/i })).toBeInTheDocument();
  });

  it('updates search on input', () => {
    render(<Sidebar mobileOpen={false} onCloseMobile={onCloseMobile} />, { wrapper });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'test' } });
    expect(setRepoSearch).toHaveBeenCalledWith('test');
  });

  it('shows loading skeletons', () => {
    vi.mocked(useRepos).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as never);
    render(<Sidebar mobileOpen={false} onCloseMobile={onCloseMobile} />, { wrapper });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows error state with retry', () => {
    const refetch = vi.fn();
    vi.mocked(useRepos).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('fail'),
      refetch,
      isFetching: false,
    } as never);
    render(<Sidebar mobileOpen={false} onCloseMobile={onCloseMobile} />, { wrapper });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Retry'));
    expect(refetch).toHaveBeenCalled();
  });

  it('hides repo list when collapsed', () => {
    vi.mocked(useDashboardStore).mockReturnValue({
      selectedRepo: null,
      selectRepo,
      sidebarCollapsed: true,
      repoSearch: '',
      setRepoSearch,
      repoPage: 1,
      setRepoPage,
    } as never);
    render(<Sidebar mobileOpen={false} onCloseMobile={onCloseMobile} />, { wrapper });
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('shows mobile overlay when mobileOpen', () => {
    const { container } = render(<Sidebar mobileOpen={true} onCloseMobile={onCloseMobile} />, {
      wrapper,
    });
    // overlay is an aria-hidden div
    const overlay = container.querySelector('[aria-hidden="true"]');
    expect(overlay).toBeTruthy();
  });

  it('shows pagination controls', () => {
    vi.mocked(useRepos).mockReturnValue({
      data: {
        data: [{ id: 1, name: 'repo-a', open_issues_count: 0 }],
        total: 50,
        hasNextPage: true,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as never);
    render(<Sidebar mobileOpen={false} onCloseMobile={onCloseMobile} />, { wrapper });
    expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();
  });

  it('My PRs link points to /dashboard/my-prs', () => {
    render(<Sidebar mobileOpen={false} onCloseMobile={onCloseMobile} />, { wrapper });
    const link = screen.getByText('My PRs').closest('a') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.href).toContain('/dashboard/my-prs');
  });
});
