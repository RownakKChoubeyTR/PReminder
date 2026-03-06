import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/use-dashboard-store', () => ({
  useDashboardStore: vi.fn(),
}));

vi.mock('@/hooks/use-debounced-value', () => ({
  useDebouncedValue: vi.fn((v: string) => v),
}));

vi.mock('@/hooks/use-pulls', () => ({
  usePulls: vi.fn(),
}));

import { useDashboardStore } from '@/hooks/use-dashboard-store';
import { usePulls } from '@/hooks/use-pulls';
import { PRTable } from '@/components/pr/pr-table';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const mockPRs = [
  {
    id: 1,
    number: 42,
    title: 'Add feature',
    user: { login: 'alice', avatar_url: 'https://avatar.com/alice' },
    created_at: '2024-01-01T00:00:00Z',
    draft: false,
    labels: [{ id: 1, name: 'enhancement', color: '0075ca' }],
    requested_reviewers: [{ id: 2, login: 'bob', avatar_url: 'https://avatar.com/bob' }],
  },
  {
    id: 2,
    number: 43,
    title: 'Fix bug',
    user: { login: 'charlie', avatar_url: 'https://avatar.com/charlie' },
    created_at: '2024-06-01T00:00:00Z',
    draft: true,
    labels: [],
    requested_reviewers: [],
  },
];

describe('PRTable', () => {
  const selectPR = vi.fn();
  const setPrSearch = vi.fn();
  const setPrPage = vi.fn();

  beforeEach(() => {
    vi.mocked(useDashboardStore).mockReturnValue({
      selectedRepo: 'org/repo',
      selectedPR: null,
      selectPR,
      prSearch: '',
      setPrSearch,
      prPage: 1,
      setPrPage,
    } as never);
    vi.mocked(usePulls).mockReturnValue({
      data: { data: mockPRs, total: 2, hasNextPage: false },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as never);
  });

  it('renders table with PRs', () => {
    render(<PRTable />, { wrapper });
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('Add feature')).toBeInTheDocument();
    expect(screen.getByText('#43')).toBeInTheDocument();
  });

  it('shows author names', () => {
    render(<PRTable />, { wrapper });
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('charlie')).toBeInTheDocument();
  });

  it('shows empty state when no repo selected', () => {
    vi.mocked(useDashboardStore).mockReturnValue({
      selectedRepo: null,
      selectedPR: null,
      selectPR,
      prSearch: '',
      setPrSearch,
      prPage: 1,
      setPrPage,
    } as never);
    render(<PRTable />, { wrapper });
    expect(screen.getByText('Select a repository')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(usePulls).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as never);
    render(<PRTable />, { wrapper });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows error state with retry', () => {
    const refetch = vi.fn();
    vi.mocked(usePulls).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('fail'),
      refetch,
      isFetching: false,
    } as never);
    render(<PRTable />, { wrapper });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Retry'));
    expect(refetch).toHaveBeenCalled();
  });

  it('shows no PRs empty state', () => {
    vi.mocked(usePulls).mockReturnValue({
      data: { data: [], total: 0, hasNextPage: false },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as never);
    render(<PRTable />, { wrapper });
    expect(screen.getByText(/No open pull requests/)).toBeInTheDocument();
  });

  it('selects a PR on row click', () => {
    render(<PRTable />, { wrapper });
    fireEvent.click(screen.getByText('#42'));
    expect(selectPR).toHaveBeenCalledWith(42);
  });

  it('deselects PR when clicking selected row', () => {
    vi.mocked(useDashboardStore).mockReturnValue({
      selectedRepo: 'org/repo',
      selectedPR: 42,
      selectPR,
      prSearch: '',
      setPrSearch,
      prPage: 1,
      setPrPage,
    } as never);
    render(<PRTable />, { wrapper });
    fireEvent.click(screen.getByText('#42'));
    expect(selectPR).toHaveBeenCalledWith(null);
  });

  it('shows search input', () => {
    render(<PRTable />, { wrapper });
    expect(screen.getByRole('searchbox', { name: /Search pull requests/i })).toBeInTheDocument();
  });

  it('updates search on input', () => {
    render(<PRTable />, { wrapper });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'feat' } });
    expect(setPrSearch).toHaveBeenCalledWith('feat');
  });

  it('handles keyboard selection with Enter', () => {
    render(<PRTable />, { wrapper });
    const row = screen.getByText('#42').closest('tr')!;
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(selectPR).toHaveBeenCalledWith(42);
  });

  it('shows labels', () => {
    render(<PRTable />, { wrapper });
    expect(screen.getByText('enhancement')).toBeInTheDocument();
  });

  it('shows reviewer count text when none', () => {
    render(<PRTable />, { wrapper });
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('sorts by column on header click', () => {
    render(<PRTable />, { wrapper });
    const titleHeader = screen.getByText('Title');
    fireEvent.click(titleHeader);
    // Just verifying it doesn't crash and PRs are still rendered
    expect(screen.getByText('Add feature')).toBeInTheDocument();
  });
});
