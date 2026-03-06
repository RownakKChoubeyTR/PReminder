import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/use-reviewers', () => ({
  useReviewers: vi.fn(),
}));

vi.mock('@/hooks/use-reminder-store', () => ({
  useReminderStore: vi.fn(),
}));

import { useReviewers } from '@/hooks/use-reviewers';
import { useReminderStore } from '@/hooks/use-reminder-store';
import { ReviewerList } from '@/components/pr/reviewer-list';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const mockReviewers = [
  {
    user: { login: 'alice', id: 1, avatar_url: 'https://avatar.com/alice' },
    status: 'approved',
    lastReviewedAt: '2024-01-15T10:00:00Z',
  },
  {
    user: { login: 'bob', id: 2, avatar_url: 'https://avatar.com/bob' },
    status: 'changes_requested',
    lastReviewedAt: null,
  },
];

describe('ReviewerList', () => {
  beforeEach(() => {
    vi.mocked(useReviewers).mockReturnValue({
      data: { data: mockReviewers },
      isLoading: false,
      error: null,
    } as never);
    vi.mocked(useReminderStore).mockReturnValue({
      selectedReviewers: [],
      toggleReviewer: vi.fn(),
      selectAllReviewers: vi.fn(),
      deselectReviewers: vi.fn(),
    } as never);
  });

  it('renders reviewer list', () => {
    render(<ReviewerList repo="org/repo" prNumber={42} />, { wrapper });
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  it('shows loading skeletons', () => {
    vi.mocked(useReviewers).mockReturnValue({ data: undefined, isLoading: true, error: null } as never);
    render(<ReviewerList repo="org/repo" prNumber={42} />, { wrapper });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows error state', () => {
    vi.mocked(useReviewers).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('fail'),
    } as never);
    render(<ReviewerList repo="org/repo" prNumber={42} />, { wrapper });
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows empty state', () => {
    vi.mocked(useReviewers).mockReturnValue({
      data: { data: [] },
      isLoading: false,
      error: null,
    } as never);
    render(<ReviewerList repo="org/repo" prNumber={42} />, { wrapper });
    expect(screen.getByText(/No reviewers requested/)).toBeInTheDocument();
  });

  it('shows checkboxes when selectable', () => {
    render(<ReviewerList repo="org/repo" prNumber={42} selectable />, { wrapper });
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2); // individual + select all
  });

  it('toggles reviewer selection', () => {
    const toggleReviewer = vi.fn();
    vi.mocked(useReminderStore).mockReturnValue({
      selectedReviewers: [],
      toggleReviewer,
      selectAllReviewers: vi.fn(),
      deselectReviewers: vi.fn(),
    } as never);
    render(<ReviewerList repo="org/repo" prNumber={42} selectable />, { wrapper });
    const aliceCheckbox = screen.getByRole('checkbox', { name: 'Select alice' });
    fireEvent.click(aliceCheckbox);
    expect(toggleReviewer).toHaveBeenCalledWith('alice');
  });

  it('select all calls selectAllReviewers', () => {
    const selectAllReviewers = vi.fn();
    vi.mocked(useReminderStore).mockReturnValue({
      selectedReviewers: [],
      toggleReviewer: vi.fn(),
      selectAllReviewers,
      deselectReviewers: vi.fn(),
    } as never);
    render(<ReviewerList repo="org/repo" prNumber={42} selectable />, { wrapper });
    const selectAll = screen.getByRole('checkbox', { name: /Select all/i });
    fireEvent.click(selectAll);
    expect(selectAllReviewers).toHaveBeenCalledWith(['alice', 'bob']);
  });

  it('deselect all when all are selected', () => {
    const deselectReviewers = vi.fn();
    vi.mocked(useReminderStore).mockReturnValue({
      selectedReviewers: ['alice', 'bob'],
      toggleReviewer: vi.fn(),
      selectAllReviewers: vi.fn(),
      deselectReviewers,
    } as never);
    render(<ReviewerList repo="org/repo" prNumber={42} selectable />, { wrapper });
    const selectAll = screen.getByRole('checkbox', { name: /Deselect all/i });
    fireEvent.click(selectAll);
    expect(deselectReviewers).toHaveBeenCalledWith(['alice', 'bob']);
  });

  it('does not show checkboxes when not selectable', () => {
    render(<ReviewerList repo="org/repo" prNumber={42} />, { wrapper });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
