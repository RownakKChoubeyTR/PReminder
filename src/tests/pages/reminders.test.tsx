import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/reminders/reminder-log-table', () => ({
  ReminderLogTable: () => <div data-testid="log-table" />,
}));

import RemindersPage from '@/app/dashboard/reminders/page';

describe('RemindersPage', () => {
  it('renders heading and description', () => {
    render(<RemindersPage />);
    expect(screen.getByText('Reminder History')).toBeInTheDocument();
    expect(screen.getByText(/Track delivery status/)).toBeInTheDocument();
  });

  it('renders ReminderLogTable', () => {
    render(<RemindersPage />);
    expect(screen.getByTestId('log-table')).toBeInTheDocument();
  });
});
