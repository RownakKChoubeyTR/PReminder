import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/use-reminders', () => ({
  useReminderLogs: vi.fn(),
}));

import { useReminderLogs } from '@/hooks/use-reminders';
import { ReminderLogTable } from '@/components/reminders/reminder-log-table';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('ReminderLogTable', () => {
  beforeEach(() => {
    vi.mocked(useReminderLogs).mockReturnValue({
      data: {
        data: [
          {
            id: 'r1',
            reviewerGithub: 'alice',
            prNumber: 42,
            prTitle: 'Add feature',
            repo: 'org/repo',
            method: 'TEAMS_DM_POWER_AUTOMATE',
            status: 'SENT',
            sentAt: new Date().toISOString(),
            errorMessage: null,
          },
          {
            id: 'r2',
            reviewerGithub: 'bob',
            prNumber: 43,
            prTitle: 'Fix bug',
            repo: 'org/repo',
            method: 'TEAMS_CHANNEL_WEBHOOK',
            status: 'FAILED',
            sentAt: new Date().toISOString(),
            errorMessage: 'Webhook error',
          },
        ],
        hasNextPage: false,
        total: 2,
        page: 1,
        perPage: 20,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as never);
  });

  it('renders table with reminder data', () => {
    render(<ReminderLogTable />, { wrapper });
    expect(screen.getByText('@alice')).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('Teams DM')).toBeInTheDocument();
  });

  it('shows method labels', () => {
    render(<ReminderLogTable />, { wrapper });
    expect(screen.getByText('Teams DM')).toBeInTheDocument();
    // 'Channel' appears both as <th> header and method label
    expect(screen.getAllByText('Channel').length).toBeGreaterThanOrEqual(2);
  });

  it('shows SENT/FAILED status', () => {
    render(<ReminderLogTable />, { wrapper });
    expect(screen.getByText('SENT')).toBeInTheDocument();
    expect(screen.getByText('FAILED')).toBeInTheDocument();
  });

  it('shows error message for failed reminders', () => {
    render(<ReminderLogTable />, { wrapper });
    expect(screen.getByText('Webhook error')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useReminderLogs).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as never);
    render(<ReminderLogTable />, { wrapper });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows error state with retry', () => {
    const refetch = vi.fn();
    vi.mocked(useReminderLogs).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('fail'),
      refetch,
      isFetching: false,
    } as never);
    render(<ReminderLogTable />, { wrapper });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Retry'));
    expect(refetch).toHaveBeenCalled();
  });

  it('shows empty state', () => {
    vi.mocked(useReminderLogs).mockReturnValue({
      data: { data: [], hasNextPage: false, total: 0, page: 1, perPage: 20 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as never);
    render(<ReminderLogTable />, { wrapper });
    expect(screen.getByText(/No reminders sent yet/)).toBeInTheDocument();
  });

  it('shows pagination when hasNextPage', () => {
    vi.mocked(useReminderLogs).mockReturnValue({
      data: {
        data: [{ id: 'r1', reviewerGithub: 'alice', prNumber: 1, prTitle: 'X', repo: 'r', method: 'TEAMS_DM_POWER_AUTOMATE', status: 'SENT', sentAt: new Date().toISOString(), errorMessage: null }],
        hasNextPage: true,
        total: 40,
        page: 1,
        perPage: 20,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as never);
    render(<ReminderLogTable />, { wrapper });
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });
});
