import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/hooks/use-reminder-store', () => ({
  useReminderStore: vi.fn(),
}));

import { useReminderStore } from '@/hooks/use-reminder-store';
import { BulkActionBar } from '@/components/reminders/bulk-action-bar';

describe('BulkActionBar', () => {
  const clearReviewers = vi.fn();
  const openFlow = vi.fn();

  beforeEach(() => {
    vi.mocked(useReminderStore).mockReturnValue({
      selectedReviewers: ['alice', 'bob'],
      clearReviewers,
      openFlow,
    } as never);
  });

  it('renders when reviewers are selected', () => {
    render(<BulkActionBar />);
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/reviewers selected/)).toBeInTheDocument();
  });

  it('returns null when no reviewers selected', () => {
    vi.mocked(useReminderStore).mockReturnValue({
      selectedReviewers: [],
      clearReviewers,
      openFlow,
    } as never);
    const { container } = render(<BulkActionBar />);
    expect(container.innerHTML).toBe('');
  });

  it('shows singular label for 1 reviewer', () => {
    vi.mocked(useReminderStore).mockReturnValue({
      selectedReviewers: ['alice'],
      clearReviewers,
      openFlow,
    } as never);
    render(<BulkActionBar />);
    expect(screen.getByText(/reviewer selected/)).toBeInTheDocument();
  });

  it('calls clearReviewers on Clear click', () => {
    render(<BulkActionBar />);
    fireEvent.click(screen.getByText('Clear'));
    expect(clearReviewers).toHaveBeenCalled();
  });

  it('calls openFlow on Send Reminder click', () => {
    render(<BulkActionBar />);
    fireEvent.click(screen.getByText('Send Reminder'));
    expect(openFlow).toHaveBeenCalled();
  });
});
