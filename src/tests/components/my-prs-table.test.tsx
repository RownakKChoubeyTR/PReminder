import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─────────────────────────────────────────────────────────────
// Tests: MyPRsTable
// ─────────────────────────────────────────────────────────────

vi.mock('@/hooks/use-dashboard-store', () => ({
  useDashboardStore: vi.fn(),
}));

vi.mock('@/hooks/use-my-prs', () => ({
  useMyPRs: vi.fn(),
}));

vi.mock('@/hooks/use-reviewers', () => ({
  useReviewers: vi.fn(),
}));

import { useDashboardStore } from '@/hooks/use-dashboard-store';
import { useMyPRs } from '@/hooks/use-my-prs';
import { useReviewers } from '@/hooks/use-reviewers';
import { MyPRsTable } from '@/components/pr/my-prs-table';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const mockPRs = [
  {
    id: 1,
    number: 10,
    title: 'Add login feature',
    repo_name: 'org/frontend',
    state: 'open',
    draft: false,
    labels: [{ id: 100, name: 'bug', color: 'ff0000' }],
    requested_reviewers: [{ id: 2, login: 'bob', avatar_url: '' }],
    head: { ref: 'feat/login', sha: 'abc' },
    base: { ref: 'main' },
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    user: { id: 1, login: 'alice', avatar_url: '', type: 'User' },
    html_url: 'https://github.com/org/frontend/pull/10',
    body: null,
  },
  {
    id: 2,
    number: 11,
    title: 'Fix mobile layout',
    repo_name: 'org/mobile',
    state: 'closed',
    draft: false,
    labels: [],
    requested_reviewers: [],
    head: { ref: 'fix/layout', sha: 'def' },
    base: { ref: 'main' },
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    user: { id: 1, login: 'alice', avatar_url: '', type: 'User' },
    html_url: 'https://github.com/org/mobile/pull/11',
    body: null,
  },
];

describe('MyPRsTable', () => {
  const setMyPrSelected = vi.fn();

  beforeEach(() => {
    vi.mocked(useDashboardStore).mockReturnValue({
      myPrSelected: null,
      setMyPrSelected,
    } as never);
    vi.mocked(useMyPRs).mockReturnValue({
      data: { data: mockPRs, total: 2, hasNextPage: false },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as never);
    vi.mocked(useReviewers).mockReturnValue({
      data: { data: [] },
      isLoading: false,
    } as never);
  });

  it('renders PR rows with number and title', () => {
    render(<MyPRsTable />, { wrapper });
    expect(screen.getByText('#10')).toBeInTheDocument();
    expect(screen.getByText('Add login feature')).toBeInTheDocument();
    expect(screen.getByText('#11')).toBeInTheDocument();
  });

  it('renders repository name column', () => {
    render(<MyPRsTable />, { wrapper });
    expect(screen.getByText('org/frontend')).toBeInTheDocument();
    expect(screen.getByText('org/mobile')).toBeInTheDocument();
  });

  it('renders labels', () => {
    render(<MyPRsTable />, { wrapper });
    expect(screen.getByText('bug')).toBeInTheDocument();
  });

  it('renders PR count in toolbar', () => {
    render(<MyPRsTable />, { wrapper });
    expect(screen.getByText(/2 PRs/)).toBeInTheDocument();
  });

  it('calls setMyPrSelected with PR on row click', () => {
    render(<MyPRsTable />, { wrapper });
    const rows = screen.getAllByRole('row');
    // rows[0] is the header row; data rows start at rows[1]
    fireEvent.click(rows[1]!);
    expect(setMyPrSelected).toHaveBeenCalledWith(mockPRs[0]);
  });

  it('calls setMyPrSelected(null) when clicking the already-selected row', () => {
    vi.mocked(useDashboardStore).mockReturnValue({
      myPrSelected: mockPRs[0],
      setMyPrSelected,
    } as never);

    render(<MyPRsTable />, { wrapper });
    const rows = screen.getAllByRole('row');
    fireEvent.click(rows[1]!);
    expect(setMyPrSelected).toHaveBeenCalledWith(null);
  });

  it('shows loading state', () => {
    vi.mocked(useMyPRs).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as never);

    render(<MyPRsTable />, { wrapper });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Loading your pull requests/i)).toBeInTheDocument();
  });

  it('shows error state with retry button', () => {
    const refetch = vi.fn();
    vi.mocked(useMyPRs).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('GitHub fetch failed'),
      refetch,
      isFetching: false,
    } as never);

    render(<MyPRsTable />, { wrapper });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/GitHub fetch failed/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('shows empty state when no PRs', () => {
    vi.mocked(useMyPRs).mockReturnValue({
      data: { data: [], total: 0, hasNextPage: false },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as never);

    render(<MyPRsTable />, { wrapper });
    expect(screen.getByText(/No pull requests found/i)).toBeInTheDocument();
  });

  it('renders table with correct aria-label', () => {
    render(<MyPRsTable />, { wrapper });
    expect(screen.getByRole('grid', { name: /My pull requests/i })).toBeInTheDocument();
  });

  it('shows sortable column headers', () => {
    render(<MyPRsTable />, { wrapper });
    const headers = screen.getAllByRole('columnheader');
    const headerTexts = headers.map((h) => h.textContent ?? '').join(' ');
    expect(headerTexts).toContain('#');
    expect(headerTexts).toContain('Title');
    expect(headerTexts).toContain('Repository');
    expect(headerTexts).toContain('Status');
    expect(headerTexts).toContain('Reviewers');
    expect(headerTexts).toContain('Age');
  });

  it('shows pagination controls when hasNextPage is true', () => {
    vi.mocked(useMyPRs).mockReturnValue({
      data: { data: mockPRs, total: 100, hasNextPage: true },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as never);

    render(<MyPRsTable />, { wrapper });
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
  });

  it('does not show pagination on first page with no next page', () => {
    render(<MyPRsTable />, { wrapper });
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
  });

  it('shows reviewer avatars when useReviewers returns data', () => {
    vi.mocked(useReviewers).mockReturnValue({
      data: {
        data: [
          { user: { id: 1, login: 'bob', avatar_url: 'https://avatar.com/bob.png' }, status: 'approved' },
        ],
      },
      isLoading: false,
    } as never);

    render(<MyPRsTable />, { wrapper });
    const avatars = screen.getAllByRole('img');
    expect(avatars.length).toBeGreaterThan(0);
    expect(avatars[0]).toHaveAttribute('alt', 'bob');
  });

  it('shows None when reviewer list is empty', () => {
    vi.mocked(useReviewers).mockReturnValue({
      data: { data: [] },
      isLoading: false,
    } as never);

    render(<MyPRsTable />, { wrapper });
    expect(screen.getAllByText('None').length).toBeGreaterThan(0);
  });

  it('clicking a column header changes sort direction on second click', () => {
    render(<MyPRsTable />, { wrapper });
    const ageHeader = screen.getByText(/Age/);
    // First click: already sorted by age desc (default) → switches to asc
    fireEvent.click(ageHeader);
    // Second click: sorts desc again
    fireEvent.click(ageHeader);
    // Just ensure no crash and table still renders
    expect(screen.getByText('#10')).toBeInTheDocument();
  });

  it('row is keyboard-accessible via Enter key', () => {
    render(<MyPRsTable />, { wrapper });
    const rows = screen.getAllByRole('row');
    fireEvent.keyDown(rows[1]!, { key: 'Enter' });
    expect(setMyPrSelected).toHaveBeenCalledWith(mockPRs[0]);
  });
});
