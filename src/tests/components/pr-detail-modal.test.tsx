import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────

vi.mock('@/hooks/use-dashboard-store', () => ({
  useDashboardStore: vi.fn(),
}));

vi.mock('@/hooks/use-pulls', () => ({
  usePulls: vi.fn(),
}));

vi.mock('@/hooks/use-debounced-value', () => ({
  useDebouncedValue: vi.fn((v: string) => v),
}));

vi.mock('@/hooks/use-reminder-store', () => ({
  useReminderStore: vi.fn(() => ({
    setPrContext: vi.fn(),
    clearReviewers: vi.fn(),
  })),
}));

vi.mock('@/components/reminders/bulk-action-bar', () => ({
  BulkActionBar: () => <div data-testid="bulk-action-bar" />,
}));

vi.mock('@/components/reminders/reminder-flow-modal', () => ({
  ReminderFlowModal: () => <div data-testid="reminder-flow-modal" />,
}));

vi.mock('@/components/pr/status-badge', () => ({
  StatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));

vi.mock('@/components/pr/reviewer-list', () => ({
  ReviewerList: () => <div data-testid="reviewer-list" />,
}));

import { PRDetailModal } from '@/components/pr/pr-detail-modal';
import { useDashboardStore } from '@/hooks/use-dashboard-store';
import { usePulls } from '@/hooks/use-pulls';
import { useReminderStore } from '@/hooks/use-reminder-store';

const pr = {
  id: 1,
  number: 42,
  title: 'Add login feature',
  body: 'Description of the PR',
  html_url: 'https://github.com/org/repo/pull/42',
  state: 'open' as const,
  draft: false,
  created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  updated_at: new Date().toISOString(),
  user: { id: 1, login: 'alice', avatar_url: 'https://avatar.com/alice.png', type: 'User' },
  requested_reviewers: [{ id: 2, login: 'bob', avatar_url: 'https://avatar.com/bob.png' }],
  requested_teams: [{ id: 10, name: 'frontend', slug: 'frontend' }],
  labels: [{ id: 100, name: 'bug', color: 'ff0000' }],
  head: { ref: 'feature/login', sha: 'abc123' },
  base: { ref: 'main' },
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('PRDetailModal', () => {
  const selectPR = vi.fn();
  const setMyPrSelected = vi.fn();
  const clearReviewers = vi.fn();
  const setPrContext = vi.fn();

  beforeEach(() => {
    selectPR.mockClear();
    setMyPrSelected.mockClear();
    clearReviewers.mockClear();
    setPrContext.mockClear();

    vi.mocked(useDashboardStore).mockReturnValue({
      selectedRepo: 'repo',
      selectedPR: 42,
      selectPR,
      prSearch: '',
      prPage: 1,
      myPrSelected: null,
      setMyPrSelected,
    } as never);

    vi.mocked(usePulls).mockReturnValue({
      data: { data: [pr], page: 1, perPage: 30, hasNextPage: false, total: 1 },
    } as never);

    vi.mocked(useReminderStore).mockReturnValue({
      setPrContext,
      clearReviewers,
    } as never);
  });

  it('renders nothing when no PR is selected', () => {
    vi.mocked(useDashboardStore).mockReturnValue({
      selectedRepo: null,
      selectedPR: null,
      selectPR,
      prSearch: '',
      prPage: 1,
    } as never);

    const { container } = render(<PRDetailModal />, { wrapper });
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when PR not found in data', () => {
    vi.mocked(useDashboardStore).mockReturnValue({
      selectedRepo: 'repo',
      selectedPR: 999,
      selectPR,
      prSearch: '',
      prPage: 1,
    } as never);

    const { container } = render(<PRDetailModal />, { wrapper });
    expect(container.innerHTML).toBe('');
  });

  it('renders a dialog with the PR title', () => {
    render(<PRDetailModal />, { wrapper });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Add login feature')).toBeInTheDocument();
  });

  it('displays PR number and author', () => {
    render(<PRDetailModal />, { wrapper });
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('by alice')).toBeInTheDocument();
  });

  it('shows branch info', () => {
    render(<PRDetailModal />, { wrapper });
    expect(screen.getByText('feature/login')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
  });

  it('shows labels with color', () => {
    render(<PRDetailModal />, { wrapper });
    const label = screen.getByText('bug');
    expect(label).toBeInTheDocument();
  });

  it('shows requested reviewers', () => {
    render(<PRDetailModal />, { wrapper });
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  it('shows requested teams', () => {
    render(<PRDetailModal />, { wrapper });
    expect(screen.getByText('frontend')).toBeInTheDocument();
  });

  it('renders ReviewerList', () => {
    render(<PRDetailModal />, { wrapper });
    expect(screen.getByTestId('reviewer-list')).toBeInTheDocument();
  });

  it('renders BulkActionBar', () => {
    render(<PRDetailModal />, { wrapper });
    expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument();
  });

  it('renders ReminderFlowModal', () => {
    render(<PRDetailModal />, { wrapper });
    expect(screen.getByTestId('reminder-flow-modal')).toBeInTheDocument();
  });

  it('shows View on GitHub link', () => {
    render(<PRDetailModal />, { wrapper });
    const link = screen.getByText('View on GitHub') as HTMLAnchorElement;
    expect(link.href).toBe('https://github.com/org/repo/pull/42');
  });

  it('closes modal via close button', () => {
    render(<PRDetailModal />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
    expect(selectPR).toHaveBeenCalledWith(null);
    expect(clearReviewers).toHaveBeenCalled();
  });

  it('closes modal on Escape key', () => {
    render(<PRDetailModal />, { wrapper });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(selectPR).toHaveBeenCalledWith(null);
  });

  it('shows age of PR', () => {
    render(<PRDetailModal />, { wrapper });
    expect(screen.getByText('2 days old')).toBeInTheDocument();
  });

  it('shows StatusBadge as open', () => {
    render(<PRDetailModal />, { wrapper });
    expect(screen.getByTestId('status-badge')).toHaveTextContent('open');
  });

  it('shows StatusBadge as draft when PR is draft', () => {
    vi.mocked(usePulls).mockReturnValue({
      data: { data: [{ ...pr, draft: true }], page: 1, perPage: 30, hasNextPage: false, total: 1 },
    } as never);
    render(<PRDetailModal />, { wrapper });
    expect(screen.getByTestId('status-badge')).toHaveTextContent('draft');
  });

  it('shows Created and Updated dates', () => {
    render(<PRDetailModal />, { wrapper });
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Updated')).toBeInTheDocument();
  });

  it('shows reviewer and team counts', () => {
    render(<PRDetailModal />, { wrapper });
    expect(screen.getByText('Reviewers requested')).toBeInTheDocument();
    expect(screen.getByText('Teams requested')).toBeInTheDocument();
  });

  it('shows Contributor for regular user type', () => {
    render(<PRDetailModal />, { wrapper });
    expect(screen.getByText('Contributor')).toBeInTheDocument();
  });

  it('shows Bot for bot user type', () => {
    vi.mocked(usePulls).mockReturnValue({
      data: {
        data: [{ ...pr, user: { ...pr.user, type: 'Bot' } }],
        page: 1,
        perPage: 30,
        hasNextPage: false,
        total: 1,
      },
    } as never);
    render(<PRDetailModal />, { wrapper });
    expect(screen.getByText('Bot')).toBeInTheDocument();
  });

  it('renders modal from myPrSelected without usePulls data', () => {
    const myPr = { ...pr, repo_name: 'org/my-special-repo' };
    vi.mocked(useDashboardStore).mockReturnValue({
      selectedRepo: null,
      selectedPR: null,
      selectPR,
      prSearch: '',
      prPage: 1,
      myPrSelected: myPr,
      setMyPrSelected,
    } as never);
    vi.mocked(usePulls).mockReturnValue({ data: null } as never);

    render(<PRDetailModal />, { wrapper });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Add login feature')).toBeInTheDocument();
  });

  it('shows Repository row for myPrSelected path', () => {
    const myPr = { ...pr, repo_name: 'org/my-special-repo' };
    vi.mocked(useDashboardStore).mockReturnValue({
      selectedRepo: null,
      selectedPR: null,
      selectPR,
      prSearch: '',
      prPage: 1,
      myPrSelected: myPr,
      setMyPrSelected,
    } as never);
    vi.mocked(usePulls).mockReturnValue({ data: null } as never);

    render(<PRDetailModal />, { wrapper });
    expect(screen.getByText('Repository')).toBeInTheDocument();
    expect(screen.getByText('org/my-special-repo')).toBeInTheDocument();
  });

  it('calls setMyPrSelected(null) on close in myPr path', () => {
    const myPr = { ...pr, repo_name: 'org/my-special-repo' };
    vi.mocked(useDashboardStore).mockReturnValue({
      selectedRepo: null,
      selectedPR: null,
      selectPR,
      prSearch: '',
      prPage: 1,
      myPrSelected: myPr,
      setMyPrSelected,
    } as never);
    vi.mocked(usePulls).mockReturnValue({ data: null } as never);

    render(<PRDetailModal />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
    expect(setMyPrSelected).toHaveBeenCalledWith(null);
    expect(selectPR).not.toHaveBeenCalled();
  });
});
